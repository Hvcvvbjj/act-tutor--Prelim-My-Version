import { randomUUID } from "node:crypto";

import {
  examLabInitialSection,
  examLabMinutes,
  nextExamSection,
  scoreExamLab,
  selectExamLabQuestions,
  toPublicExamQuestion,
  type CoreSection,
  type DiagnosticFormSecure,
  type ExamConfidence,
  type ExamDebrief,
  type ExamLabMode,
  type ExamLabPhase,
  type ExamLabResponse,
  type ExamLabResult,
  type ExamLabSection,
  type ExamLabSessionPayload,
} from "@act-tutor/core";

import {
  AuthoredExamDebriefComposer,
  type ExamDebriefComposer,
} from "./exam-debrief-composer";
import {
  resolveJsonDocumentStore,
  type JsonDocumentStore,
} from "./atomic-json-repository";

export interface StartExamLabInput {
  mode: ExamLabMode;
  section?: CoreSection | null;
  timeMultiplier?: 1 | 1.5;
}

export interface SaveExamLabProgress {
  responses: Record<string, ExamLabResponse>;
  currentIndex: number;
  phase: "questions" | "review";
}

interface StoredExamLabSession {
  id: string;
  formId: string;
  formVersion: string;
  mode: ExamLabMode;
  selectedSection: CoreSection | null;
  title: string;
  questionIds: string[];
  responses: Record<string, ExamLabResponse>;
  currentIndex: number;
  currentSection: ExamLabSection;
  phase: ExamLabPhase;
  status: "in_progress" | "completed";
  sectionStartedAt: string;
  sectionDeadlineAt: string;
  timeMultiplier?: 1 | 1.5;
  result: ExamLabResult | null;
  createdAt: string;
  updatedAt: string;
}

interface ExamLabStoreFile {
  version: 1;
  sessions: Record<string, StoredExamLabSession>;
}

const EMPTY_STORE: ExamLabStoreFile = { version: 1, sessions: {} };
const queues = new Map<string, Promise<void>>();
const CONFIDENCE = new Set<ExamConfidence>(["guess", "unsure", "sure"]);

function addMinutes(iso: string, minutes: number) {
  const date = new Date(iso);
  date.setTime(date.getTime() + minutes * 60_000);
  return date.toISOString();
}

function titleFor(mode: ExamLabMode, section: CoreSection | null) {
  if (mode === "core") return "Half-length core rehearsal";
  if (mode === "sprint") return "Twelve-skill pressure sprint";
  if (!section) throw new RangeError("A section is required.");
  return `${section[0].toUpperCase()}${section.slice(1)} section simulation`;
}

function questionsFor(
  session: StoredExamLabSession,
  form: DiagnosticFormSecure,
) {
  return session.questionIds.map((id) => {
    const question = form.questions.find((candidate) => candidate.id === id);
    if (!question)
      throw new RangeError(`Exam Lab question ${id} is no longer available.`);
    return question;
  });
}

function assertSession(
  session: StoredExamLabSession,
  form: DiagnosticFormSecure,
) {
  if (session.formId !== form.id || session.formVersion !== form.version) {
    throw new RangeError(
      "This Test Day Lab session belongs to a different form version.",
    );
  }
  questionsFor(session, form);
}

function toPayload(
  session: StoredExamLabSession,
  form: DiagnosticFormSecure,
): ExamLabSessionPayload {
  return {
    id: session.id,
    mode: session.mode,
    selectedSection: session.selectedSection,
    title: session.title,
    questions: questionsFor(session, form).map(toPublicExamQuestion),
    status: session.status,
    progress: {
      responses: structuredClone(session.responses),
      currentIndex: session.currentIndex,
      currentSection: session.currentSection,
      phase: session.phase,
      updatedAt: session.updatedAt,
    },
    sectionStartedAt: session.sectionStartedAt,
    sectionDeadlineAt: session.sectionDeadlineAt,
    result: session.result,
  };
}

function validateProgress(
  session: StoredExamLabSession,
  form: DiagnosticFormSecure,
  input: SaveExamLabProgress,
) {
  const questions = questionsFor(session, form);
  if (
    !Number.isInteger(input.currentIndex) ||
    input.currentIndex < 0 ||
    input.currentIndex >= questions.length
  ) {
    throw new RangeError("Current Test Day Lab question is outside this form.");
  }
  if (input.phase !== "questions" && input.phase !== "review")
    throw new RangeError("Unknown Test Day Lab phase.");
  const questionMap = new Map(
    questions.map((question) => [question.id, question]),
  );
  for (const [questionId, response] of Object.entries(input.responses)) {
    const question = questionMap.get(questionId);
    if (!question)
      throw new RangeError(`Unknown Test Day Lab question: ${questionId}.`);
    if (
      !response ||
      (response.choiceId !== null &&
        !question.choices.some((choice) => choice.id === response.choiceId))
    ) {
      throw new RangeError(`Unknown choice for ${questionId}.`);
    }
    if (!CONFIDENCE.has(response.confidence))
      throw new RangeError(`Unknown confidence for ${questionId}.`);
    if (typeof response.flagged !== "boolean")
      throw new RangeError(`Flag state for ${questionId} is malformed.`);
    if (
      !Number.isFinite(response.elapsedSeconds) ||
      response.elapsedSeconds < 0 ||
      response.elapsedSeconds > 7200
    ) {
      throw new RangeError(`Elapsed time for ${questionId} is malformed.`);
    }
  }
  if (input.phase === "questions" && session.mode === "core") {
    const target = questions[input.currentIndex];
    if (target.section !== session.currentSection) {
      throw new RangeError(
        "Finish or advance the current section before opening that question.",
      );
    }
  }
}

