import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  applyKnowledgeObservation,
  applyPracticeAttempt,
  buildLearningTwinSnapshot,
  buildDueReviews,
  calculateLearningStreak,
  createInitialKnowledgeState,
  createInitialMastery,
  learnerLevel,
  rankKnowledgeStates,
  recommendKnowledgeState,
  toPublicPracticeQuestion,
  xpForPractice,
  type DailyMissionSummary,
  type DiagnosticSkillResult,
  type LearningSessionMode,
  type LearningSessionPayload,
  type LessonContent,
  type LessonPlanContext,
  type LearningTwinEvent,
  type KnowledgeState,
  type MasteryState,
  type MistakeRecordPublic,
  type PersonalizedLessonContent,
  type PracticeFeedback,
  type PracticeQuestionSecure,
  type SkillDefinition,
} from "@act-tutor/core";

import { AuthoredLessonComposer, type LessonComposer } from "./lesson-composer";
import type { CalibrationKnowledgeEvidence } from "./adaptive-calibration-repository";

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

interface StoredMistake {
  id: string;
  questionId: string;
  skill: string;
  selectedChoiceId: string;
  attempts: number;
  createdAt: string;
  lastAttemptAt: string;
  resolvedAt: string | null;
}

interface StoredLearnerProgress {
  xp: number;
  activeDates: string[];
  longestStreak: number;
  totalCorrect: number;
  totalAnswered: number;
  completedSets: number;
  mistakes: StoredMistake[];
  diagnosticSkillResults: DiagnosticSkillResult[];
  lessonXpAwarded: boolean;
  completionXpAwarded: boolean;
}

interface StoredLearningSession {
  id: string;
  bankVersion: string;
  todaySkill: string;
  previousNextSkill: string;
  nextSkill: string;
  mode?: LearningSessionMode;
  lessonComplete: boolean;
  questionIds: string[];
  answers: StoredAnswer[];
  masteryBySkill: Record<string, MasteryState>;
  learningTwinBySkill?: Record<string, KnowledgeState>;
  learningTwinEvents?: LearningTwinEvent[];
  futureTask: LearningSessionPayload["futureTask"];
  lesson?: PersonalizedLessonContent;
  profile?: StoredLearnerProgress;
  planContext?: LessonPlanContext;
  createdAt: string;
  updatedAt: string;
}

interface LearningStoreFile {
  version: 1;
  sessions: Record<string, StoredLearningSession>;
}

const EMPTY_STORE: LearningStoreFile = { version: 1, sessions: {} };
const queues = new Map<string, Promise<void>>();
const SECTION_ORDER = { english: 0, math: 1, reading: 2 } as const;

function lessonWithoutMeta<T extends LessonContent>(
  lesson: T & { content?: unknown },
): T {
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
  if (questions.length !== 5)
    throw new RangeError(`Expected 5 practice questions for ${skill}.`);
  return questions;
}

function getSessionQuestions(
  session: StoredLearningSession,
  bank: LearningBankInput,
) {
  return session.questionIds.map((id) => {
    const question = bank.practice.find((item) => item.id === id);
    if (!question)
      throw new RangeError(`Practice question ${id} is no longer available.`);
    return question;
  });
}

function ensureProfile(session: StoredLearningSession): StoredLearnerProgress {
  session.mode ??= "focus";
  session.profile ??= {
    xp: 0,
    activeDates: [],
    longestStreak: 0,
    totalCorrect: session.answers.filter((answer) => answer.feedback.correct)
      .length,
    totalAnswered: session.answers.length,
    completedSets:
      session.answers.length === session.questionIds.length ? 1 : 0,
    mistakes: [],
    diagnosticSkillResults: [],
    lessonXpAwarded: session.lessonComplete,
    completionXpAwarded: session.answers.length === session.questionIds.length,
  };
  return session.profile;
}

