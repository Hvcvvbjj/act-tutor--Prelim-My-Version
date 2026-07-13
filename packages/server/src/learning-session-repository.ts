import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  applyPracticeAttempt,
  createInitialMastery,
  decideFutureTask,
  toPublicPracticeQuestion,
  type DiagnosticSkillResult,
  type LearningSessionPayload,
  type LessonContent,
  type LessonPlanContext,
  type MasteryState,
  type PersonalizedLessonContent,
  type PracticeFeedback,
  type PracticeQuestionSecure,
  type SkillDefinition,
} from "@act-tutor/core";

import {
  AuthoredLessonComposer,
  type LessonComposer,
} from "./lesson-composer";

export interface LearningBankInput {
  version: string;
  skills: ReadonlyArray<SkillDefinition>;
  lessons: ReadonlyArray<LessonContent>;
  practice: ReadonlyArray<PracticeQuestionSecure>;
}

export interface StartLearningSessionInput {
  skill: string;
  diagnosticSkillResults?: ReadonlyArray<DiagnosticSkillResult>;
  plan: LessonPlanContext;
}

interface StoredAnswer {
  questionId: string;
  selectedChoiceId: string;
  feedback: PracticeFeedback;
}

interface StoredLearningSession {
  id: string;
  bankVersion: string;
  todaySkill: string;
  previousNextSkill: string;
  nextSkill: string;
  lessonComplete: boolean;
  questionIds: string[];
  answers: StoredAnswer[];
  masteryBySkill: Record<string, MasteryState>;
  futureTask: LearningSessionPayload["futureTask"];
  lesson?: PersonalizedLessonContent;
  createdAt: string;
  updatedAt: string;
}

interface LearningStoreFile {
  version: 1;
  sessions: Record<string, StoredLearningSession>;
}

const EMPTY_STORE: LearningStoreFile = { version: 1, sessions: {} };
const queues = new Map<string, Promise<void>>();

function lessonWithoutMeta<T extends LessonContent>(lesson: T & { content?: unknown }): T {
  const { content: _content, ...publicLesson } = lesson;
  return publicLesson as T;
}

function getSkill(bank: LearningBankInput, slug: string) {
  const skill = bank.skills.find((item) => item.slug === slug);
  if (!skill) throw new RangeError(`Unknown learning skill: ${slug}.`);
  return skill;
}

function getLesson(bank: LearningBankInput, skill: string) {
  const lesson = bank.lessons.find((item) => item.skill === skill);
  if (!lesson) throw new RangeError(`Missing lesson for ${skill}.`);
  return lesson;
}

function getQuestions(bank: LearningBankInput, skill: string) {
  const questions = bank.practice.filter((item) => item.skill === skill);
  if (questions.length !== 5) throw new RangeError(`Expected 5 practice questions for ${skill}.`);
  return questions;
}

function assertSessionMatchesBank(session: StoredLearningSession, bank: LearningBankInput) {
  if (session.bankVersion !== bank.version) {
    throw new RangeError("This learning session belongs to a different content bank.");
  }
  const currentQuestionIds = getQuestions(bank, session.todaySkill).map((question) => question.id);
  if (
    session.questionIds.length !== currentQuestionIds.length ||
    session.questionIds.some((id, index) => id !== currentQuestionIds[index])
  ) {
    throw new RangeError("This learning session belongs to different practice content.");
  }
}