export class FileExamLabRepository {
  private readonly store: JsonDocumentStore;

  constructor(source: string | JsonDocumentStore) {
    this.store = resolveJsonDocumentStore(source);
  }

  private async readStore(): Promise<ExamLabStoreFile> {
    const value = await this.store.read();
    if (value === null) return structuredClone(EMPTY_STORE);
    const parsed = value as ExamLabStoreFile;
    if (parsed.version !== 1 || !parsed.sessions)
      throw new Error("Unsupported Test Day Lab store format.");
    return parsed;
  }

  private async writeStore(store: ExamLabStoreFile) {
    await this.store.write(store);
  }

  private async transact<T>(
    operation: (store: ExamLabStoreFile) => Promise<T> | T,
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

  async start(form: DiagnosticFormSecure, input: StartExamLabInput) {
    const selectedSection =
      input.mode === "section" ? (input.section ?? null) : null;
    const questions = selectExamLabQuestions(form, input.mode, selectedSection);
    const currentSection = examLabInitialSection(input.mode, selectedSection);
    return this.transact(async (store) => {
      const now = new Date().toISOString();
      const created: StoredExamLabSession = {
        id: randomUUID(),
        formId: form.id,
        formVersion: form.version,
        mode: input.mode,
        selectedSection,
        title: titleFor(input.mode, selectedSection),
        questionIds: questions.map((question) => question.id),
        responses: {},
        currentIndex: 0,
        currentSection,
        phase: "questions",
        status: "in_progress",
        sectionStartedAt: now,
        timeMultiplier: input.timeMultiplier ?? 1,
        sectionDeadlineAt: addMinutes(
          now,
          examLabMinutes(input.mode, currentSection) *
            (input.timeMultiplier ?? 1),
        ),
        result: null,
        createdAt: now,
        updatedAt: now,
      };
      store.sessions[created.id] = created;
      await this.writeStore(store);
      return { sessionId: created.id, payload: toPayload(created, form) };
    });
  }

  async get(sessionId: string, form: DiagnosticFormSecure) {
    return this.transact((store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Test Day Lab session not found.");
      assertSession(session, form);
      return toPayload(session, form);
    });
  }

  async save(
    sessionId: string,
    form: DiagnosticFormSecure,
    input: SaveExamLabProgress,
  ) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Test Day Lab session not found.");
      assertSession(session, form);
      if (session.status === "completed") return toPayload(session, form);
      validateProgress(session, form, input);
      session.responses = structuredClone(input.responses);
      session.currentIndex = input.currentIndex;
      session.phase = input.phase;
      session.updatedAt = new Date().toISOString();
      await this.writeStore(store);
      return toPayload(session, form);
    });
  }

  async advanceSection(sessionId: string, form: DiagnosticFormSecure) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Test Day Lab session not found.");
      assertSession(session, form);
      if (session.status === "completed") return toPayload(session, form);
      const questions = questionsFor(session, form);
      const next =
        session.mode === "core"
          ? nextExamSection(session.currentSection)
          : null;
      const now = new Date().toISOString();
      if (!next) {
        session.phase = "review";
      } else {
        session.currentSection = next;
        session.currentIndex = questions.findIndex(
          (question) => question.section === next,
        );
        session.sectionStartedAt = now;
        session.sectionDeadlineAt = addMinutes(
          now,
          examLabMinutes(session.mode, next) * (session.timeMultiplier ?? 1),
        );
        session.phase = "questions";
      }
      session.updatedAt = now;
      await this.writeStore(store);
      return toPayload(session, form);
    });
  }

  async beginReview(sessionId: string, form: DiagnosticFormSecure) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Test Day Lab session not found.");
      assertSession(session, form);
      if (session.status === "completed") return toPayload(session, form);
      session.phase = "review";
      session.updatedAt = new Date().toISOString();
      await this.writeStore(store);
      return toPayload(session, form);
    });
  }

  async finalize(
    sessionId: string,
    form: DiagnosticFormSecure,
    debriefComposer: ExamDebriefComposer = new AuthoredExamDebriefComposer(),
  ) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Test Day Lab session not found.");
      assertSession(session, form);
      if (session.status === "completed" && session.result)
        return toPayload(session, form);
      const scored = scoreExamLab(
        session.mode,
        questionsFor(session, form),
        session.responses,
      );
      const debrief: ExamDebrief = await debriefComposer.compose(scored);
      session.result = { ...scored, debrief };
      session.status = "completed";
      session.phase = "results";
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