function assertSessionMatchesBank(
  session: StoredLearningSession,
  bank: LearningBankInput,
) {
  if (session.bankVersion !== bank.version) {
    throw new RangeError(
      "This learning session belongs to a different content bank.",
    );
  }
  ensureProfile(session);
  const questions = getSessionQuestions(session, bank);
  ensureLearningTwin(session, bank);
  if (
    session.mode === "focus" &&
    (questions.length !== 5 ||
      questions.some((question) => question.skill !== session.todaySkill))
  ) {
    throw new RangeError(
      "This focused session belongs to different practice content.",
    );
  }
  if (
    session.mode === "repair" &&
    (questions.length !== 1 || questions[0].skill !== session.todaySkill)
  ) {
    throw new RangeError(
      "This repair session belongs to different practice content.",
    );
  }
  if (session.mode === "checkpoint" && questions.length !== 3) {
    throw new RangeError(
      "This checkpoint belongs to different practice content.",
    );
  }
}

function fallbackLesson(
  baseLesson: LessonContent,
  session: StoredLearningSession,
): PersonalizedLessonContent {
  return {
    ...baseLesson,
    depth: "foundation",
    whyAssigned: `Scout picked ${baseLesson.title.toLowerCase()} as the best skill to work on next.`,
    evidenceSummary: "Scout will use your answers to decide what comes next.",
    tutorOpening: `Let’s make ${baseLesson.title.toLowerCase()} easier, one step at a time.`,
    sections: [
      {
        id: "mental-model",
        title: "Learn the main idea",
        explanation: baseLesson.concept,
        coachPrompt: "What do you need to notice first?",
      },
      {
        id: "guided-example",
        title: "See one worked out",
        explanation: `${baseLesson.workedExample.prompt} ${baseLesson.workedExample.explanation.join(" ")}`,
        coachPrompt: `Compare your first step with the answer: ${baseLesson.workedExample.answer}.`,
      },
      {
        id: "decision-rule",
        title: "Use the rule",
        explanation: baseLesson.steps.join(" "),
        coachPrompt: "Which step prevents the common trap?",
      },
      {
        id: "transfer",
        title: "Try it yourself",
        explanation: `Watch out for this common mistake: ${baseLesson.trap}`,
        coachPrompt: "Say the rule once without looking, then try the question.",
      },
    ],
    strategyChecklist: baseLesson.steps,
    transferPrompt: `Name the ${baseLesson.title.toLowerCase()} rule before choosing an answer.`,
    generation: {
      mode: "authored-fallback",
      provider: "Reviewed lesson engine",
      model: null,
      generatedAt: session.createdAt,
    },
  };
}

function publicMistakes(
  session: StoredLearningSession,
  bank: LearningBankInput,
): MistakeRecordPublic[] {
  return ensureProfile(session)
    .mistakes.map((mistake) => {
      const question = bank.practice.find(
        (item) => item.id === mistake.questionId,
      );
      if (!question) return null;
      const skill = getSkill(bank, mistake.skill);
      return {
        id: mistake.id,
        questionId: mistake.questionId,
        skill: mistake.skill,
        skillLabel: skill.label,
        section: skill.section,
        prompt: question.prompt,
        selectedChoiceText:
          question.choices.find(
            (choice) => choice.id === mistake.selectedChoiceId,
          )?.text ?? "Previous choice",
        correctChoiceText:
          question.choices.find(
            (choice) => choice.id === question.correctChoiceId,
          )?.text ?? "Reviewed answer",
        rationale: question.rationale,
        attempts: mistake.attempts,
        createdAt: mistake.createdAt,
        resolvedAt: mistake.resolvedAt,
      } satisfies MistakeRecordPublic;
    })
    .filter((mistake): mistake is MistakeRecordPublic => mistake !== null)
    .sort((left, right) => {
      if ((left.resolvedAt === null) !== (right.resolvedAt === null))
        return left.resolvedAt === null ? -1 : 1;
      return right.createdAt.localeCompare(left.createdAt);
    })
    .slice(0, 50);
}

