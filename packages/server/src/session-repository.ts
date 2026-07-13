import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  scoreDiagnostic,
  toPublicDiagnosticForm,
  type DiagnosticAnswer,
  type DiagnosticFormSecure,
  type DiagnosticResult,
  type DiagnosticSessionPayload,
} from "@act-tutor/core";

export interface SaveDiagnosticProgress {
  answers: Record<string, string>;
  currentIndex: number;
  phase: "questions" | "review";
}

interface StoredDiagnosticSession {
  id: string;
  formId: string;
  formVersion: string;
  questionIds: string[];
  answers: Record<string, string>;
  currentIndex: number;
  phase: "questions" | "review";
  status: "in_progress" | "completed";
  result: DiagnosticResult | null;
  createdAt: string;
  updatedAt: string;
}

interface DiagnosticStoreFile {
  version: 1;
  sessions: Record<string, StoredDiagnosticSession>;
}

const EMPTY_STORE: DiagnosticStoreFile = { version: 1, sessions: {} };
const queues = new Map<string, Promise<void>>();

function validateProgress(
  form: DiagnosticFormSecure,
  progress: SaveDiagnosticProgress,
) {
  if (
    !Number.isInteger(progress.currentIndex) ||
    progress.currentIndex < 0 ||
    progress.currentIndex >= form.questions.length
  ) {
    throw new RangeError("Current question index is outside this form.");
  }
  if (progress.phase !== "questions" && progress.phase !== "review") {
    throw new RangeError("Unknown diagnostic phase.");
  }

  const questions = new Map(form.questions.map((item) => [item.id, item]));
  for (const [questionId, choiceId] of Object.entries(progress.answers)) {
    const question = questions.get(questionId);
    if (!question) throw new RangeError(`Unknown diagnostic question: ${questionId}.`);
    if (!question.choices.some((choice) => choice.id === choiceId)) {
      throw new RangeError(`Unknown choice for ${questionId}.`);
    }
  }
}

function assertSessionMatchesForm(
  session: StoredDiagnosticSession,
  form: DiagnosticFormSecure,
) {
  const currentIds = form.questions.map((question) => question.id);
  if (
    session.formId !== form.id ||
    session.formVersion !== form.version ||
    session.questionIds.length !== currentIds.length ||
    session.questionIds.some((id, index) => id !== currentIds[index])
  ) {
    throw new RangeError("This diagnostic session belongs to a different form version.");
  }
}

function toPayload(
  session: StoredDiagnosticSession,
  form: DiagnosticFormSecure,
): DiagnosticSessionPayload {
  return {
    form: toPublicDiagnosticForm(form),
    progress: {
      answers: { ...session.answers },
      currentIndex: session.currentIndex,
      phase: session.phase,
      updatedAt: session.updatedAt,
    },
    status: session.status,
    result: session.result,
  };
}

export class FileDiagnosticSessionRepository {
  constructor(private readonly filePath: string) {}

  private async readStore(): Promise<DiagnosticStoreFile> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as DiagnosticStoreFile;
      if (parsed.version !== 1 || !parsed.sessions) {
        throw new Error("Unsupported diagnostic store format.");
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return structuredClone(EMPTY_STORE);
      }
      throw error;
    }
  }

  private async writeStore(store: DiagnosticStoreFile) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  private async transact<T>(operation: (store: DiagnosticStoreFile) => Promise<T> | T): Promise<T> {
    const previous = queues.get(this.filePath) ?? Promise.resolve();
    let release: () => void = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    queues.set(this.filePath, tail);

    await previous;
    try {
      return await operation(await this.readStore());
    } finally {
      release();
      if (queues.get(this.filePath) === tail) queues.delete(this.filePath);
    }
  }

  async getOrCreate(
    sessionId: string | null,
    form: DiagnosticFormSecure,
  ): Promise<{ sessionId: string; payload: DiagnosticSessionPayload }> {
    return this.transact(async (store) => {
      const existing = sessionId ? store.sessions[sessionId] : undefined;
      if (existing) {
        try {
          assertSessionMatchesForm(existing, form);
          return { sessionId: existing.id, payload: toPayload(existing, form) };
        } catch {
          // A form version change intentionally starts a new frozen session.
        }
      }

      const now = new Date().toISOString();
      const id = randomUUID();
      const created: StoredDiagnosticSession = {
        id,
        formId: form.id,
        formVersion: form.version,
        questionIds: form.questions.map((question) => question.id),
        answers: {},
        currentIndex: 0,
        phase: "questions",
        status: "in_progress",
        result: null,
        createdAt: now,
        updatedAt: now,
      };
      store.sessions[id] = created;
      await this.writeStore(store);
      return { sessionId: id, payload: toPayload(created, form) };
    });
  }

  async saveProgress(
    sessionId: string,
    form: DiagnosticFormSecure,
    progress: SaveDiagnosticProgress,
  ): Promise<DiagnosticSessionPayload> {
    validateProgress(form, progress);
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Diagnostic session not found.");
      assertSessionMatchesForm(session, form);
      if (session.status === "completed") return toPayload(session, form);

      session.answers = { ...progress.answers };
      session.currentIndex = progress.currentIndex;
      session.phase = progress.phase;
      session.updatedAt = new Date().toISOString();
      await this.writeStore(store);
      return toPayload(session, form);
    });
  }

  async finalize(
    sessionId: string,
    form: DiagnosticFormSecure,
    answers: ReadonlyArray<DiagnosticAnswer>,
  ): Promise<DiagnosticSessionPayload> {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Diagnostic session not found.");
      assertSessionMatchesForm(session, form);
      if (session.status === "completed" && session.result) {
        return toPayload(session, form);
      }

      const result = scoreDiagnostic(form, answers);
      session.answers = Object.fromEntries(
        answers.map((answer) => [answer.questionId, answer.choiceId]),
      );
      session.currentIndex = form.questions.length - 1;
      session.phase = "review";
      session.status = "completed";
      session.result = result;
      session.updatedAt = new Date().toISOString();
      await this.writeStore(store);
      return toPayload(session, form);
    });
  }

  async reset(sessionId: string) {
    return this.transact(async (store) => {
      if (!store.sessions[sessionId]) return;
      delete store.sessions[sessionId];
      await this.writeStore(store);
    });
  }
}
