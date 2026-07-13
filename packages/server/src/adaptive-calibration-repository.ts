import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  ADAPTIVE_CALIBRATION_MODEL,
  CALIBRATION_MAX_ITEMS,
  CALIBRATION_MIN_ITEMS,
  calibrationStopDecision,
  estimateAbility,
  irtItemInformation,
  parametersForDifficulty,
  selectNextCalibrationItem,
  type AdaptiveCalibrationPayload,
  type CalibrationFeedback,
  type CalibrationHistoryEvent,
  type CalibrationItemDescriptor,
  type CalibrationObservation,
  type DiagnosticQuestionPublic,
  type DiagnosticQuestionSecure,
  type PracticeDifficulty,
} from "@act-tutor/core";

export interface CalibrationBankInput {
  id: string;
  version: string;
  questions: ReadonlyArray<DiagnosticQuestionSecure>;
}

export interface CalibrationKnowledgeEvidence {
  questionId: string;
  skill: string;
  correct: boolean;
  difficulty: PracticeDifficulty;
  observedAt: string;
}

interface StoredCalibrationResponse {
  selectedChoiceId: string;
  observation: CalibrationObservation;
  event: CalibrationHistoryEvent;
}

interface StoredCalibrationSession {
  id: string;
  bankId: string;
  bankVersion: string;
  responses: StoredCalibrationResponse[];
  currentQuestionId: string | null;
  status: "in_progress" | "complete";
  stopReason: string | null;
  representativeDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CalibrationStoreFile {
  version: 1;
  sessions: Record<string, StoredCalibrationSession>;
}

const EMPTY_STORE: CalibrationStoreFile = { version: 1, sessions: {} };
const queues = new Map<string, Promise<void>>();

function knowledgeEvidenceFor(
  response: StoredCalibrationResponse,
): CalibrationKnowledgeEvidence {
  return {
    questionId: response.observation.id,
    skill: response.observation.skill,
    correct: response.observation.correct,
    difficulty: response.observation.difficulty,
    observedAt: response.observation.answeredAt,
  };
}

function publicQuestion(
  question: DiagnosticQuestionSecure,
): DiagnosticQuestionPublic {
  const {
    correctChoiceId: _correctChoiceId,
    rationale: _rationale,
    content: _content,
    ...publicItem
  } = question;
  return publicItem;
}

function descriptorFor(
  question: DiagnosticQuestionSecure,
): CalibrationItemDescriptor {
  return {
    id: question.id,
    section: question.section,
    skill: question.primarySkill,
    skillLabel: question.skillLabel,
    difficulty: question.difficulty,
    parameters: parametersForDifficulty(question.difficulty),
  };
}

function descriptors(bank: CalibrationBankInput) {
  return bank.questions.map(descriptorFor);
}

function observations(session: StoredCalibrationSession) {
  return session.responses.map((response) => response.observation);
}

function getQuestion(bank: CalibrationBankInput, questionId: string) {
  const question = bank.questions.find((item) => item.id === questionId);
  if (!question)
    throw new RangeError(`Calibration question ${questionId} is unavailable.`);
  return question;
}

function assertSessionMatchesBank(
  session: StoredCalibrationSession,
  bank: CalibrationBankInput,
) {
  if (session.bankId !== bank.id || session.bankVersion !== bank.version) {
    throw new RangeError(
      "This calibration session belongs to a different item bank.",
    );
  }
  if (session.currentQuestionId) getQuestion(bank, session.currentQuestionId);
  for (const response of session.responses)
    getQuestion(bank, response.observation.id);
}

function createStoredSession(
  bank: CalibrationBankInput,
  representativeDemo = false,
): StoredCalibrationSession {
  if (bank.questions.length < CALIBRATION_MIN_ITEMS) {
    throw new RangeError(
      `Adaptive calibration requires at least ${CALIBRATION_MIN_ITEMS} items.`,
    );
  }
  const now = new Date().toISOString();
  const selection = selectNextCalibrationItem(descriptors(bank), []);
  if (!selection) throw new RangeError("Calibration item bank is empty.");
  return {
    id: randomUUID(),
    bankId: bank.id,
    bankVersion: bank.version,
    responses: [],
    currentQuestionId: selection.selectedItemId,
    status: "in_progress",
    stopReason: null,
    representativeDemo,
    createdAt: now,
    updatedAt: now,
  } satisfies StoredCalibrationSession;
}

function feedbackFor(
  response: StoredCalibrationResponse | undefined,
  bank: CalibrationBankInput,
): CalibrationFeedback | null {
  if (!response) return null;
  const question = getQuestion(bank, response.observation.id);
  return {
    questionId: question.id,
    selectedChoiceId: response.selectedChoiceId,
    correctChoiceId: question.correctChoiceId,
    correct: response.observation.correct,
    rationale: question.rationale,
    event: response.event,
  };
}

function toPayload(
  session: StoredCalibrationSession,
  bank: CalibrationBankInput,
): AdaptiveCalibrationPayload {
  assertSessionMatchesBank(session, bank);
  const evidence = observations(session);
  const estimate = estimateAbility(evidence);
  const selection =
    session.status === "in_progress"
      ? selectNextCalibrationItem(descriptors(bank), evidence)
      : null;
  const currentQuestion = session.currentQuestionId
    ? publicQuestion(getQuestion(bank, session.currentQuestionId))
    : null;
  return {
    sessionId: session.id,
    bankVersion: session.bankVersion,
    model: ADAPTIVE_CALIBRATION_MODEL,
    status: session.status,
    currentQuestion,
    estimate,
    selection,
    history: session.responses.map((response) => response.event).reverse(),
    lastFeedback: feedbackFor(session.responses.at(-1), bank),
    answeredQuestionIds: session.responses.map(
      (response) => response.observation.id,
    ),
    responseCount: session.responses.length,
    minimumItems: CALIBRATION_MIN_ITEMS,
    maximumItems: Math.min(CALIBRATION_MAX_ITEMS, bank.questions.length),
    progress:
      session.status === "complete"
        ? 100
        : Math.round(
            (session.responses.length /
              Math.min(CALIBRATION_MAX_ITEMS, bank.questions.length)) *
              100,
          ),
    stopReason: session.stopReason,
    representativeDemo: session.representativeDemo,
    learningTwinUpdated: false,
    updatedAt: session.updatedAt,
  };
}

function applyAnswer(
  session: StoredCalibrationSession,
  bank: CalibrationBankInput,
  answer: { questionId: string; choiceId: string },
): CalibrationKnowledgeEvidence {
  if (session.status === "complete")
    throw new RangeError("This precision check is already complete.");
  if (session.currentQuestionId !== answer.questionId) {
    throw new RangeError("Calibration questions must be answered in order.");
  }
  const question = getQuestion(bank, answer.questionId);
  if (!question.choices.some((choice) => choice.id === answer.choiceId)) {
    throw new RangeError("Unknown calibration choice.");
  }

  const before = estimateAbility(observations(session));
  const parameters = parametersForDifficulty(question.difficulty);
  const correct = answer.choiceId === question.correctChoiceId;
  const answeredAt = new Date().toISOString();
  const observation: CalibrationObservation = {
    ...descriptorFor(question),
    correct,
    answeredAt,
  };
  const after = estimateAbility([...observations(session), observation]);
  const event: CalibrationHistoryEvent = {
    questionId: question.id,
    section: question.section,
    skill: question.primarySkill,
    skillLabel: question.skillLabel,
    difficulty: question.difficulty,
    correct,
    thetaBefore: before.theta,
    thetaAfter: after.theta,
    standardErrorBefore: before.standardError,
    standardErrorAfter: after.standardError,
    information: irtItemInformation(before.theta, parameters),
    answeredAt,
  };
  const storedResponse = {
    selectedChoiceId: answer.choiceId,
    observation,
    event,
  } satisfies StoredCalibrationResponse;
  session.responses.push(storedResponse);
  const stop = calibrationStopDecision(
    observations(session),
    bank.questions.length,
  );
  if (stop.complete) {
    session.status = "complete";
    session.stopReason = stop.reason;
    session.currentQuestionId = null;
  } else {
    const next = selectNextCalibrationItem(
      descriptors(bank),
      observations(session),
    );
    if (!next) {
      session.status = "complete";
      session.stopReason =
        "Every available calibration item has been answered.";
      session.currentQuestionId = null;
    } else {
      session.currentQuestionId = next.selectedItemId;
    }
  }
  session.updatedAt = answeredAt;
  return knowledgeEvidenceFor(storedResponse);
}

export class FileAdaptiveCalibrationRepository {
  constructor(private readonly filePath: string) {}