function missionSummary(
  session: StoredLearningSession,
  bank: LearningBankInput,
  questions: ReadonlyArray<PracticeQuestionSecure>,
): DailyMissionSummary {
  const profile = ensureProfile(session);
  const now = new Date().toISOString();
  const currentStreak = calculateLearningStreak(profile.activeDates, now);
  const level = learnerLevel(profile.xp);
  const mistakes = publicMistakes(session, bank);
  const unresolvedMistakes = mistakes.filter(
    (mistake) => mistake.resolvedAt === null,
  ).length;
  const complete = session.answers.length === questions.length;
  const learnDone = session.mode !== "focus" || session.lessonComplete;
  const practiceDone = session.mode !== "focus" || complete;
  const repairDone =
    practiceDone &&
    (unresolvedMistakes === 0 || (session.mode === "repair" && complete));
  const steps: DailyMissionSummary["steps"] = [
    {
      id: "learn",
      label: "Learn the rule",
      state: learnDone ? "done" : "current",
      progress: learnDone ? 1 : 0,
      total: 1,
    },
    {
      id: "practice",
      label: "Practice the rule",
      state: practiceDone ? "done" : learnDone ? "current" : "queued",
      progress: session.mode === "focus" ? session.answers.length : 5,
      total: 5,
    },
    {
      id: "repair",
      label: "Fix one missed question",
      state: repairDone ? "done" : practiceDone ? "current" : "queued",
      progress: repairDone ? 1 : 0,
      total: 1,
    },
    {
      id: "checkpoint",
      label: "Take a 3-question quiz",
      state:
        session.mode === "checkpoint"
          ? complete
            ? "done"
            : "current"
          : practiceDone && repairDone
            ? "current"
            : "queued",
      progress: session.mode === "checkpoint" ? session.answers.length : 0,
      total: 3,
    },
  ];
  const skillMap = Object.values(session.masteryBySkill).sort(
    (left, right) =>
      SECTION_ORDER[left.section] - SECTION_ORDER[right.section] ||
      left.mastery - right.mastery ||
      left.label.localeCompare(right.label),
  );
  return {
    progress: {
      xp: profile.xp,
      ...level,
      currentStreak,
      longestStreak: Math.max(profile.longestStreak, currentStreak),
      totalCorrect: profile.totalCorrect,
      totalAnswered: profile.totalAnswered,
      completedSets: profile.completedSets,
    },
    steps,
    dueReviews: buildDueReviews(skillMap, now),
    mistakes,
    unresolvedMistakes,
    skillMap,
    recommendedSkill: session.nextSkill,
    recommendedReason: session.futureTask.reason,
  };
}

function toPayload(
  session: StoredLearningSession,
  bank: LearningBankInput,
  lastFeedback: PracticeFeedback | null = null,
): LearningSessionPayload {
  ensureProfile(session);
  const learningTwinBySkill = ensureLearningTwin(session, bank);
  const questions = getSessionQuestions(session, bank);
  const answeredQuestionIds = session.answers.map(
    (answer) => answer.questionId,
  );
  const status =
    answeredQuestionIds.length === questions.length
      ? "complete"
      : session.lessonComplete
        ? "practice"
        : "lesson";
  const activeSkill =
    lastFeedback?.mastery.skill ??
    questions[Math.min(answeredQuestionIds.length, questions.length - 1)]
      ?.skill ??
    session.todaySkill;
  const baseLesson = getLesson(bank, session.todaySkill);
  const lesson = session.lesson ?? fallbackLesson(baseLesson, session);
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
    currentQuestionIndex: Math.min(
      answeredQuestionIds.length,
      questions.length - 1,
    ),
    mastery: session.masteryBySkill[activeSkill],
    futureTask: session.futureTask,
    status,
    updatedAt: session.updatedAt,
    lastFeedback,
    mode: session.mode ?? "focus",
    mission: missionSummary(session, bank, questions),
    learningTwin: buildLearningTwinSnapshot({
      states: Object.values(learningTwinBySkill),
      events: session.learningTwinEvents ?? [],
      preferredSkill: session.nextSkill,
    }),
  };
}

