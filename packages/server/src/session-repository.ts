import { randomUUID } from "node:crypto";

import {
  createAssessmentRemediationProgress,
  recordAssessmentRemediationResponse,
  scoreDiagnostic,
  toPublicDiagnosticForm,
  type AssessmentRemediationProgress,
  type DiagnosticAnswer,
  type DiagnosticFormSecure,
  type DiagnosticResult,
  type DiagnosticSessionPayload,
} from "@act-tutor/core";

import {
  resolveJsonDocumentStore,
  type JsonDocumentStore,
} from "./atomic-json-repository";

export interface SaveDiagnosticProgress {
  answers: Record<string, string>;
  currentIndex: number;
  phase: "questions" | "review";
}

interface StoredDiagnosticSession {
  id: string;
  purpose?: "baseline" | "round";
  formId: string;
  formVersion: string;
  questionIds: string[];
  answers: Record<string, string>;
  currentIndex: number;
  phase: "questions" | "review";
  status: "in_progress" | "completed";
  result: DiagnosticResult | null;
  remediation?: AssessmentRemediationProgress | null;
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
    if (!question)
      throw new RangeError(`Unknown diagnostic question: ${questionId}.`);
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
    throw new RangeError(
      "This diagnostic session belongs to a different form version.",
    );
  }
}

function toPayload(
  session: StoredDiagnosticSession,
  form: DiagnosticFormSecure,
): DiagnosticSessionPayload {
  return {
    attemptId: session.id,
    purpose: session.purpose ?? "baseline",
    form: toPublicDiagnosticForm(form),
    progress: {
      answers: { ...session.answers },
      currentIndex: session.currentIndex,
      phase: session.phase,
      updatedAt: session.updatedAt,
    },
    status: session.status,
    result: session.result,
    remediation: remediationFor(session),
  };
}

function remediationFor(
  session: StoredDiagnosticSession,
): AssessmentRemediationProgress | null {
  if (session.status !== "completed" || !session.result) return null;
  return (
    session.remediation ??
    createAssessmentRemediationProgress(
      session.result.feedback
        .filter((feedback) => !feedback.correct)
        .map((feedback) => feedback.questionId),
      session.updatedAt,
    )
  );
}

function createSession(
  form: DiagnosticFormSecure,
  purpose: "baseline" | "round" = "baseline",
): StoredDiagnosticSession {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    purpose,
    formId: form.id,
    formVersion: form.version,
    questionIds: form.questions.map((question) => question.id),
    answers: {},
    currentIndex: 0,
    phase: "questions",
    status: "in_progress",
    result: null,
    remediation: null,
    createdAt: now,
    updatedAt: now,
  };
}

export class FileDiagnosticSessionRepository {
  private readonly store: JsonDocumentStore;

  constructor(source: string | JsonDocumentStore) {
    this.store = resolveJsonDocumentStore(source);
  }

  private async readStore(): Promise<DiagnosticStoreFile> {
    const value = await this.store.read();
    if (value === null) return structuredClone(EMPTY_STORE);
    const parsed = value as DiagnosticStoreFile;
    if (parsed.version !== 1 || !parsed.sessions) {
      throw new Error("Unsupported diagnostic store format.");
    }
    return parsed;
  }

  private async writeStore(store: DiagnosticStoreFile) {
    await this.store.write(store);
  }

  private async transact<T>(
    operation: (store: DiagnosticStoreFile) => Promise<T> | T,
  ): Promise<T> {
    const previous = queues.get(this.store.key) ?? Promise.resolve();
    let release: () => void = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    queues.set(this.store.key, tail);

    await previous;
    try {
      return await operation(await this.readStore());
    } finally {
      release();
      if (queues.get(this.store.key) === tail) queues.delete(this.store.key);
    }
  }

  async getOrCreate(
    sessionId: string | null,
    form: DiagnosticFormSecure,
    purpose: "baseline" | "round" = "baseline",
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

      const created = createSession(form, purpose);
      store.sessions[created.id] = created;
      await this.writeStore(store);
      return { sessionId: created.id, payload: toPayload(created, form) };
    });
  }

  async startNew(
    previousSessionId: string | null,
    form: DiagnosticFormSecure,
    purpose: "baseline" | "round" = "baseline",
  ): Promise<{ sessionId: string; payload: DiagnosticSessionPayload }> {
    return this.transact(async (store) => {
      const created = createSession(form, purpose);
      store.sessions[created.id] = created;
      if (previousSessionId) delete store.sessions[previousSessionId];
      await this.writeStore(store);
      return {
        sessionId: created.id,
        payload: toPayload(created, form),
      };
    });
  }

  async get(
    sessionId: string,
    form: DiagnosticFormSecure,
  ): Promise<DiagnosticSessionPayload> {
    return this.transact((store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Diagnostic session not found.");
      assertSessionMatchesForm(session, form);
      return toPayload(session, form);
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
      session.remediation = createAssessmentRemediationProgress(
        result.feedback
          .filter((feedback) => !feedback.correct)
          .map((feedback) => feedback.questionId),
        session.updatedAt,
      );
      await this.writeStore(store);
      return toPayload(session, form);
    });
  }

  async answerRemediation(
    sessionId: string,
    form: DiagnosticFormSecure,
    input: { questionId: string; choiceId: string },
  ): Promise<DiagnosticSessionPayload> {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Diagnostic session not found.");
      assertSessionMatchesForm(session, form);
      if (session.status !== "completed" || !session.result) {
        throw new RangeError(
          "Finish the diagnostic before reviewing missed questions.",
        );
      }
      const question = form.questions.find(
        (candidate) => candidate.id === input.questionId,
      );
      if (!question) {
        throw new RangeError("That diagnostic question is not available.");
      }
      if (!question.choices.some((choice) => choice.id === input.choiceId)) {
        throw new RangeError("That answer choice is not available.");
      }
      const progress = remediationFor(session);
      if (!progress) {
        throw new Error("The diagnostic review could not be prepared.");
      }
      session.remediation = recordAssessmentRemediationResponse(progress, {
        questionId: input.questionId,
        choiceId: input.choiceId,
        correct: input.choiceId === question.correctChoiceId,
      });
      session.updatedAt = session.remediation.updatedAt;
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
