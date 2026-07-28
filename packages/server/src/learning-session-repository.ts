import { randomUUID } from "node:crypto";

import {
  applyLearnerModelCorrection,
  applyKnowledgeObservation,
  applyPracticeAttempt,
  answerEvidenceWeight,
  buildLearningTwinSnapshot,
  buildDueReviews,
  calculateLearningStreak,
  chooseNextSkill,
  createInitialKnowledgeState,
  createInitialMastery,
  learnerLevel,
  LEARNING_TWIN_MODEL,
  rankKnowledgeStates,
  recommendKnowledgeState,
  toPublicPracticeQuestion,
  xpForPractice,
  type DailyMissionSummary,
  type AnswerConfidence,
  type CoachBrief,
  type DiagnosticSkillResult,
  type LearningCycleState,
  type LearningSessionMode,
  type LearningSessionPayload,
  type LearningDecisionEvent,
  type LearningAnswerCommand,
  type LessonContent,
  type LessonPlanContext,
  type LearningTwinEvent,
  type KnowledgeState,
  type MasteryState,
  type MistakeRecordPublic,
  type PersonalizedLessonContent,
  type PlanCounterfactual,
  type PracticeFeedback,
  type PracticeQuestionSecure,
  type SkillDefinition,
  type LearnerModelCorrection,
  type TeachBackResult,
} from "@act-tutor/core";

import { AuthoredLessonComposer, type LessonComposer } from "./lesson-composer";
import type { CalibrationKnowledgeEvidence } from "./adaptive-calibration-repository";
import {
  AtomicJsonRepository,
  type JsonDocumentStore,
} from "./atomic-json-repository";

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

export interface RebaseLearningSessionInput {
  calibrationKey: string;
  diagnosticSkillResults: ReadonlyArray<DiagnosticSkillResult>;
  plan: LessonPlanContext;
  baselineLabel?: "Quick Check" | "Full diagnostic";
  replaceLearningTwin?: boolean;
}

export interface ApplyLearningRoundAssessmentInput {
  assessmentKey: string;
  diagnosticSkillResults: ReadonlyArray<DiagnosticSkillResult>;
  plan: LessonPlanContext;
}

const MAX_ROUND_ASSESSMENT_SKILLS = 24;
const MAX_ROUND_ASSESSMENT_QUESTIONS = 200;

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
  misconception?: string | null;
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
  exposureByQuestion?: Record<string, number>;
  missesByQuestion?: Record<string, number>;
  modelCorrections?: LearnerModelCorrection[];
  teachBackBySkill?: Record<string, TeachBackResult>;
  lessonFeedbackBySkill?: Record<
    string,
    { helpful: number; unhelpful: number; preferredStyle: string | null }
  >;
}

interface StoredLearningSession {
  id: string;
  bankVersion: string;
  todaySkill: string;
  previousNextSkill: string;
  nextSkill: string;
  cycle?: LearningCycleState;
  mode?: LearningSessionMode;
  lessonComplete: boolean;
  questionIds: string[];
  answers: StoredAnswer[];
  masteryBySkill: Record<string, MasteryState>;
  learningTwinBySkill?: Record<string, KnowledgeState>;
  learningTwinEvents?: LearningTwinEvent[];
  decisionHistory?: LearningDecisionEvent[];
  futureTask: LearningSessionPayload["futureTask"];
  lesson?: PersonalizedLessonContent;
  lessonEvidenceSnapshot?: {
    lessonId: string;
    capturedAt: string;
    evidenceQuestionIds: string[];
  };
  profile?: StoredLearnerProgress;
  planContext?: LessonPlanContext;
  repairMistakeId?: string | null;
  returnSkillAfterPrerequisite?: string | null;
  calibrationRebaseKey?: string;
  appliedAssessmentKeys?: string[];
  processedAnswerCommands?: Record<
    string,
    { questionId: string; choiceId: string }
  >;
  createdAt: string;
  updatedAt: string;
}

interface LearningStoreFile {
  version: 1;
  sessions: Record<string, StoredLearningSession>;
}

const EMPTY_STORE: LearningStoreFile = { version: 1, sessions: {} };
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

function canonicalSkillSlugs(bank: LearningBankInput) {
  const requiredSkills = bank.skills.map((skill) => skill.slug);
  if (requiredSkills.length === 0) {
    throw new RangeError("The learning bank must contain at least one skill.");
  }
  if (new Set(requiredSkills).size !== requiredSkills.length) {
    throw new RangeError("Learning skill slugs must be unique.");
  }
  return requiredSkills;
}

function firstUncompletedFoundationSkill(cycle: LearningCycleState) {
  const completed = new Set(cycle.completedSkills);
  return cycle.requiredSkills.find((skill) => !completed.has(skill)) ?? null;
}

function ensureCycle(
  session: StoredLearningSession,
  bank: LearningBankInput,
): { cycle: LearningCycleState; migrated: boolean } {
  if (session.cycle) return { cycle: session.cycle, migrated: false };

  const requiredSkills = canonicalSkillSlugs(bank);
  const legacyMode = session.mode ?? "focus";
  const currentMissionComplete =
    session.questionIds.length > 0 &&
    session.answers.length === session.questionIds.length;
  const completedSkills =
    legacyMode === "focus" && currentMissionComplete
      ? [session.todaySkill]
      : [];
  const firstRemaining =
    requiredSkills.find((skill) => !completedSkills.includes(skill)) ?? null;
  const nextSkill =
    legacyMode === "focus" && !currentMissionComplete
      ? session.todaySkill
      : firstRemaining;
  const cycle: LearningCycleState = {
    roundNumber: 1,
    kind: "foundation",
    status: nextSkill ? "lessons" : "assessment-choice",
    requiredSkills,
    completedSkills,
    nextSkill,
  };
  session.cycle = cycle;
  if (legacyMode === "focus") session.mode = "foundation";
  session.previousNextSkill = session.nextSkill;
  session.nextSkill = nextSkill ?? session.todaySkill;
  session.futureTask = {
    todaySkill: session.todaySkill,
    nextSkill: session.nextSkill,
    changed: session.nextSkill !== session.previousNextSkill,
    reason: nextSkill
      ? `Continue round 1 with ${getSkill(bank, nextSkill).label}.`
      : "Round 1 is complete. Choose the next assessment with Mr. Kim.",
  };
  return { cycle, migrated: true };
}

function advanceFoundationCycle(
  session: StoredLearningSession,
  bank: LearningBankInput,
) {
  const { cycle } = ensureCycle(session, bank);
  if (cycle.kind !== "foundation" || cycle.status !== "lessons") return cycle;
  if (!cycle.requiredSkills.includes(session.todaySkill)) {
    throw new RangeError(
      "The current skill is not part of the foundation curriculum.",
    );
  }
  if (!cycle.completedSkills.includes(session.todaySkill)) {
    cycle.completedSkills = [...cycle.completedSkills, session.todaySkill];
  }
  cycle.nextSkill = firstUncompletedFoundationSkill(cycle);
  cycle.status = cycle.nextSkill ? "lessons" : "assessment-choice";
  return cycle;
}

function advanceAdaptiveCycle(
  session: StoredLearningSession,
  bank: LearningBankInput,
) {
  const { cycle } = ensureCycle(session, bank);
  if (cycle.kind !== "adaptive" || cycle.status !== "lessons") return cycle;
  if (!cycle.requiredSkills.includes(session.todaySkill)) {
    throw new RangeError(
      "The current skill is not part of this adaptive lesson round.",
    );
  }
  if (!cycle.completedSkills.includes(session.todaySkill)) {
    cycle.completedSkills = [...cycle.completedSkills, session.todaySkill];
  }
  const completed = new Set(cycle.completedSkills);
  cycle.nextSkill =
    cycle.requiredSkills.find((skill) => !completed.has(skill)) ?? null;
  cycle.status = cycle.nextSkill ? "lessons" : "assessment-choice";
  return cycle;
}

function masteryBand(mastery: number, evidence: number) {
  if (evidence < 1) return "new" as const;
  if (mastery >= 0.82 && evidence >= 6) return "secure" as const;
  if (mastery >= 0.68 && evidence >= 4) return "steady" as const;
  return "building" as const;
}

function mergeAssessmentMastery(
  state: MasteryState,
  result: DiagnosticSkillResult,
) {
  const alpha = state.alpha + result.correct;
  const beta = state.beta + result.total - result.correct;
  const evidence = state.evidence + result.total;
  const mastery = alpha / (alpha + beta);
  return {
    ...state,
    alpha,
    beta,
    evidence,
    mastery,
    band: masteryBand(mastery, evidence),
  };
}

function adaptiveRoundSkills(
  bank: LearningBankInput,
  diagnosticSkillResults: ReadonlyArray<DiagnosticSkillResult>,
  states: Record<string, KnowledgeState>,
) {
  const rankedFromAssessment = [...diagnosticSkillResults]
    .filter((result) => result.total > 0)
    .sort(
      (left, right) =>
        left.accuracy - right.accuracy ||
        right.total - left.total ||
        left.label.localeCompare(right.label),
    )
    .flatMap((result) => {
      const skill = bank.skills.find(
        (candidate) => candidate.diagnosticSkill === result.skill,
      );
      return skill ? [skill.slug] : [];
    });
  const fallback = rankKnowledgeStates(Object.values(states)).map(
    (state) => state.skill,
  );
  return finiteRoundSkillsWithCoverage(bank, [
    ...rankedFromAssessment,
    ...fallback,
  ]);
}