function makeInitialMasteries(
  bank: LearningBankInput,
  diagnosticSkillResults: ReadonlyArray<DiagnosticSkillResult> = [],
) {
  const diagnostics = new Map(
    diagnosticSkillResults.map((result) => [result.skill, result]),
  );
  return Object.fromEntries(
    bank.skills.map((skill) => [
      skill.slug,
      createInitialMastery(skill, diagnostics.get(skill.diagnosticSkill)),
    ]),
  );
}

function makeInitialKnowledgeStates(
  bank: LearningBankInput,
  diagnosticSkillResults: ReadonlyArray<DiagnosticSkillResult> = [],
  scoreEstimate?: number | null,
) {
  const diagnostics = new Map(
    diagnosticSkillResults.map((result) => [result.skill, result]),
  );
  return Object.fromEntries(
    bank.skills.map((skill) => [
      skill.slug,
      createInitialKnowledgeState(
        skill,
        diagnostics.get(skill.diagnosticSkill),
        scoreEstimate,
      ),
    ]),
  );
}

function ensureLearningTwin(
  session: StoredLearningSession,
  bank: LearningBankInput,
): Record<string, KnowledgeState> {
  if (session.learningTwinBySkill) {
    session.learningTwinEvents = (session.learningTwinEvents ?? []).map(
      (event) => ({ ...event, source: event.source ?? "practice" }),
    );
    return session.learningTwinBySkill;
  }

  const profile = ensureProfile(session);
  const states = makeInitialKnowledgeStates(
    bank,
    profile.diagnosticSkillResults,
    session.planContext?.currentScore,
  );
  const events: LearningTwinEvent[] = [];
  for (const answer of session.answers) {
    const question = bank.practice.find(
      (item) => item.id === answer.questionId,
    );
    if (!question) continue;
    const current = states[question.skill];
    if (!current) continue;
    const update = applyKnowledgeObservation(current, {
      questionId: question.id,
      correct: answer.feedback.correct,
      difficulty: question.difficulty,
      observedAt: answer.feedback.mastery.lastPracticedAt ?? session.updatedAt,
      source: "practice",
    });
    states[question.skill] = update.state;
    events.push(update.event);
  }
  session.learningTwinBySkill = states;
  session.learningTwinEvents = events;
  return states;
}

function recordActivity(profile: StoredLearnerProgress, now: string) {
  const date = now.slice(0, 10);
  if (!profile.activeDates.includes(date)) profile.activeDates.push(date);
  profile.activeDates = profile.activeDates.sort().slice(-90);
  profile.longestStreak = Math.max(
    profile.longestStreak,
    calculateLearningStreak(profile.activeDates, now),
  );
}

function isComplete(session: StoredLearningSession) {
  return session.answers.length === session.questionIds.length;
}

export class FileLearningSessionRepository {
  constructor(private readonly filePath: string) {}