function toPayload(
  session: StoredLearningSession,
  bank: LearningBankInput,
  lastFeedback: PracticeFeedback | null = null,
): LearningSessionPayload {
  const baseLesson = getLesson(bank, session.todaySkill);
  const lesson =
    session.lesson ??
    {
      ...baseLesson,
      depth: "foundation",
      whyAssigned: `${baseLesson.title} is the current assigned focus.`,
      evidenceSummary: "This session predates personalized lesson generation.",
      tutorOpening: `Let’s make ${baseLesson.title.toLowerCase()} predictable.`,
      sections: [
        {
          id: "mental-model",
          title: "Build the mental model",
          explanation: baseLesson.concept,
          coachPrompt: "What do you need to notice first?",
        },
        {
          id: "guided-example",
          title: "Work one with Scout",
          explanation: `${baseLesson.workedExample.prompt} ${baseLesson.workedExample.explanation.join(" ")}`,
          coachPrompt: `Compare your first step with the answer: ${baseLesson.workedExample.answer}.`,
        },
        {
          id: "decision-rule",
          title: "Use the decision rule",
          explanation: baseLesson.steps.join(" "),
          coachPrompt: "Which step prevents the common trap?",
        },
        {
          id: "transfer",
          title: "Transfer it",
          explanation: baseLesson.trap,
          coachPrompt: "Say the rule once without looking.",
        },
      ],
      strategyChecklist: baseLesson.steps,
      transferPrompt: `Identify the ${baseLesson.title.toLowerCase()} decision before choosing an answer.`,
      generation: {
        mode: "authored-fallback",
        provider: "Reviewed lesson engine",
        model: null,
        generatedAt: session.createdAt,
      },
    } satisfies PersonalizedLessonContent;
  const questions = getQuestions(bank, session.todaySkill);
  const answeredQuestionIds = session.answers.map((answer) => answer.questionId);
  const status =
    answeredQuestionIds.length === questions.length
      ? "complete"
      : session.lessonComplete
        ? "practice"
        : "lesson";

  return {
    sessionId: session.id,
    bankVersion: session.bankVersion,
    todaySkill: session.todaySkill,
    previousNextSkill: session.previousNextSkill,
    nextSkill: session.nextSkill,
    lesson: lessonWithoutMeta(lesson),
    lessonComplete: session.lessonComplete,
    questions: questions.map(toPublicPracticeQuestion),
    answeredQuestionIds,
    currentQuestionIndex: Math.min(answeredQuestionIds.length, questions.length - 1),
    mastery: session.masteryBySkill[session.todaySkill],
    futureTask: session.futureTask,
    status,
    updatedAt: session.updatedAt,
    lastFeedback,
  };
}

function makeInitialMasteries(
  bank: LearningBankInput,
  diagnosticSkillResults: ReadonlyArray<DiagnosticSkillResult> = [],
) {
  const diagnostics = new Map(diagnosticSkillResults.map((result) => [result.skill, result]));
  return Object.fromEntries(
    bank.skills.map((skill) => [
      skill.slug,
      createInitialMastery(skill, diagnostics.get(skill.diagnosticSkill)),
    ]),
  );
}

export class FileLearningSessionRepository {
  constructor(private readonly filePath: string) {}