  private async readStore(): Promise<CalibrationStoreFile> {
    try {
      const parsed = JSON.parse(
        await readFile(this.filePath, "utf8"),
      ) as CalibrationStoreFile;
      if (parsed.version !== 1 || !parsed.sessions)
        throw new Error("Unsupported calibration store format.");
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return structuredClone(EMPTY_STORE);
      throw error;
    }
  }

  private async writeStore(store: CalibrationStoreFile) {
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

  private async transact<T>(
    operation: (store: CalibrationStoreFile) => Promise<T> | T,
  ): Promise<T> {
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
    bank: CalibrationBankInput,
  ): Promise<{ sessionId: string; payload: AdaptiveCalibrationPayload }> {
    return this.transact(async (store) => {
      const existing = sessionId ? store.sessions[sessionId] : undefined;
      if (existing) {
        try {
          assertSessionMatchesBank(existing, bank);
          return { sessionId: existing.id, payload: toPayload(existing, bank) };
        } catch {
          // A bank version change intentionally starts a fresh calibration.
        }
      }
      const created = createStoredSession(bank);
      store.sessions[created.id] = created;
      await this.writeStore(store);
      return { sessionId: created.id, payload: toPayload(created, bank) };
    });
  }

  async answer(
    sessionId: string,
    bank: CalibrationBankInput,
    answer: { questionId: string; choiceId: string },
  ): Promise<{
    payload: AdaptiveCalibrationPayload;
    evidence: CalibrationKnowledgeEvidence | null;
  }> {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Calibration session not found.");
      assertSessionMatchesBank(session, bank);
      const previous = session.responses.find(
        (response) => response.observation.id === answer.questionId,
      );
      if (previous) {
        if (previous.selectedChoiceId !== answer.choiceId)
          throw new RangeError("This calibration item was already answered.");
        return {
          payload: toPayload(session, bank),
          evidence: knowledgeEvidenceFor(previous),
        };
      }
      const evidence = applyAnswer(session, bank, answer);
      await this.writeStore(store);
      return { payload: toPayload(session, bank), evidence };
    });
  }

  async seedRepresentative(bank: CalibrationBankInput): Promise<{
    sessionId: string;
    payload: AdaptiveCalibrationPayload;
    evidence: CalibrationKnowledgeEvidence[];
  }> {
    return this.transact(async (store) => {
      const session = createStoredSession(bank, true);
      const outcomes = [false, true, false, true, true, false, true] as const;
      const evidence: CalibrationKnowledgeEvidence[] = [];
      for (const correct of outcomes) {
        if (!session.currentQuestionId || session.status === "complete") break;
        const question = getQuestion(bank, session.currentQuestionId);
        const choiceId = correct
          ? question.correctChoiceId
          : (question.choices.find(
              (choice) => choice.id !== question.correctChoiceId,
            )?.id ?? question.correctChoiceId);
        evidence.push(
          applyAnswer(session, bank, {
            questionId: question.id,
            choiceId,
          }),
        );
      }
      store.sessions[session.id] = session;
      await this.writeStore(store);
      return {
        sessionId: session.id,
        payload: toPayload(session, bank),
        evidence,
      };
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