function finiteRoundSkillsWithCoverage(
  bank: LearningBankInput,
  rankedCandidates: ReadonlyArray<string>,
) {
  const candidates = rankedCandidates.filter(
    (skill, index, all) =>
      all.indexOf(skill) === index &&
      bank.skills.some((candidate) => candidate.slug === skill),
  );
  const limit = Math.min(6, bank.skills.length);
  const selected = candidates.slice(0, limit);

  for (const section of ["english", "math", "reading"] as const) {
    if (selected.some((skill) => getSkill(bank, skill).section === section)) {
      continue;
    }
    const missingSectionSkill = candidates.find(
      (skill) => getSkill(bank, skill).section === section,
    );
    if (!missingSectionSkill) continue;
    if (selected.length < limit) {
      selected.push(missingSectionSkill);
      continue;
    }
    let replacementIndex = -1;
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      const skill = selected[index];
      const selectedSection = getSkill(bank, skill).section;
      if (
        selectedSection !== section &&
        selected.filter(
          (candidate) => getSkill(bank, candidate).section === selectedSection,
        ).length > 1
      ) {
        replacementIndex = index;
        break;
      }
    }
    if (replacementIndex >= 0) {
      selected[replacementIndex] = missingSectionSkill;
    }
  }

  return selected.sort(
    (left, right) => candidates.indexOf(left) - candidates.indexOf(right),
  );
}

function scoreContextChanged(
  previous: LessonPlanContext | undefined,
  next: LessonPlanContext,
) {
  if (!previous) return false;
  if (previous.scoreEvidenceKey !== next.scoreEvidenceKey) return true;
  if (previous.currentScore !== next.currentScore) return true;
  const previousSections = previous.sectionScores;
  const nextSections = next.sectionScores;
  if (!previousSections && !nextSections) return false;
  if (!previousSections || !nextSections) return true;
  return (
    previousSections.english !== nextSections.english ||
    previousSections.math !== nextSections.math ||
    previousSections.reading !== nextSections.reading
  );
}

function scoreDrivenRoundSkills(
  bank: LearningBankInput,
  states: Record<string, KnowledgeState>,
  plan: LessonPlanContext,
) {
  const knowledgeRank = rankKnowledgeStates(Object.values(states));
  const rankIndex = new Map(
    knowledgeRank.map((state, index) => [state.skill, index]),
  );
  const sectionGap = (state: KnowledgeState) =>
    plan.sectionScores
      ? Math.max(0, plan.goalScore - plan.sectionScores[state.section])
      : Math.max(0, plan.goalScore - plan.currentScore);
  const ranked = [...knowledgeRank]
    .sort(
      (left, right) =>
        sectionGap(right) - sectionGap(left) ||
        (rankIndex.get(left.skill) ?? 0) - (rankIndex.get(right.skill) ?? 0),
    )
    .map((state) => state.skill);
  return finiteRoundSkillsWithCoverage(bank, ranked);
}

async function composeLearningLesson(input: {
  bank: LearningBankInput;
  skillSlug: string;
  diagnosticSkillResults: ReadonlyArray<DiagnosticSkillResult>;
  plan: LessonPlanContext;
  lessonComposer: LessonComposer;
  foundation: boolean;
}) {
  const lesson = await input.lessonComposer.compose({
    baseLesson: getLesson(input.bank, input.skillSlug),
    skill: getSkill(input.bank, input.skillSlug),
    diagnosticSkillResults: input.foundation
      ? []
      : input.diagnosticSkillResults,
    plan: input.plan,
  });
  if (!input.foundation) return lesson;
  return {
    ...lesson,
    depth: "foundation" as const,
    whyAssigned:
      "Round 1 teaches every ACT question type in the curriculum before Scout specializes your later rounds.",
    evidenceSummary: input.diagnosticSkillResults.length
      ? "Your starting check shaped Scout’s first estimates. It does not remove any Round 1 lesson."
      : "Scout will teach every question type in Round 1, then use your measured results to specialize later rounds.",
  };
}