  private async readStore(): Promise<LearningStoreFile> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as LearningStoreFile;
      if (parsed.version !== 1 || !parsed.sessions) {
        throw new Error("Unsupported learning store format.");
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY_STORE);
      throw error;
    }
  }

  private async writeStore(store: LearningStoreFile) {
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

  private async transact<T>(operation: (store: LearningStoreFile) => Promise<T> | T): Promise<T> {
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

  async get(sessionId: string, bank: LearningBankInput): Promise<LearningSessionPayload> {
    return this.transact((store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      return toPayload(session, bank, session.answers.at(-1)?.feedback ?? null);
    });
  }

  async getOrCreate(
    sessionId: string | null,
    bank: LearningBankInput,
    input: StartLearningSessionInput,
    lessonComposer: LessonComposer = new AuthoredLessonComposer(),
  ): Promise<{ sessionId: string; payload: LearningSessionPayload }> {
    getSkill(bank, input.skill);
    const questionIds = getQuestions(bank, input.skill).map((question) => question.id);

    return this.transact(async (store) => {
      const existing = sessionId ? store.sessions[sessionId] : undefined;
      if (existing && existing.todaySkill === input.skill) {
        try {
          assertSessionMatchesBank(existing, bank);
          return {
            sessionId: existing.id,
            payload: toPayload(existing, bank, existing.answers.at(-1)?.feedback ?? null),
          };
        } catch {
          // Content changes intentionally start a new session.
        }
      }

      const now = new Date().toISOString();
      const masteryBySkill = makeInitialMasteries(bank, input.diagnosticSkillResults);
      const nextSkill = input.skill;
      const lesson = await lessonComposer.compose({
        baseLesson: getLesson(bank, input.skill),
        skill: getSkill(bank, input.skill),
        diagnosticSkillResults: input.diagnosticSkillResults ?? [],
        plan: input.plan,
      });
      const created: StoredLearningSession = {
        id: randomUUID(),
        bankVersion: bank.version,
        todaySkill: input.skill,
        previousNextSkill: nextSkill,
        nextSkill,
        lessonComplete: false,
        questionIds,
        answers: [],
        masteryBySkill,
        futureTask: {
          todaySkill: input.skill,
          nextSkill,
          changed: false,
          reason: `${getSkill(bank, input.skill).label} is today's assigned focus.`,
        },
        lesson,
        createdAt: now,
        updatedAt: now,
      };
      store.sessions[created.id] = created;
      await this.writeStore(store);
      return { sessionId: created.id, payload: toPayload(created, bank) };
    });
  }

  async completeLesson(
    sessionId: string,
    bank: LearningBankInput,
  ): Promise<LearningSessionPayload> {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      session.lessonComplete = true;
      session.updatedAt = new Date().toISOString();
      await this.writeStore(store);
      return toPayload(session, bank, session.answers.at(-1)?.feedback ?? null);
    });
  }

  async answerQuestion(
    sessionId: string,
    bank: LearningBankInput,
    answer: { questionId: string; choiceId: string },
  ): Promise<LearningSessionPayload> {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      if (!session.lessonComplete) throw new RangeError("Complete the lesson before practice.");

      const previous = session.answers.find((item) => item.questionId === answer.questionId);
      if (previous) {
        if (previous.selectedChoiceId !== answer.choiceId) {
          throw new RangeError("This practice question was already answered.");
        }
        return toPayload(session, bank, previous.feedback);
      }

      const questions = getQuestions(bank, session.todaySkill);
      const expectedQuestion = questions[session.answers.length];
      if (!expectedQuestion || expectedQuestion.id !== answer.questionId) {
        throw new RangeError("Practice questions must be answered in order.");
      }
      if (!expectedQuestion.choices.some((choice) => choice.id === answer.choiceId)) {
        throw new RangeError("Unknown practice choice.");
      }

      const selectedChoice = expectedQuestion.choices.find((choice) => choice.id === answer.choiceId);
      const correct = answer.choiceId === expectedQuestion.correctChoiceId;
      const now = new Date().toISOString();
      const updated = applyPracticeAttempt(session.masteryBySkill[session.todaySkill], {
        skill: session.todaySkill,
        correct,
        difficulty: expectedQuestion.difficulty,
        answeredAt: now,
      });
      session.masteryBySkill[session.todaySkill] = updated.mastery;
      const futureTask = decideFutureTask(
        session.todaySkill,
        session.previousNextSkill,
        Object.values(session.masteryBySkill),
      );
      session.nextSkill = futureTask.nextSkill;
      session.futureTask = futureTask;
      session.updatedAt = now;

      const feedback: PracticeFeedback = {
        questionId: expectedQuestion.id,
        selectedChoiceId: answer.choiceId,
        correctChoiceId: expectedQuestion.correctChoiceId,
        correct,
        rationale: expectedQuestion.rationale,
        misconception: selectedChoice?.misconception ?? null,
        mastery: updated.mastery,
        review: updated.review,
        futureTask,
      };
      session.answers.push({
        questionId: answer.questionId,
        selectedChoiceId: answer.choiceId,
        feedback,
      });
      await this.writeStore(store);
      return toPayload(session, bank, feedback);
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