  private async readStore(): Promise<LearningStoreFile> {
    try {
      const parsed = JSON.parse(
        await readFile(this.filePath, "utf8"),
      ) as LearningStoreFile;
      if (parsed.version !== 1 || !parsed.sessions)
        throw new Error("Unsupported learning store format.");
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return structuredClone(EMPTY_STORE);
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

  private async transact<T>(
    operation: (store: LearningStoreFile) => Promise<T> | T,
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

  async get(
    sessionId: string,
    bank: LearningBankInput,
  ): Promise<LearningSessionPayload> {
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
    const questionIds = getQuestions(bank, input.skill).map(
      (question) => question.id,
    );
    return this.transact(async (store) => {
      const existing = sessionId ? store.sessions[sessionId] : undefined;
      if (existing) {
        try {
          const needsLearningTwinMigration =
            !existing.planContext || !existing.learningTwinBySkill;
          existing.planContext ??= input.plan;
          assertSessionMatchesBank(existing, bank);
          if (needsLearningTwinMigration) await this.writeStore(store);
          return {
            sessionId: existing.id,
            payload: toPayload(
              existing,
              bank,
              existing.answers.at(-1)?.feedback ?? null,
            ),
          };
        } catch {
          // A bank change intentionally starts a new learner profile.
        }
      }
      const now = new Date().toISOString();
      const masteryBySkill = makeInitialMasteries(
        bank,
        input.diagnosticSkillResults,
      );
      const learningTwinBySkill = makeInitialKnowledgeStates(
        bank,
        input.diagnosticSkillResults,
        input.plan.currentScore,
      );
      const initialRecommendation = recommendKnowledgeState(
        Object.values(learningTwinBySkill),
        input.skill,
      );
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
        previousNextSkill: input.skill,
        nextSkill: initialRecommendation.skill,
        mode: "focus",
        lessonComplete: false,
        questionIds,
        answers: [],
        masteryBySkill,
        learningTwinBySkill,
        learningTwinEvents: [],
        futureTask: {
          todaySkill: input.skill,
          nextSkill: initialRecommendation.skill,
          changed: initialRecommendation.skill !== input.skill,
          reason: initialRecommendation.reason,
        },
        lesson,
        profile: {
          xp: 0,
          activeDates: [],
          longestStreak: 0,
          totalCorrect: 0,
          totalAnswered: 0,
          completedSets: 0,
          mistakes: [],
          diagnosticSkillResults: [...(input.diagnosticSkillResults ?? [])],
          lessonXpAwarded: false,
          completionXpAwarded: false,
        },
        planContext: input.plan,
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
      if (session.mode !== "focus")
        throw new RangeError("This mission does not contain a lesson.");
      const profile = ensureProfile(session);
      const now = new Date().toISOString();
      session.lessonComplete = true;
      if (!profile.lessonXpAwarded) {
        profile.xp += 20;
        profile.lessonXpAwarded = true;
      }
      recordActivity(profile, now);
      session.updatedAt = now;
      await this.writeStore(store);
      return toPayload(session, bank, session.answers.at(-1)?.feedback ?? null);
    });
  }

  async beginFocus(
    sessionId: string,
    bank: LearningBankInput,
    input: { skill?: string; plan: LessonPlanContext },
    lessonComposer: LessonComposer = new AuthoredLessonComposer(),
  ) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      if (!isComplete(session))
        throw new RangeError(
          "Finish the current mission before switching skills.",
        );
      const profile = ensureProfile(session);
      const skillSlug = input.skill ?? session.nextSkill;
      const skill = getSkill(bank, skillSlug);
      const lesson = await lessonComposer.compose({
        baseLesson: getLesson(bank, skillSlug),
        skill,
        diagnosticSkillResults: profile.diagnosticSkillResults,
        plan: input.plan,
      });
      session.todaySkill = skillSlug;
      session.previousNextSkill = session.nextSkill;
      session.nextSkill = skillSlug;
      session.mode = "focus";
      session.lessonComplete = false;
      session.questionIds = getQuestions(bank, skillSlug).map(
        (question) => question.id,
      );
      session.answers = [];
      session.lesson = lesson;
      session.planContext = input.plan;
      profile.lessonXpAwarded = false;
      profile.completionXpAwarded = false;
      session.futureTask = {
        todaySkill: skillSlug,
        nextSkill: skillSlug,
        changed: false,
        reason: `${skill.label} needs the next practice round.`,
      };
      session.updatedAt = new Date().toISOString();
      await this.writeStore(store);
      return toPayload(session, bank);
    });
  }