function leastExposedQuestions(
  bank: LearningBankInput,
  profile: StoredLearnerProgress,
  skill: string,
  count: number,
  options: { exclude?: string; preferHard?: boolean } = {},
) {
  const exposure = profile.exposureByQuestion ?? {};
  return getQuestions(bank, skill)
    .filter((question) => question.id !== options.exclude)
    .sort((left, right) => {
      const exposureGap = (exposure[left.id] ?? 0) - (exposure[right.id] ?? 0);
      if (exposureGap !== 0) return exposureGap;
      if (options.preferHard) {
        const rank = { hard: 0, medium: 1, easy: 2 } as const;
        const difficultyGap = rank[left.difficulty] - rank[right.difficulty];
        if (difficultyGap !== 0) return difficultyGap;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, count);
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
    exposureByQuestion: {},
    missesByQuestion: {},
    modelCorrections: [],
    teachBackBySkill: {},
    lessonFeedbackBySkill: {},
  };
  session.profile.exposureByQuestion ??= {};
  session.profile.missesByQuestion ??= {};
  session.profile.modelCorrections ??= [];
  session.profile.teachBackBySkill ??= {};
  session.profile.lessonFeedbackBySkill ??= {};
  session.decisionHistory ??= [];
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
  ensureCycle(session, bank);
  const questions = getSessionQuestions(session, bank);
  ensureLearningTwin(session, bank);
  if (
    (session.mode === "foundation" || session.mode === "focus") &&
    (questions.length !== 5 ||
      questions.some((question) => question.skill !== session.todaySkill))
  ) {
    throw new RangeError(
      "This focused session belongs to different practice content.",
    );
  }
  if (
    session.mode === "micro" &&
    (questions.length !== 1 || questions[0].skill !== session.todaySkill)
  ) {
    throw new RangeError(
      "This three-minute session belongs to different content.",
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
  if (
    (session.mode === "retention" || session.mode === "recovery") &&
    questions.length !== 2
  ) {
    throw new RangeError("This review session belongs to different content.");
  }
  if (session.mode === "challenge" && questions.length !== 3) {
    throw new RangeError(
      "This mastery challenge belongs to different content.",
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
        id: "question-type",
        title: "Know the question type",
        explanation: baseLesson.objective,
        coachPrompt: "Look for the clue that identifies this question type.",
      },
      {
        id: "mental-model",
        title: "Build the main idea",
        explanation: baseLesson.concept,
        coachPrompt: "Start with the most important clue.",
      },
      {
        id: "guided-example",
        title: "See one worked out",
        explanation: `${baseLesson.workedExample.prompt} ${baseLesson.workedExample.explanation.join(" ")}`,
        coachPrompt: `Compare your first step with the answer: ${baseLesson.workedExample.answer}.`,
      },
      {
        id: "decision-rule",
        title: "Follow the decision steps",
        explanation: baseLesson.steps.join(" "),
        coachPrompt: "Use these steps to avoid the common trap.",
      },
      {
        id: "need-to-know",
        title: "Avoid the common trap",
        explanation: baseLesson.trap,
        coachPrompt: "Watch for this mistake in practice.",
      },
    ],
    strategyChecklist: baseLesson.steps,
    transferPrompt: `Use the ${baseLesson.title.toLowerCase()} steps on each question.`,
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
        misconception:
          mistake.misconception ??
          question.choices.find(
            (choice) => choice.id === mistake.selectedChoiceId,
          )?.misconception ??
          null,
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

function planCounterfactual(
  session: StoredLearningSession,
  states: Record<string, KnowledgeState>,
): PlanCounterfactual {
  const ranked = rankKnowledgeStates(Object.values(states), session.nextSkill);
  const current = ranked[0];
  const challenger = ranked[1] ?? ranked[0];
  let simulated = current;
  let responsesNeeded = 0;
  let correctRecommendation = recommendKnowledgeState(
    ranked,
    session.nextSkill,
  );
  while (responsesNeeded < 4 && correctRecommendation.skill === current.skill) {
    responsesNeeded += 1;
    simulated = applyKnowledgeObservation(simulated, {
      questionId: `counterfactual-correct-${responsesNeeded}`,
      correct: true,
      difficulty: "medium",
      observedAt: session.updatedAt,
      source: "practice",
      confidence: "sure",
    }).state;
    correctRecommendation = recommendKnowledgeState(
      ranked.map((state) =>
        state.skill === current.skill ? simulated : state,
      ),
      session.nextSkill,
    );
  }
  const missed = applyKnowledgeObservation(current, {
    questionId: "counterfactual-miss",
    correct: false,
    difficulty: "medium",
    observedAt: session.updatedAt,
    source: "practice",
    confidence: "sure",
  }).state;
  const missedRecommendation = recommendKnowledgeState(
    ranked.map((state) => (state.skill === current.skill ? missed : state)),
    session.nextSkill,
  );
  const lastDecision = session.decisionHistory?.at(-1);
  const changed = lastDecision?.planChanged ?? false;
  return {
    status: changed ? "changed" : "held",
    currentEvidence: Math.round(current.learnedProbability * 100),
    changeThreshold: Math.round(simulated.learnedProbability * 100),
    responsesNeeded: Math.max(1, responsesNeeded),
    currentSkill: current.skill,
    currentSkillLabel: current.label,
    challengerSkill: challenger.skill,
    challengerSkillLabel: challenger.label,
    correctOutcome:
      correctRecommendation.skill === current.skill
        ? `Another strong answer would raise confidence in ${current.label}, but it would still remain the best next mission.`
        : `Another strong answer would likely make ${correctRecommendation.label} the next mission.`,
    incorrectOutcome:
      missedRecommendation.skill === current.skill
        ? `A missed answer would keep ${current.label} first.`
        : `A missed answer would likely move ${missedRecommendation.label} first.`,
    explanation: changed
      ? `The evidence crossed Scout's change line, so the next mission changed.`
      : `Scout is protecting the current mission until another useful answer gives it enough reason to switch.`,
  };
}

function lessonReceipt(
  session: StoredLearningSession,
  lesson: PersonalizedLessonContent,
) {
  const generated = lesson.generation.mode === "ai";
  const humanReviewed = lesson.generation.provider === "Teacher-reviewed edit";
  return {
    objective: lesson.objective,
    approvedRule: lesson.concept,
    evidenceQuestionIds:
      session.lesson && session.lessonEvidenceSnapshot?.lessonId === lesson.id
        ? [...session.lessonEvidenceSnapshot.evidenceQuestionIds]
        : [],
    generatorStatus: humanReviewed
      ? "Teacher-reviewed edit saved with its original reviewed source"
      : generated
        ? `${lesson.generation.provider} · ${lesson.generation.model ?? "model recorded"}`
        : "Reviewed lesson bank used because generated content was unavailable or unnecessary",
    validationResult: humanReviewed
      ? ("human-reviewed" as const)
      : generated
        ? ("automated-checks-passed" as const)
        : ("reviewed-fallback" as const),
    validationChecks: generated
      ? [
          "Required lesson fields and section IDs passed schema checks",
          "Generated wording contained terms from the reviewed rule",
          "Blocked answer-key and score-guarantee phrases were not found",
        ]
      : humanReviewed
        ? [
            "A teacher edit was saved with the original reviewed source",
            "Practice answer keys remain separate from the lesson payload",
          ]
        : [
            "Authored lesson selected from the reviewed skill bank",
            "Practice answer keys remain separate from the lesson payload",
          ],
    deliveredAs: humanReviewed
      ? ("human-reviewed" as const)
      : generated
        ? ("generated" as const)
        : ("reviewed-fallback" as const),
  };
}

function captureLessonEvidence(
  session: StoredLearningSession,
  lesson: PersonalizedLessonContent,
) {
  session.lessonEvidenceSnapshot = {
    lessonId: lesson.id,
    capturedAt: new Date().toISOString(),
    evidenceQuestionIds: (session.learningTwinEvents ?? [])
      .filter((event) => event.skill === lesson.skill)
      .slice(-5)
      .map((event) => event.questionId),
  };
}

function coachBrief(
  session: StoredLearningSession,
  bank: LearningBankInput,
  states: Record<string, KnowledgeState>,
): CoachBrief {
  const allStates = Object.values(states);
  const strongest = [...allStates].sort(
    (left, right) => right.learnedProbability - left.learnedProbability,
  )[0];
  const priority = recommendKnowledgeState(allStates, session.nextSkill);
  const mistake = ensureProfile(session)
    .mistakes.filter((item) => item.resolvedAt === null)
    .at(-1);
  const priorityState = states[priority.skill];
  return {
    generatedAt: session.updatedAt,
    strongestSkill: strongest
      ? `${strongest.label} (${Math.round(strongest.learnedProbability * 100)}% skill estimate)`
      : "Not enough evidence yet",
    priorityMisconception:
      mistake?.misconception ??
      "Scout needs one more missed response to name a specific misconception.",
    confidenceLevel:
      priorityState?.confidence === "stable"
        ? "High"
        : priorityState?.confidence === "forming"
          ? "Moderate"
          : "Low",
    evidenceCollected: `${allStates.reduce((sum, state) => sum + state.evidenceCount, 0)} trusted answers across ${allStates.length} skills`,
    currentMission: getSkill(bank, session.todaySkill).label,
    nextMission: priority.label,
    offlineIntervention: `Ask the learner to explain the first decision they make in a ${priority.label.toLowerCase()} question, then ask why the other choice fails.`,
    unknowns:
      priorityState?.confidence === "stable"
        ? `Scout still needs a later review to confirm that ${priority.label.toLowerCase()} lasts.`
        : `Scout still needs more independent answers before treating ${priority.label.toLowerCase()} as a stable estimate.`,
  };
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
  const progressStep = (
    id: "practice" | "repair" | "checkpoint",
    label: string,
  ): DailyMissionSummary["steps"][number] => ({
    id,
    label,
    state: complete ? "done" : "current",
    progress: session.answers.length,
    total: questions.length,
  });
  const steps: DailyMissionSummary["steps"] =
    session.mode === "repair"
      ? [progressStep("repair", "Fix the missed idea on a new question")]
      : session.mode === "checkpoint"
        ? [progressStep("checkpoint", "Finish the 3-question progress check")]
        : session.mode === "retention"
          ? [progressStep("practice", "Finish the 2-question retention check")]
          : session.mode === "challenge"
            ? [
                progressStep(
                  "checkpoint",
                  "Finish the 3-question mastery challenge",
                ),
              ]
            : session.mode === "recovery"
              ? [progressStep("practice", "Finish the 2-question recovery set")]
              : session.mode === "micro"
                ? [
                    {
                      id: "learn",
                      label: "Review one worked example",
                      state: session.lessonComplete ? "done" : "current",
                      progress: session.lessonComplete ? 1 : 0,
                      total: 1,
                    },
                    {
                      id: "practice",
                      label: "Answer one question",
                      state: complete
                        ? "done"
                        : session.lessonComplete
                          ? "current"
                          : "queued",
                      progress: session.answers.length,
                      total: questions.length,
                    },
                  ]
                : (() => {
                    const learnDone = session.lessonComplete;
                    const practiceDone = complete;
                    return [
                      {
                        id: "learn" as const,
                        label: "Review one method and worked example",
                        state: learnDone
                          ? ("done" as const)
                          : ("current" as const),
                        progress: learnDone ? 1 : 0,
                        total: 1,
                      },
                      {
                        id: "practice" as const,
                        label: `Answer ${questions.length} scored ${questions.length === 1 ? "question" : "questions"}`,
                        state: practiceDone
                          ? ("done" as const)
                          : learnDone
                            ? ("current" as const)
                            : ("queued" as const),
                        progress: session.answers.length,
                        total: questions.length,
                      },
                    ];
                  })();
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

const PREREQUISITES: Record<string, string> = {
  "punctuation-and-commas": "sentence-boundaries",
  "concision-and-redundancy": "sentence-boundaries",
  "logical-transitions": "concision-and-redundancy",
  "linear-equations": "ratios-and-percent",
  "functions-and-modeling": "linear-equations",
  "geometry-and-measurement": "linear-equations",
  "textual-evidence-and-details": "central-ideas-and-details",
  "supported-inference": "textual-evidence-and-details",
  "author-purpose-and-structure": "central-ideas-and-details",
};

function learnerModelReport(
  session: StoredLearningSession,
  bank: LearningBankInput,
  states: Record<string, KnowledgeState>,
) {
  const profile = ensureProfile(session);
  const current = states[session.todaySkill] ?? Object.values(states)[0];
  const events = session.learningTwinEvents ?? [];
  const responseTimes = events
    .flatMap((event) =>
      event.responseSeconds === null ? [] : [event.responseSeconds],
    )
    .sort((left, right) => left - right);
  const medianSeconds = responseTimes.length
    ? responseTimes[Math.floor(responseTimes.length / 2)]
    : null;
  const grouped = new Map<
    string,
    { skill: string; count: number; questionId: string }
  >();
  for (const mistake of profile.mistakes.filter(
    (item) => item.resolvedAt === null && item.misconception,
  )) {
    const key = `${mistake.skill}:${mistake.misconception}`;
    const found = grouped.get(key);
    grouped.set(key, {
      skill: mistake.skill,
      count: (found?.count ?? 0) + mistake.attempts,
      questionId: mistake.questionId,
    });
  }
  const misconceptions = [...grouped.entries()]
    .map(([key, value]) => {
      const label = key.slice(key.indexOf(":") + 1);
      return {
        label,
        skill: value.skill,
        skillLabel: getSkill(bank, value.skill).label,
        count: value.count,
        latestQuestionId: value.questionId,
      };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
  const prerequisite = PREREQUISITES[session.nextSkill];
  const prerequisiteState = prerequisite ? states[prerequisite] : null;
  const transferPair = events.find((event, index) => {
    const previous = events[index - 1];
    return (
      previous &&
      previous.skill !== event.skill &&
      previous.correct &&
      event.correct
    );
  });
  const due = buildDueReviews(
    Object.values(session.masteryBySkill),
    session.updatedAt,
  );
  const explore = [...Object.values(states)].sort(
    (left, right) => right.uncertainty - left.uncertainty,
  )[0];
  const certainty = current ? 1 - current.uncertainty : 0;
  return {
    readiness: {
      mastery: current?.learnedProbability ?? 0.5,
      certainty,
      label:
        certainty >= 0.7
          ? "Strong estimate"
          : certainty >= 0.4
            ? "Useful estimate, still checking"
            : "Early estimate",
    },
    misconceptions,
    responseTime: {
      medianSeconds,
      interpretation:
        medianSeconds === null
          ? "Scout has not timed enough independent answers yet."
          : `Your middle response time is ${medianSeconds} seconds. Scout uses this for pacing advice, never as a mastery penalty.`,
      affectsMastery: false as const,
    },
    prerequisiteConfusion:
      prerequisiteState && prerequisiteState.learnedProbability < 0.55
        ? `${getSkill(bank, prerequisite).label} may be causing trouble with ${getSkill(bank, session.nextSkill).label}. Scout will repair the prerequisite first, then return.`
        : null,
    transferSignal: transferPair
      ? `Scout saw consecutive correct answers in ${transferPair.skillLabel} and a different skill. That is a cross-skill activity signal, not proof that learning transferred.`
      : "Scout has not seen enough cross-skill activity to investigate whether a method holds up in a different setting.",
    decaySignal: due.length
      ? due[0].explanation
      : "No practiced skill is close enough to its forgetting window yet.",
    explorationQuestion: explore
      ? `Scout’s next exploration question should check ${explore.label}, where the estimate is least certain.`
      : "Scout needs another answer before choosing an exploration question.",
    corrections: [...(profile.modelCorrections ?? [])].reverse().slice(0, 20),
  };
}

function learningTrustReport(
  session: StoredLearningSession,
  bank: LearningBankInput,
  states: Record<string, KnowledgeState>,
) {
  const profile = ensureProfile(session);
  const exposure = profile.exposureByQuestion ?? {};
  const misses = profile.missesByQuestion ?? {};
  const exposureRows = Object.entries(exposure)
    .map(([questionId, attempts]) => ({
      questionId,
      attempts,
      protected: attempts >= 2,
    }))
    .sort((left, right) => right.attempts - left.attempts);
  const itemHealth = exposureRows.map((item) => {
    const repeatedMisses = misses[item.questionId] ?? 0;
    return {
      questionId: item.questionId,
      status:
        repeatedMisses >= 3
          ? ("watch" as const)
          : item.attempts >= 3
            ? ("healthy" as const)
            : ("not-enough-data" as const),
      reason:
        repeatedMisses >= 3
          ? "This learner missed this exact item repeatedly, so a human should review the item and the surrounding instruction."
          : item.attempts >= 3
            ? "This learner did not show a repeated-miss warning across repeated exposure."
            : "There is not enough single-learner history to describe this question pattern yet.",
    };
  });
  const bkt = recommendKnowledgeState(Object.values(states), session.nextSkill);
  const legacy = chooseNextSkill(Object.values(session.masteryBySkill));
  const uncertain = [...Object.values(states)].sort(
    (left, right) => right.uncertainty - left.uncertainty,
  )[0];
  const random =
    bank.skills[ensureProfile(session).completedSets % bank.skills.length];
  return {
    exposure: exposureRows,
    itemHealth,
    modelComparison: {
      current: bkt.label,
      comparison: legacy.label,
      agrees: bkt.skill === legacy.skill,
      explanation:
        bkt.skill === legacy.skill
          ? "The learning model and the simpler accuracy model choose the same next skill."
          : `The learning model chooses ${bkt.label} because it includes certainty and recent evidence; the simpler model would choose ${legacy.label}.`,
    },
    policyBenchmarks: [
      {
        policy: "Scout adaptive",
        nextSkill: bkt.label,
        tradeoff:
          "Balances weakness, certainty, evidence count, and recent misses.",
      },
      {
        policy: "Weakest only",
        nextSkill: legacy.label,
        tradeoff:
          "Repairs the lowest estimate but may overreact to thin evidence.",
      },
      {
        policy: "Explore uncertainty",
        nextSkill: uncertain?.label ?? bkt.label,
        tradeoff:
          "Learns more about an unclear skill, even if it is not the weakest.",
      },
      {
        policy: "Non-adaptive control",
        nextSkill: random.label,
        tradeoff: "Provides a comparison baseline without personalization.",
      },
    ],
    abstentions: [
      "Fairness by demographic group is not reported because this guest session does not collect demographic data or contain a large enough cohort.",
      "Question quality is not judged here. Scout only shows this learner's exposure and repeated-miss history.",
    ],
  };
}

function toPayload(
  session: StoredLearningSession,
  bank: LearningBankInput,
  lastFeedback: PracticeFeedback | null = null,
): LearningSessionPayload {
  ensureProfile(session);
  const { cycle } = ensureCycle(session, bank);
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
  const dueReviews = buildDueReviews(
    Object.values(session.masteryBySkill),
    session.updatedAt,
  );
  const missionPurpose =
    session.mode === "repair"
      ? ("weak-skill-repair" as const)
      : dueReviews.some((review) => review.skill === session.todaySkill)
        ? ("retention-review" as const)
        : learningTwinBySkill[session.todaySkill]?.confidence === "exploring"
          ? ("confidence-building" as const)
          : ("new-learning" as const);
  return {
    sessionId: session.id,
    bankVersion: session.bankVersion,
    cycle: {
      ...cycle,
      requiredSkills: [...cycle.requiredSkills],
      completedSkills: [...cycle.completedSkills],
    },
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
    planCounterfactual: planCounterfactual(session, learningTwinBySkill),
    decisionHistory: [...(session.decisionHistory ?? [])]
      .reverse()
      .slice(0, 40),
    lessonReceipt: lessonReceipt(session, lesson),
    coachBrief: coachBrief(session, bank, learningTwinBySkill),
    missionPurpose,
    learnerModel: learnerModelReport(session, bank, learningTwinBySkill),
    trustReport: learningTrustReport(session, bank, learningTwinBySkill),
    teachBack:
      ensureProfile(session).teachBackBySkill?.[session.todaySkill] ?? null,
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
  sectionScores?: LessonPlanContext["sectionScores"],
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
        sectionScores?.[skill.section] ?? scoreEstimate,
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
    session.planContext?.sectionScores,
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

export class FileLearningSessionRepository extends AtomicJsonRepository<LearningStoreFile> {
  constructor(source: string | JsonDocumentStore) {
    super(source, EMPTY_STORE, (store) => {
      if (store.version !== 1 || !store.sessions) {
        throw new Error("Unsupported learning store format.");
      }
    });
  }

  async get(
    sessionId: string,
    bank: LearningBankInput,
  ): Promise<LearningSessionPayload> {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      const needsCycleMigration = !session.cycle;
      assertSessionMatchesBank(session, bank);
      if (needsCycleMigration) await this.writeStore(store);
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
    const firstFoundationSkill = canonicalSkillSlugs(bank)[0];
    const questionIds = getQuestions(bank, firstFoundationSkill).map(
      (question) => question.id,
    );
    return this.transact(async (store) => {
      const existing = sessionId ? store.sessions[sessionId] : undefined;
      if (existing) {
        try {
          const needsLearningTwinMigration =
            !existing.planContext || !existing.learningTwinBySkill;
          const needsCycleMigration = !existing.cycle;
          assertSessionMatchesBank(existing, bank);
          const planContextChanged =
            JSON.stringify(existing.planContext) !== JSON.stringify(input.plan);
          if (planContextChanged) {
            const officialScoreChanged = scoreContextChanged(
              existing.planContext,
              input.plan,
            );
            const { cycle } = ensureCycle(existing, bank);
            const profile = ensureProfile(existing);
            const states = ensureLearningTwin(existing, bank);
            existing.planContext = input.plan;
            const now = new Date().toISOString();
            if (
              officialScoreChanged &&
              cycle.kind === "adaptive" &&
              cycle.status === "lessons"
            ) {
              const ranked = scoreDrivenRoundSkills(bank, states, input.plan);
              const activeSkill = cycle.completedSkills.includes(
                existing.todaySkill,
              )
                ? (cycle.nextSkill ?? existing.todaySkill)
                : existing.todaySkill;
              const remainingSlots = Math.max(
                1,
                Math.min(6, bank.skills.length) - cycle.completedSkills.length,
              );
              const remaining = [
                activeSkill,
                ...ranked.filter(
                  (skill) =>
                    skill !== activeSkill &&
                    !cycle.completedSkills.includes(skill),
                ),
              ].slice(0, remainingSlots);
              cycle.requiredSkills = [...cycle.completedSkills, ...remaining];
              cycle.nextSkill = activeSkill;
              existing.nextSkill = activeSkill;
              existing.futureTask = {
                todaySkill: existing.todaySkill,
                nextSkill: activeSkill,
                changed: activeSkill !== existing.todaySkill,
                reason:
                  "The new official score reprioritized the remaining skills in this round without erasing completed lessons or practice.",
              };
            }
            if (cycle.status === "lessons") {
              existing.lesson = await composeLearningLesson({
                bank,
                skillSlug: existing.todaySkill,
                diagnosticSkillResults: profile.diagnosticSkillResults,
                plan: input.plan,
                lessonComposer,
                foundation: cycle.kind === "foundation",
              });
            }
            existing.updatedAt = now;
          }
          if (
            needsLearningTwinMigration ||
            needsCycleMigration ||
            planContextChanged
          ) {
            await this.writeStore(store);
          }
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
        input.plan.sectionScores,
      );
      const lesson = await composeLearningLesson({
        bank,
        skillSlug: firstFoundationSkill,
        diagnosticSkillResults: input.diagnosticSkillResults ?? [],
        plan: input.plan,
        lessonComposer,
        foundation: true,
      });
      const created: StoredLearningSession = {
        id: randomUUID(),
        bankVersion: bank.version,
        todaySkill: firstFoundationSkill,
        previousNextSkill: firstFoundationSkill,
        nextSkill: firstFoundationSkill,
        cycle: {
          roundNumber: 1,
          kind: "foundation",
          status: "lessons",
          requiredSkills: canonicalSkillSlugs(bank),
          completedSkills: [],
          nextSkill: firstFoundationSkill,
        },
        mode: "foundation",
        lessonComplete: false,
        questionIds,
        answers: [],
        masteryBySkill,
        learningTwinBySkill,
        learningTwinEvents: [],
        futureTask: {
          todaySkill: firstFoundationSkill,
          nextSkill: firstFoundationSkill,
          changed: false,
          reason: `Round 1 starts with ${getSkill(bank, firstFoundationSkill).label} and covers every curriculum skill before adapting.`,
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
          exposureByQuestion: {},
          missesByQuestion: {},
        },
        planContext: input.plan,
        createdAt: now,
        updatedAt: now,
      };
      captureLessonEvidence(created, lesson);
      store.sessions[created.id] = created;
      await this.writeStore(store);
      return { sessionId: created.id, payload: toPayload(created, bank) };
    });
  }

  async rebaseAfterCalibration(
    sessionId: string,
    bank: LearningBankInput,
    input: RebaseLearningSessionInput,
    lessonComposer: LessonComposer = new AuthoredLessonComposer(),
  ): Promise<LearningSessionPayload> {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      if (session.calibrationRebaseKey === input.calibrationKey) {
        return toPayload(session, bank);
      }
      const profile = ensureProfile(session);
      if (
        session.answers.length > 0 ||
        profile.totalAnswered > 0 ||
        (profile.modelCorrections?.length ?? 0) > 0
      ) {
        throw new RangeError(
          "This learner has already started studying. Start a fresh Quick Check before replacing the baseline.",
        );
      }
      if (input.diagnosticSkillResults.length === 0) {
        throw new RangeError(
          "Calibration evidence is required to rebuild the plan.",
        );
      }

      const masteryBySkill = makeInitialMasteries(
        bank,
        input.diagnosticSkillResults,
      );
      const learningTwinBySkill = input.replaceLearningTwin
        ? makeInitialKnowledgeStates(
            bank,
            input.diagnosticSkillResults,
            input.plan.currentScore,
            input.plan.sectionScores,
          )
        : ensureLearningTwin(session, bank);
      if (input.replaceLearningTwin) {
        session.learningTwinBySkill = learningTwinBySkill;
        session.learningTwinEvents = [];
      }
      const { cycle } = ensureCycle(session, bank);
      const nextSkill =
        cycle.kind === "foundation"
          ? cycle.nextSkill
          : buildLearningTwinSnapshot({
              states: Object.values(learningTwinBySkill),
              events: session.learningTwinEvents ?? [],
              preferredSkill: session.nextSkill,
            }).recommendation.skill;
      if (!nextSkill) {
        throw new RangeError(
          "Round 1 is complete. Choose the next assessment with Mr. Kim.",
        );
      }
      const previousSkill = session.todaySkill;
      const lesson = await composeLearningLesson({
        bank,
        skillSlug: nextSkill,
        diagnosticSkillResults: input.diagnosticSkillResults,
        plan: input.plan,
        lessonComposer,
        foundation: cycle.kind === "foundation",
      });
      const now = new Date().toISOString();

      session.todaySkill = nextSkill;
      session.previousNextSkill = previousSkill;
      session.nextSkill = nextSkill;
      session.mode = cycle.kind === "foundation" ? "foundation" : "focus";
      session.lessonComplete = false;
      session.questionIds = getQuestions(bank, nextSkill).map(
        (question) => question.id,
      );
      session.answers = [];
      session.masteryBySkill = masteryBySkill;
      session.futureTask = {
        todaySkill: nextSkill,
        nextSkill,
        changed: nextSkill !== previousSkill,
        reason:
          cycle.kind === "foundation"
            ? `Your scored baseline is ready. Round 1 still covers every question type, starting with ${getSkill(bank, nextSkill).label}.`
            : "Your latest scored baseline updated the next lesson.",
      };
      session.lesson = lesson;
      session.profile = {
        xp: 0,
        activeDates: [],
        longestStreak: 0,
        totalCorrect: 0,
        totalAnswered: 0,
        completedSets: 0,
        mistakes: [],
        diagnosticSkillResults: [...input.diagnosticSkillResults],
        lessonXpAwarded: false,
        completionXpAwarded: false,
        exposureByQuestion: {},
        missesByQuestion: {},
      };
      captureLessonEvidence(session, lesson);
      session.planContext = input.plan;
      session.repairMistakeId = null;
      session.returnSkillAfterPrerequisite = null;
      session.calibrationRebaseKey = input.calibrationKey;
      session.updatedAt = now;
      await this.writeStore(store);
      return toPayload(session, bank);
    });
  }

  async applyRoundAssessment(
    sessionId: string,
    bank: LearningBankInput,
    input: ApplyLearningRoundAssessmentInput,
    lessonComposer: LessonComposer = new AuthoredLessonComposer(),
  ): Promise<LearningSessionPayload> {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      if (
        input.assessmentKey.trim().length < 8 ||
        input.assessmentKey.length > 160
      ) {
        throw new RangeError("A stable assessment key is required.");
      }
      const { cycle } = ensureCycle(session, bank);
      if (cycle.status !== "assessment-choice") {
        const lastAppliedAssessment =
          session.appliedAssessmentKeys?.at(-1) ?? null;
        if (
          cycle.kind === "adaptive" &&
          cycle.status === "lessons" &&
          lastAppliedAssessment === input.assessmentKey
        ) {
          return toPayload(session, bank);
        }
        throw new RangeError(
          "Finish the current lesson round before applying an assessment.",
        );
      }
      if (session.appliedAssessmentKeys?.includes(input.assessmentKey)) {
        throw new RangeError(
          "That assessment already started a lesson round. Complete a new assessment first.",
        );
      }
      if (input.diagnosticSkillResults.length === 0) {
        throw new RangeError(
          "A completed diagnostic or full-length test is required.",
        );
      }
      if (input.diagnosticSkillResults.length > MAX_ROUND_ASSESSMENT_SKILLS) {
        throw new RangeError("The assessment contains too many skill groups.");
      }

      const profile = ensureProfile(session);
      const states = ensureLearningTwin(session, bank);
      const now = new Date().toISOString();
      const seenSkills = new Set<string>();
      let totalAssessmentQuestions = 0;
      for (const result of input.diagnosticSkillResults) {
        if (
          !Number.isInteger(result.correct) ||
          !Number.isInteger(result.total) ||
          result.total <= 0 ||
          result.correct < 0 ||
          result.correct > result.total ||
          Math.abs(result.accuracy - result.correct / result.total) > 0.0001
        ) {
          throw new RangeError("Assessment skill counts are malformed.");
        }
        if (seenSkills.has(result.skill)) {
          throw new RangeError(
            `Assessment skill ${result.skill} appears more than once.`,
          );
        }
        seenSkills.add(result.skill);
        totalAssessmentQuestions += result.total;
        if (totalAssessmentQuestions > MAX_ROUND_ASSESSMENT_QUESTIONS) {
          throw new RangeError(
            "The assessment contains more questions than Scout supports.",
          );
        }
        const skill = bank.skills.find(
          (candidate) => candidate.diagnosticSkill === result.skill,
        );
        if (!skill || skill.section !== result.section) {
          throw new RangeError(
            `Assessment skill ${result.skill} is not in this learning bank.`,
          );
        }
        const mastery = session.masteryBySkill[skill.slug];
        if (!mastery) {
          throw new RangeError(`Mastery state is missing for ${skill.slug}.`);
        }
        session.masteryBySkill[skill.slug] = mergeAssessmentMastery(
          mastery,
          result,
        );
        let state = states[skill.slug];
        if (!state) {
          throw new RangeError(
            `Learning Twin state is missing for ${skill.slug}.`,
          );
        }
        for (let index = 0; index < result.total; index += 1) {
          const update = applyKnowledgeObservation(state, {
            questionId: `${input.assessmentKey}:${result.skill}:${index + 1}`,
            correct: index < result.correct,
            difficulty: "medium",
            observedAt: now,
            source: "calibration",
            confidence: "sure",
          });
          state = update.state;
          session.learningTwinEvents ??= [];
          session.learningTwinEvents.push(update.event);
        }
        states[skill.slug] = state;
      }
      session.learningTwinEvents = (session.learningTwinEvents ?? []).slice(
        -500,
      );
      profile.diagnosticSkillResults = [...input.diagnosticSkillResults];

      const requiredSkills = adaptiveRoundSkills(
        bank,
        input.diagnosticSkillResults,
        states,
      );
      const nextSkill = requiredSkills[0];
      if (!nextSkill) {
        throw new RangeError("The next adaptive lesson could not be selected.");
      }
      const lesson = await composeLearningLesson({
        bank,
        skillSlug: nextSkill,
        diagnosticSkillResults: input.diagnosticSkillResults,
        plan: input.plan,
        lessonComposer,
        foundation: false,
      });
      const previousSkill = session.todaySkill;
      session.cycle = {
        roundNumber: cycle.roundNumber + 1,
        kind: "adaptive",
        status: "lessons",
        requiredSkills,
        completedSkills: [],
        nextSkill,
      };
      session.todaySkill = nextSkill;
      session.previousNextSkill = previousSkill;
      session.nextSkill = nextSkill;
      session.mode = "focus";
      session.lessonComplete = false;
      session.questionIds = getQuestions(bank, nextSkill).map(
        (question) => question.id,
      );
      session.answers = [];
      session.lesson = lesson;
      captureLessonEvidence(session, lesson);
      session.futureTask = {
        todaySkill: nextSkill,
        nextSkill,
        changed: nextSkill !== previousSkill,
        reason: `Round ${cycle.roundNumber + 1} starts with ${getSkill(bank, nextSkill).label}, based on the newest completed assessment.`,
      };
      session.planContext = input.plan;
      session.repairMistakeId = null;
      session.returnSkillAfterPrerequisite = null;
      profile.lessonXpAwarded = false;
      profile.completionXpAwarded = false;
      session.appliedAssessmentKeys = [
        ...(session.appliedAssessmentKeys ?? []),
        input.assessmentKey,
      ].slice(-50);
      session.updatedAt = now;
      await this.writeStore(store);
      return toPayload(session, bank);
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
      if (
        session.mode !== "foundation" &&
        session.mode !== "focus" &&
        session.mode !== "micro"
      )
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
      const { cycle } = ensureCycle(session, bank);
      let skillSlug = input.skill ?? session.nextSkill;
      if (cycle.status !== "lessons" || !cycle.nextSkill) {
        throw new RangeError(
          `Round ${cycle.roundNumber} is complete. Choose the next assessment with Mr. Kim.`,
        );
      }
      if (input.skill && input.skill !== cycle.nextSkill) {
        throw new RangeError(
          `Round ${cycle.roundNumber} continues with ${getSkill(bank, cycle.nextSkill).label}; lessons cannot be skipped or repeated.`,
        );
      }
      skillSlug = cycle.nextSkill;
      const skill = getSkill(bank, skillSlug);
      const lesson = await composeLearningLesson({
        bank,
        skillSlug,
        diagnosticSkillResults: profile.diagnosticSkillResults,
        plan: input.plan,
        lessonComposer,
        foundation: cycle.kind === "foundation",
      });
      session.todaySkill = skillSlug;
      session.previousNextSkill = session.nextSkill;
      session.nextSkill = skillSlug;
      session.mode = cycle.kind === "foundation" ? "foundation" : "focus";
      session.repairMistakeId = null;
      const returnTarget = session.returnSkillAfterPrerequisite;
      if (!returnTarget || PREREQUISITES[returnTarget] !== skillSlug) {
        session.returnSkillAfterPrerequisite = null;
      }
      session.lessonComplete = false;
      session.questionIds = getQuestions(bank, skillSlug).map(
        (question) => question.id,
      );
      session.answers = [];
      session.lesson = lesson;
      captureLessonEvidence(session, lesson);
      session.planContext = input.plan;
      profile.lessonXpAwarded = false;
      profile.completionXpAwarded = false;
      session.futureTask = {
        todaySkill: skillSlug,
        nextSkill: skillSlug,
        changed: false,
        reason:
          cycle.kind === "foundation"
            ? `Round 1 continues with ${skill.label}; every curriculum skill is covered once.`
            : `Round ${cycle.roundNumber} continues with ${skill.label}, based on the latest assessment.`,
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
      const question = leastExposedQuestions(bank, profile, mistake.skill, 1, {
        exclude: mistake.questionId,
      })[0];
      if (!question)
        throw new RangeError("That practice question is unavailable.");
      session.todaySkill = mistake.skill;
      session.mode = "repair";
      session.repairMistakeId = mistake.id;
      session.returnSkillAfterPrerequisite = null;
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
      session.returnSkillAfterPrerequisite = null;
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

  async beginRetention(
    sessionId: string,
    bank: LearningBankInput,
    skillSlug: string,
  ) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      if (!isComplete(session))
        throw new RangeError(
          "Finish your current task before starting review.",
        );
      const profile = ensureProfile(session);
      getSkill(bank, skillSlug);
      const questions = leastExposedQuestions(bank, profile, skillSlug, 2);
      session.todaySkill = skillSlug;
      session.mode = "retention";
      session.repairMistakeId = null;
      session.returnSkillAfterPrerequisite = null;
      session.lessonComplete = true;
      session.questionIds = questions.map((question) => question.id);
      session.answers = [];
      session.lesson = undefined;
      profile.lessonXpAwarded = true;
      profile.completionXpAwarded = false;
      session.updatedAt = new Date().toISOString();
      await this.writeStore(store);
      return toPayload(session, bank);
    });
  }

  async beginChallenge(
    sessionId: string,
    bank: LearningBankInput,
    skillSlug?: string,
  ) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      if (!isComplete(session))
        throw new RangeError(
          "Finish your current task before starting a challenge.",
        );
      const profile = ensureProfile(session);
      const skill = getSkill(bank, skillSlug ?? session.nextSkill);
      const questions = leastExposedQuestions(bank, profile, skill.slug, 3, {
        preferHard: true,
      });
      session.todaySkill = skill.slug;
      session.mode = "challenge";
      session.repairMistakeId = null;
      session.returnSkillAfterPrerequisite = null;
      session.lessonComplete = true;
      session.questionIds = questions.map((question) => question.id);
      session.answers = [];
      session.lesson = undefined;
      profile.lessonXpAwarded = true;
      profile.completionXpAwarded = false;
      session.updatedAt = new Date().toISOString();
      await this.writeStore(store);
      return toPayload(session, bank);
    });
  }

  async beginMicro(
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
          "Finish your current task before starting quick study.",
        );
      const profile = ensureProfile(session);
      const skill = getSkill(bank, input.skill ?? session.nextSkill);
      const lesson = await lessonComposer.compose({
        baseLesson: getLesson(bank, skill.slug),
        skill,
        diagnosticSkillResults: profile.diagnosticSkillResults,
        plan: input.plan,
      });
      session.todaySkill = skill.slug;
      session.mode = "micro";
      session.repairMistakeId = null;
      session.returnSkillAfterPrerequisite = null;
      session.lessonComplete = false;
      session.questionIds = leastExposedQuestions(
        bank,
        profile,
        skill.slug,
        1,
      ).map((question) => question.id);
      session.answers = [];
      session.lesson = {
        ...lesson,
        minutes: 3,
        sections: lesson.sections.slice(0, 1),
        strategyChecklist: lesson.strategyChecklist.slice(0, 2),
        tutorOpening:
          "Three minutes: review one method, then answer one question.",
      };
      captureLessonEvidence(session, session.lesson);
      session.planContext = input.plan;
      profile.lessonXpAwarded = false;
      profile.completionXpAwarded = false;
      session.updatedAt = new Date().toISOString();
      await this.writeStore(store);
      return toPayload(session, bank);
    });
  }

  async beginRecovery(sessionId: string, bank: LearningBankInput) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      if (!isComplete(session))
        throw new RangeError(
          "Finish your current task before starting recovery.",
        );
      const profile = ensureProfile(session);
      const ranked = rankKnowledgeStates(
        Object.values(ensureLearningTwin(session, bank)),
        session.nextSkill,
      ).slice(0, 2);
      const questions = ranked.map(
        (state) => leastExposedQuestions(bank, profile, state.skill, 1)[0],
      );
      session.todaySkill = ranked[0].skill;
      session.mode = "recovery";
      session.repairMistakeId = null;
      session.returnSkillAfterPrerequisite = null;
      session.lessonComplete = true;
      session.questionIds = questions.map((question) => question.id);
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
    answer: {
      questionId: string;
      choiceId: string;
      confidence?: AnswerConfidence;
      selfCorrected?: boolean;
      responseSeconds?: number;
      command?: LearningAnswerCommand;
    },
  ): Promise<LearningSessionPayload> {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      if (!session.lessonComplete)
        throw new RangeError("Complete the lesson before practice.");
      if (answer.command) {
        const command = answer.command;
        if (
          command.schemaVersion !== 2 ||
          command.learnerSessionId !== session.id ||
          command.bankVersion !== session.bankVersion ||
          command.answerRevision !== 1
        ) {
          throw new RangeError(
            "This saved answer belongs to a different learner session or content version.",
          );
        }
        const sourceQuestion = bank.practice.find(
          (question) => question.id === answer.questionId,
        );
        if (
          !sourceQuestion ||
          sourceQuestion.version !== command.questionVersion
        ) {
          throw new RangeError(
            "This saved answer uses an outdated question version.",
          );
        }
        const processed =
          session.processedAnswerCommands?.[command.idempotencyKey];
        if (processed) {
          if (
            processed.questionId !== answer.questionId ||
            processed.choiceId !== answer.choiceId
          ) {
            throw new RangeError(
              "That answer command key was already used for different content.",
            );
          }
          const stored = session.answers.find(
            (item) => item.questionId === processed.questionId,
          );
          if (!stored)
            throw new Error("Processed answer is missing from the session.");
          return toPayload(session, bank, stored.feedback);
        }
        if (command.sequence !== session.answers.length) {
          throw new RangeError(
            "This saved answer arrived out of order and was not applied.",
          );
        }
      }
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
      const confidence = answer.confidence ?? "sure";
      const evidenceWeight = answerEvidenceWeight(
        confidence,
        answer.selfCorrected ?? false,
      );
      const now = new Date().toISOString();
      const profile = ensureProfile(session);
      profile.exposureByQuestion ??= {};
      profile.exposureByQuestion[expectedQuestion.id] =
        (profile.exposureByQuestion[expectedQuestion.id] ?? 0) + 1;
      profile.missesByQuestion ??= {};
      if (!correct) {
        profile.missesByQuestion[expectedQuestion.id] =
          (profile.missesByQuestion[expectedQuestion.id] ?? 0) + 1;
      }
      const updated = applyPracticeAttempt(
        session.masteryBySkill[expectedQuestion.skill],
        {
          skill: expectedQuestion.skill,
          correct,
          difficulty: expectedQuestion.difficulty,
          answeredAt: now,
          confidence,
          selfCorrected: answer.selfCorrected,
        },
      );
      session.masteryBySkill[expectedQuestion.skill] = updated.mastery;
      const learningTwinBySkill = ensureLearningTwin(session, bank);
      const twinBefore = learningTwinBySkill[expectedQuestion.skill];
      const twinUpdate = applyKnowledgeObservation(
        learningTwinBySkill[expectedQuestion.skill],
        {
          questionId: expectedQuestion.id,
          correct,
          difficulty: expectedQuestion.difficulty,
          observedAt: now,
          source: "practice",
          confidence,
          selfCorrected: answer.selfCorrected,
          responseSeconds: answer.responseSeconds,
        },
      );
      learningTwinBySkill[expectedQuestion.skill] = twinUpdate.state;
      session.learningTwinEvents = [
        ...(session.learningTwinEvents ?? []),
        twinUpdate.event,
      ].slice(-100);
      const previousRecommendation = session.nextSkill;
      const rankedRecommendation = recommendKnowledgeState(
        Object.values(learningTwinBySkill),
        session.todaySkill,
      );
      const completingMission = session.answers.length === questions.length - 1;
      let recommendation = rankedRecommendation;
      let recommendationReason = rankedRecommendation.reason;
      const { cycle } = ensureCycle(session, bank);
      if (cycle.kind === "foundation") {
        if (session.mode === "foundation" && completingMission) {
          advanceFoundationCycle(session, bank);
        }
        const foundationNextSkill = cycle.nextSkill ?? session.todaySkill;
        const foundationNextState = learningTwinBySkill[foundationNextSkill];
        if (!foundationNextState) {
          throw new RangeError(
            `Learning Twin state is missing for ${foundationNextSkill}.`,
          );
        }
        recommendation = recommendKnowledgeState([foundationNextState]);
        recommendationReason =
          cycle.status === "assessment-choice"
            ? "Round 1 is complete. Choose the next assessment with Mr. Kim."
            : session.mode === "foundation" && completingMission
              ? `${getSkill(bank, session.todaySkill).label} is complete. Round 1 continues with ${getSkill(bank, foundationNextSkill).label}.`
              : session.mode === "foundation"
                ? `Finish the ${getSkill(bank, session.todaySkill).label} foundation lesson before moving on.`
                : `After this task, Round 1 continues with ${getSkill(bank, foundationNextSkill).label}.`;
        session.returnSkillAfterPrerequisite = null;
      } else {
        if (session.mode === "focus" && completingMission) {
          advanceAdaptiveCycle(session, bank);
        }
        const adaptiveNextSkill = cycle.nextSkill ?? session.todaySkill;
        const adaptiveNextState = learningTwinBySkill[adaptiveNextSkill];
        if (!adaptiveNextState) {
          throw new RangeError(
            `Learning Twin state is missing for ${adaptiveNextSkill}.`,
          );
        }
        recommendation = recommendKnowledgeState([adaptiveNextState]);
        recommendationReason =
          cycle.status === "assessment-choice"
            ? `Round ${cycle.roundNumber} is complete. Choose the next assessment with Mr. Kim.`
            : session.mode === "focus" && completingMission
              ? `${getSkill(bank, session.todaySkill).label} is complete. Round ${cycle.roundNumber} continues with ${getSkill(bank, adaptiveNextSkill).label}.`
              : session.mode === "focus"
                ? `Finish the ${getSkill(bank, session.todaySkill).label} lesson before moving on.`
                : `After this task, Round ${cycle.roundNumber} continues with ${getSkill(bank, adaptiveNextSkill).label}.`;
        session.returnSkillAfterPrerequisite = null;
      }
      const comparisonRecommendation = chooseNextSkill(
        Object.values(session.masteryBySkill),
      );
      const futureTask = {
        todaySkill: session.todaySkill,
        nextSkill: recommendation.skill,
        changed: recommendation.skill !== previousRecommendation,
        reason: recommendationReason,
      };
      session.previousNextSkill = previousRecommendation;
      session.nextSkill = futureTask.nextSkill;
      session.futureTask = futureTask;
      const decision: LearningDecisionEvent = {
        id: randomUUID(),
        occurredAt: now,
        questionId: expectedQuestion.id,
        source: "practice",
        answerSummary: correct ? "Correct" : "Missed",
        informationLabel:
          evidenceWeight >= 0.85
            ? "high"
            : evidenceWeight >= 0.6
              ? "medium"
              : "low",
        informationWeight: evidenceWeight,
        skill: expectedQuestion.skill,
        skillLabel: getSkill(bank, expectedQuestion.skill).label,
        learnedBefore: twinBefore.learnedProbability,
        learnedAfter: twinUpdate.state.learnedProbability,
        confidenceBefore: twinBefore.confidence,
        confidenceAfter: twinUpdate.state.confidence,
        planBefore: previousRecommendation,
        planAfter: recommendation.skill,
        planChanged: recommendation.skill !== previousRecommendation,
        protectedCurrentMission: true,
        why:
          recommendation.skill !== previousRecommendation
            ? `${recommendation.label} moved to the front after this answer.`
            : `The evidence was not strong enough to replace today's unfinished mission.`,
        misconception: selectedChoice?.misconception ?? null,
        modelVersion: "bkt-1.0",
        comparisonPlan: comparisonRecommendation.skill,
        comparisonPlanLabel: comparisonRecommendation.label,
        comparisonModelVersion: "accuracy-1.0",
      };
      session.decisionHistory = [
        ...(session.decisionHistory ?? []),
        decision,
      ].slice(-100);
      session.updatedAt = now;
      const feedback: PracticeFeedback = {
        questionId: expectedQuestion.id,
        selectedChoiceId: answer.choiceId,
        correctChoiceId: expectedQuestion.correctChoiceId,
        correct,
        rationale: expectedQuestion.rationale,
        misconception: selectedChoice?.misconception ?? null,
        confidence,
        selfCorrected: answer.selfCorrected ?? false,
        responseSeconds:
          typeof answer.responseSeconds === "number"
            ? Math.max(0, Math.round(answer.responseSeconds))
            : null,
        evidenceWeight,
        explanationVariant: correct ? "standard" : "step-by-step",
        isExitTicket:
          (session.mode === "foundation" || session.mode === "focus") &&
          session.answers.length === questions.length - 1,
        mastery: updated.mastery,
        review: updated.review,
        futureTask,
      };
      session.answers.push({
        questionId: answer.questionId,
        selectedChoiceId: answer.choiceId,
        feedback,
      });
      if (answer.command) {
        session.processedAnswerCommands ??= {};
        session.processedAnswerCommands[answer.command.idempotencyKey] = {
          questionId: answer.questionId,
          choiceId: answer.choiceId,
        };
      }
      profile.totalAnswered += 1;
      if (correct) profile.totalCorrect += 1;
      profile.xp += xpForPractice(correct, expectedQuestion.difficulty);
      recordActivity(profile, now);
      const openMistake =
        (session.mode === "repair" && session.repairMistakeId
          ? profile.mistakes.find(
              (item) =>
                item.id === session.repairMistakeId && item.resolvedAt === null,
            )
          : undefined) ??
        profile.mistakes.find(
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
          openMistake.misconception =
            selectedChoice?.misconception ?? openMistake.misconception ?? null;
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
            misconception: selectedChoice?.misconception ?? null,
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

  async recordTeachBack(
    sessionId: string,
    bank: LearningBankInput,
    response: string,
  ): Promise<LearningSessionPayload> {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      const text = response.trim();
      if (text.length < 20 || text.length > 1000)
        throw new RangeError(
          "Teach-back must be between 20 and 1,000 characters.",
        );
      const lesson =
        session.lesson ??
        fallbackLesson(getLesson(bank, session.todaySkill), session);
      const normalized = text.toLowerCase();
      const ruleWords =
        lesson.concept
          .toLowerCase()
          .match(/[a-z]{5,}/g)
          ?.slice(0, 8) ?? [];
      const rubric = [
        {
          label: "Identifies the key decision",
          met: ruleWords.some((word) => normalized.includes(word)),
        },
        {
          label: "Connects the decision to a reason",
          met: /\b(because|so that|which means|therefore|why)\b/.test(
            normalized,
          ),
        },
        {
          label: "Checks the idea with an example",
          met: /\b(example|for instance|if |such as|try )\b/.test(normalized),
        },
      ];
      const score = rubric.filter((item) => item.met).length;
      const result: TeachBackResult = {
        id: randomUUID(),
        occurredAt: new Date().toISOString(),
        skill: session.todaySkill,
        response: text,
        score,
        maxScore: 3,
        rubric,
        feedback:
          score === 3
            ? "Saved."
            : score === 2
              ? "Saved. Review the worked example before practice."
              : "Review the worked example before practice.",
      };
      const profile = ensureProfile(session);
      profile.teachBackBySkill ??= {};
      profile.teachBackBySkill[session.todaySkill] = result;
      session.updatedAt = result.occurredAt;
      await this.writeStore(store);
      return toPayload(session, bank);
    });
  }

  async correctLearnerModel(
    sessionId: string,
    bank: LearningBankInput,
    input: {
      skill: string;
      kind: LearnerModelCorrection["kind"];
      note: string;
    },
  ): Promise<LearningSessionPayload> {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      const skill = getSkill(bank, input.skill);
      const states = ensureLearningTwin(session, bank);
      const profile = ensureProfile(session);
      const alreadyRecorded = (profile.modelCorrections ?? []).some(
        (correction) =>
          correction.skill === skill.slug &&
          (correction.modelVersion ?? LEARNING_TWIN_MODEL.version) ===
            LEARNING_TWIN_MODEL.version,
      );
      if (alreadyRecorded) {
        throw new RangeError(
          "Scout already recorded a correction for this skill and model version. Answer a new question before correcting the estimate again.",
        );
      }
      const before = states[skill.slug];
      const after = applyLearnerModelCorrection(before, input.kind);
      states[skill.slug] = after;
      const note = input.note.trim().slice(0, 300);
      const record: LearnerModelCorrection = {
        id: randomUUID(),
        occurredAt: new Date().toISOString(),
        skill: skill.slug,
        skillLabel: skill.label,
        kind: input.kind,
        note: note || "Learner corrected Scout’s interpretation.",
        before: before.learnedProbability,
        after: after.learnedProbability,
        modelVersion: LEARNING_TWIN_MODEL.version,
      };
      profile.modelCorrections = [
        ...(profile.modelCorrections ?? []),
        record,
      ].slice(-50);
      if (input.kind === "wrong-misconception") {
        const mistake = [...profile.mistakes]
          .reverse()
          .find(
            (item) => item.skill === skill.slug && item.resolvedAt === null,
          );
        if (mistake) mistake.misconception = null;
      }
      const recommendation = recommendKnowledgeState(
        Object.values(states),
        session.nextSkill,
      );
      const { cycle } = ensureCycle(session, bank);
      const routedSkill =
        cycle.kind === "foundation"
          ? (cycle.nextSkill ?? session.todaySkill)
          : recommendation.skill;
      session.previousNextSkill = session.nextSkill;
      session.nextSkill = routedSkill;
      session.futureTask = {
        todaySkill: session.todaySkill,
        nextSkill: routedSkill,
        changed: routedSkill !== session.previousNextSkill,
        reason:
          cycle.kind === "foundation"
            ? cycle.status === "assessment-choice"
              ? "Scout included your correction. Round 1 is complete, so choose the next assessment with Mr. Kim."
              : `Scout included your correction. Round 1 still continues with ${getSkill(bank, routedSkill).label}.`
            : `Scout included your correction, then reran the next-mission decision: ${recommendation.reason}`,
      };
      session.updatedAt = record.occurredAt;
      await this.writeStore(store);
      return toPayload(session, bank);
    });
  }

  async recordLessonFeedback(
    sessionId: string,
    bank: LearningBankInput,
    input: { helpful: boolean; style: string },
  ): Promise<LearningSessionPayload> {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Learning session not found.");
      assertSessionMatchesBank(session, bank);
      const profile = ensureProfile(session);
      profile.lessonFeedbackBySkill ??= {};
      const previous = profile.lessonFeedbackBySkill[session.todaySkill] ?? {
        helpful: 0,
        unhelpful: 0,
        preferredStyle: null,
      };
      profile.lessonFeedbackBySkill[session.todaySkill] = {
        helpful: previous.helpful + (input.helpful ? 1 : 0),
        unhelpful: previous.unhelpful + (input.helpful ? 0 : 1),
        preferredStyle: input.helpful
          ? input.style.slice(0, 40)
          : previous.preferredStyle,
      };
      if (
        !input.helpful &&
        profile.lessonFeedbackBySkill[session.todaySkill].unhelpful >= 2 &&
        session.lesson?.generation.mode === "ai"
      ) {
        session.lesson = fallbackLesson(
          getLesson(bank, session.todaySkill),
          session,
        );
        captureLessonEvidence(session, session.lesson);
      }
      session.updatedAt = new Date().toISOString();
      await this.writeStore(store);
      return toPayload(session, bank);
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
        confidence: evidence.confidence ?? "sure",
      });
      learningTwinBySkill[skill.slug] = update.state;
      session.learningTwinEvents = [...twinEvents, update.event].slice(-100);

      const previousRecommendation = session.nextSkill;
      const recommendation = recommendKnowledgeState(
        Object.values(learningTwinBySkill),
        session.todaySkill,
      );
      const { cycle } = ensureCycle(session, bank);
      const routedSkill =
        cycle.kind === "foundation"
          ? (cycle.nextSkill ?? session.todaySkill)
          : recommendation.skill;
      const comparisonRecommendation = chooseNextSkill(
        Object.values(session.masteryBySkill),
      );
      session.previousNextSkill = previousRecommendation;
      session.nextSkill = routedSkill;
      session.futureTask = {
        todaySkill: session.todaySkill,
        nextSkill: routedSkill,
        changed: routedSkill !== previousRecommendation,
        reason:
          cycle.kind === "foundation"
            ? cycle.status === "assessment-choice"
              ? "Round 1 is complete. Choose the next assessment with Mr. Kim."
              : `Calibration updated Scout’s estimates. Round 1 still continues with ${getSkill(bank, routedSkill).label}.`
            : recommendation.reason,
      };
      const calibrationDecision: LearningDecisionEvent = {
        id: randomUUID(),
        occurredAt: evidence.observedAt,
        questionId: evidence.questionId,
        source: "calibration",
        answerSummary: evidence.correct
          ? "Correct · calibration"
          : "Missed · calibration",
        informationLabel:
          update.event.informationWeight >= 0.85
            ? "high"
            : update.event.informationWeight >= 0.6
              ? "medium"
              : "low",
        informationWeight: update.event.informationWeight,
        skill: skill.slug,
        skillLabel: skill.label,
        learnedBefore: current.learnedProbability,
        learnedAfter: update.state.learnedProbability,
        confidenceBefore: current.confidence,
        confidenceAfter: update.state.confidence,
        planBefore: previousRecommendation,
        planAfter: routedSkill,
        planChanged: routedSkill !== previousRecommendation,
        protectedCurrentMission: true,
        why:
          cycle.kind === "foundation"
            ? "Calibration updated Scout’s estimates without skipping any Round 1 lesson."
            : recommendation.skill !== previousRecommendation
              ? `${recommendation.label} moved to the front after this high-value check.`
              : `Scout kept the plan steady because one answer did not clear the change threshold.`,
        misconception: null,
        modelVersion: "bkt-1.0",
        comparisonPlan: comparisonRecommendation.skill,
        comparisonPlanLabel: comparisonRecommendation.label,
        comparisonModelVersion: "accuracy-1.0",
      };
      session.decisionHistory = [
        ...(session.decisionHistory ?? []),
        calibrationDecision,
      ].slice(-100);
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