  async beginRepair(
    sessionId: string,
    bank: LearningBankInput,
    mistakeId: string,
  ) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      if (!isComplete(session))
        throw new RangeError(
          "Finish your current task before retrying a missed question.",
        );
      const profile = ensureProfile(session);
      const mistake = profile.mistakes.find(
        (item) => item.id === mistakeId && item.resolvedAt === null,
      );
      if (!mistake)
        throw new RangeError(
          "That missed question was already fixed or is no longer available.",
        );
      getSkill(bank, mistake.skill);
      const question = bank.practice.find(
        (item) => item.id === mistake.questionId,
      );
      if (!question)
        throw new RangeError("That practice question is unavailable.");
      session.todaySkill = mistake.skill;
      session.mode = "repair";
      session.lessonComplete = true;
      session.questionIds = [question.id];
      session.answers = [];
      session.lesson = undefined;
      profile.lessonXpAwarded = true;
      profile.completionXpAwarded = false;
      session.updatedAt = new Date().toISOString();
      await this.writeStore(store);
      return toPayload(session, bank);
    });
  }

  async beginCheckpoint(sessionId: string, bank: LearningBankInput) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      if (!isComplete(session))
        throw new RangeError(
          "Finish your current task before starting a progress check.",
        );
      const ranked = rankKnowledgeStates(
        Object.values(ensureLearningTwin(session, bank)),
        session.nextSkill,
      ).slice(0, 3);
      if (ranked.length < 3)
        throw new RangeError(
          "At least three skills are needed for a progress check.",
        );
      const questionIds = ranked.map((mastery, index) => {
        const questions = getQuestions(bank, mastery.skill);
        return questions[
          (ensureProfile(session).completedSets + index) % questions.length
        ].id;
      });
      const profile = ensureProfile(session);
      session.todaySkill = ranked[0].skill;
      session.mode = "checkpoint";
      session.lessonComplete = true;
      session.questionIds = questionIds;
      session.answers = [];
      session.lesson = undefined;
      profile.lessonXpAwarded = true;
      profile.completionXpAwarded = false;
      session.updatedAt = new Date().toISOString();
      await this.writeStore(store);
      return toPayload(session, bank);
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
      if (!session.lessonComplete)
        throw new RangeError("Complete the lesson before practice.");
      const previous = session.answers.find(
        (item) => item.questionId === answer.questionId,
      );
      if (previous) {
        if (previous.selectedChoiceId !== answer.choiceId)
          throw new RangeError("This practice question was already answered.");
        return toPayload(session, bank, previous.feedback);
      }
      const questions = getSessionQuestions(session, bank);
      const expectedQuestion = questions[session.answers.length];
      if (!expectedQuestion || expectedQuestion.id !== answer.questionId)
        throw new RangeError("Practice questions must be answered in order.");
      if (
        !expectedQuestion.choices.some(
          (choice) => choice.id === answer.choiceId,
        )
      )
        throw new RangeError("Unknown practice choice.");
      const selectedChoice = expectedQuestion.choices.find(
        (choice) => choice.id === answer.choiceId,
      );
      const correct = answer.choiceId === expectedQuestion.correctChoiceId;
      const now = new Date().toISOString();
      const profile = ensureProfile(session);
      const updated = applyPracticeAttempt(
        session.masteryBySkill[expectedQuestion.skill],
        {
          skill: expectedQuestion.skill,
          correct,
          difficulty: expectedQuestion.difficulty,
          answeredAt: now,
        },
      );
      session.masteryBySkill[expectedQuestion.skill] = updated.mastery;
      const learningTwinBySkill = ensureLearningTwin(session, bank);
      const twinUpdate = applyKnowledgeObservation(
        learningTwinBySkill[expectedQuestion.skill],
        {
          questionId: expectedQuestion.id,
          correct,
          difficulty: expectedQuestion.difficulty,
          observedAt: now,
          source: "practice",
        },
      );
      learningTwinBySkill[expectedQuestion.skill] = twinUpdate.state;
      session.learningTwinEvents = [
        ...(session.learningTwinEvents ?? []),
        twinUpdate.event,
      ].slice(-100);
      const previousRecommendation = session.nextSkill;
      const recommendation = recommendKnowledgeState(
        Object.values(learningTwinBySkill),
        session.todaySkill,
      );
      const futureTask = {
        todaySkill: session.todaySkill,
        nextSkill: recommendation.skill,
        changed: recommendation.skill !== previousRecommendation,
        reason: recommendation.reason,
      };
      session.previousNextSkill = previousRecommendation;
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
      profile.totalAnswered += 1;
      if (correct) profile.totalCorrect += 1;
      profile.xp += xpForPractice(correct, expectedQuestion.difficulty);
      recordActivity(profile, now);
      const openMistake = profile.mistakes.find(
        (item) =>
          item.questionId === expectedQuestion.id && item.resolvedAt === null,
      );
      if (correct && openMistake) {
        openMistake.resolvedAt = now;
        openMistake.lastAttemptAt = now;
        openMistake.attempts += 1;
        if (session.mode === "repair") profile.xp += 15;
      } else if (!correct) {
        if (openMistake) {
          openMistake.selectedChoiceId = answer.choiceId;
          openMistake.lastAttemptAt = now;
          openMistake.attempts += 1;
        } else {
          profile.mistakes.push({
            id: randomUUID(),
            questionId: expectedQuestion.id,
            skill: expectedQuestion.skill,
            selectedChoiceId: answer.choiceId,
            attempts: 1,
            createdAt: now,
            lastAttemptAt: now,
            resolvedAt: null,
          });
          profile.mistakes = profile.mistakes.slice(-100);
        }
      }
      if (
        session.answers.length === questions.length &&
        !profile.completionXpAwarded
      ) {
        profile.xp += session.mode === "checkpoint" ? 35 : 25;
        profile.completedSets += 1;
        profile.completionXpAwarded = true;
      }
      await this.writeStore(store);
      return toPayload(session, bank, feedback);
    });
  }

  async recordCalibrationEvidence(
    sessionId: string,
    bank: LearningBankInput,
    evidence: CalibrationKnowledgeEvidence,
  ): Promise<LearningSessionPayload> {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      const skill = getSkill(bank, evidence.skill);
      const twinEvents = session.learningTwinEvents ?? [];
      const alreadyRecorded = twinEvents.some(
        (event) =>
          event.questionId === evidence.questionId &&
          event.source === "calibration" &&
          event.observedAt === evidence.observedAt,
      );
      if (alreadyRecorded) return toPayload(session, bank);

      const learningTwinBySkill = ensureLearningTwin(session, bank);
      const current = learningTwinBySkill[skill.slug];
      if (!current)
        throw new RangeError(
          `Learning Twin state is missing for ${skill.label}.`,
        );
      const update = applyKnowledgeObservation(current, {
        questionId: evidence.questionId,
        correct: evidence.correct,
        difficulty: evidence.difficulty,
        observedAt: evidence.observedAt,
        source: "calibration",
      });
      learningTwinBySkill[skill.slug] = update.state;
      session.learningTwinEvents = [...twinEvents, update.event].slice(-100);

      const previousRecommendation = session.nextSkill;
      const recommendation = recommendKnowledgeState(
        Object.values(learningTwinBySkill),
        session.todaySkill,
      );
      session.previousNextSkill = previousRecommendation;
      session.nextSkill = recommendation.skill;
      session.futureTask = {
        todaySkill: session.todaySkill,
        nextSkill: recommendation.skill,
        changed: recommendation.skill !== previousRecommendation,
        reason: recommendation.reason,
      };
      session.updatedAt = evidence.observedAt;
      await this.writeStore(store);
      return toPayload(session, bank);
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
