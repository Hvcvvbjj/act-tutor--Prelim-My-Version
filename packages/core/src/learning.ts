import type { DiagnosticSkillResult } from "./diagnostic";
import type { CoreSection } from "./types";
import type { DailyMissionSummary, LearningSessionMode } from "./mission";
import type { LearningTwinSnapshot } from "./learning-twin";

export type SkillSlug = string;
export type PracticeDifficulty = "easy" | "medium" | "hard";
export type MasteryBand = "new" | "building" | "steady" | "secure";
export type AnswerConfidence = "sure" | "unsure" | "guessing";
export type MissionPurpose =
  | "new-learning"
  | "weak-skill-repair"
  | "confidence-building"
  | "retention-review";

export interface SkillDefinition {
  slug: SkillSlug;
  label: string;
  section: CoreSection;
  category: string;
  diagnosticSkill: string;
}

export interface LessonContent {
  id: string;
  skill: SkillSlug;
  title: string;
  minutes: number;
  objective: string;
  concept: string;
  steps: ReadonlyArray<string>;
  workedExample: {
    prompt: string;
    answer: string;
    explanation: ReadonlyArray<string>;
  };
  trap: string;
}

export type LessonDepth = "foundation" | "standard" | "stretch";
export type LessonGenerationMode = "ai" | "authored-fallback";

export interface LessonGenerationDetails {
  mode: LessonGenerationMode;
  provider: string;
  model: string | null;
  generatedAt: string;
}

export interface PersonalizedLessonSection {
  id: "mental-model" | "guided-example" | "decision-rule" | "transfer";
  title: string;
  explanation: string;
  coachPrompt: string;
}

export interface PersonalizedLessonContent extends LessonContent {
  depth: LessonDepth;
  whyAssigned: string;
  evidenceSummary: string;
  tutorOpening: string;
  sections: ReadonlyArray<PersonalizedLessonSection>;
  strategyChecklist: ReadonlyArray<string>;
  transferPrompt: string;
  generation: LessonGenerationDetails;
}

export interface LessonPlanContext {
  goalScore: number;
  currentScore: number;
  daysUntilTest: number;
  minutesPerSession: number;
  studyDaysPerWeek?: number;
  preferredSection?: CoreSection | "balanced";
}

export interface PracticeChoicePublic {
  id: string;
  text: string;
}

export interface PracticeChoiceSecure extends PracticeChoicePublic {
  misconception?: string;
}

export interface PracticeQuestionPublic {
  id: string;
  version: number;
  skill: SkillSlug;
  section: CoreSection;
  difficulty: PracticeDifficulty;
  prompt: string;
  stimulus?: string;
  choices: ReadonlyArray<PracticeChoicePublic>;
}

export interface PracticeQuestionSecure extends Omit<
  PracticeQuestionPublic,
  "choices"
> {
  choices: ReadonlyArray<PracticeChoiceSecure>;
  correctChoiceId: string;
  rationale: string;
}

export function toPublicPracticeQuestion(
  question: PracticeQuestionSecure,
): PracticeQuestionPublic {
  return {
    id: question.id,
    version: question.version,
    skill: question.skill,
    section: question.section,
    difficulty: question.difficulty,
    prompt: question.prompt,
    stimulus: question.stimulus,
    choices: question.choices.map(
      ({ misconception: _misconception, ...choice }) => choice,
    ),
  };
}

export interface MasteryState {
  skill: SkillSlug;
  label: string;
  section: CoreSection;
  alpha: number;
  beta: number;
  evidence: number;
  mastery: number;
  band: MasteryBand;
  lastPracticedAt: string | null;
  nextReviewAt: string | null;
  streak: number;
  lapses: number;
}

export interface PracticeAttemptInput {
  skill: SkillSlug;
  correct: boolean;
  difficulty: PracticeDifficulty;
  answeredAt: string;
  confidence?: AnswerConfidence;
  selfCorrected?: boolean;
}

export interface ReviewDecision {
  nextReviewAt: string;
  intervalDays: number;
  reason: string;
}

export interface FutureTaskDecision {
  todaySkill: SkillSlug;
  nextSkill: SkillSlug;
  changed: boolean;
  reason: string;
}

export interface PlanCounterfactual {
  status: "held" | "changed";
  currentEvidence: number;
  changeThreshold: number;
  responsesNeeded: number;
  currentSkill: SkillSlug;
  currentSkillLabel: string;
  challengerSkill: SkillSlug;
  challengerSkillLabel: string;
  correctOutcome: string;
  incorrectOutcome: string;
  explanation: string;
}

export interface LearningDecisionEvent {
  id: string;
  occurredAt: string;
  questionId: string;
  source: "practice" | "calibration";
  answerSummary: string;
  informationLabel: "low" | "medium" | "high";
  informationWeight: number;
  skill: SkillSlug;
  skillLabel: string;
  learnedBefore: number;
  learnedAfter: number;
  confidenceBefore: string;
  confidenceAfter: string;
  planBefore: SkillSlug;
  planAfter: SkillSlug;
  planChanged: boolean;
  protectedCurrentMission: boolean;
  why: string;
  misconception: string | null;
  modelVersion: string;
}

export interface LessonTrustReceipt {
  objective: string;
  approvedRule: string;
  evidenceQuestionIds: ReadonlyArray<string>;
  generatorStatus: string;
  validationResult: "passed" | "reviewed-fallback";
  validationChecks: ReadonlyArray<string>;
  deliveredAs: "generated" | "reviewed-fallback";
}

export interface CoachBrief {
  generatedAt: string;
  strongestSkill: string;
  priorityMisconception: string;
  confidenceLevel: string;
  evidenceCollected: string;
  currentMission: string;
  nextMission: string;
  offlineIntervention: string;
  unknowns: string;
}

export interface PracticeFeedback {
  questionId: string;
  selectedChoiceId: string;
  correctChoiceId: string;
  correct: boolean;
  rationale: string;
  misconception: string | null;
  confidence: AnswerConfidence;
  selfCorrected: boolean;
  responseSeconds: number | null;
  evidenceWeight: number;
  explanationVariant: "standard" | "step-by-step" | "analogy";
  isExitTicket: boolean;
  mastery: MasteryState;
  review: ReviewDecision;
  futureTask: FutureTaskDecision;
}

export interface LearningSessionPayload {
  sessionId: string;
  bankVersion: string;
  todaySkill: SkillSlug;
  previousNextSkill: SkillSlug;
  nextSkill: SkillSlug;
  lesson: PersonalizedLessonContent;
  lessonComplete: boolean;
  questions: ReadonlyArray<PracticeQuestionPublic>;
  answeredQuestionIds: ReadonlyArray<string>;
  currentQuestionIndex: number;
  mastery: MasteryState;
  futureTask: FutureTaskDecision;
  status: "lesson" | "practice" | "complete";
  updatedAt: string;
  lastFeedback: PracticeFeedback | null;
  mode: LearningSessionMode;
  mission: DailyMissionSummary;
  learningTwin: LearningTwinSnapshot;
  planCounterfactual: PlanCounterfactual;
  decisionHistory: ReadonlyArray<LearningDecisionEvent>;
  lessonReceipt: LessonTrustReceipt;
  coachBrief: CoachBrief;
  missionPurpose: MissionPurpose;
}

const DIFFICULTY_WEIGHT: Record<PracticeDifficulty, number> = {
  easy: 0.75,
  medium: 1,
  hard: 1.25,
};

export function answerEvidenceWeight(
  confidence: AnswerConfidence = "sure",
  selfCorrected = false,
) {
  const confidenceWeight =
    confidence === "sure" ? 1 : confidence === "unsure" ? 0.78 : 0.48;
  return Math.round(confidenceWeight * (selfCorrected ? 0.82 : 1) * 100) / 100;
}

function addDays(isoDate: string, days: number) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid ISO date.");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function bandFor(mastery: number, evidence: number): MasteryBand {
  if (evidence < 1) return "new";
  if (mastery >= 0.82 && evidence >= 6) return "secure";
  if (mastery >= 0.68 && evidence >= 4) return "steady";
  return "building";
}

function normalize(
  state: Omit<MasteryState, "mastery" | "band">,
): MasteryState {
  const mastery = state.alpha / (state.alpha + state.beta);
  return {
    ...state,
    mastery,
    band: bandFor(mastery, state.evidence),
  };
}

export function createInitialMastery(
  skill: SkillDefinition,
  diagnosticResult?: Pick<DiagnosticSkillResult, "correct" | "total"> | null,
): MasteryState {
  const correct = diagnosticResult?.correct ?? 0;
  const total = diagnosticResult?.total ?? 0;
  if (correct < 0 || total < 0 || correct > total) {
    throw new RangeError("Invalid diagnostic skill counts.");
  }

  return normalize({
    skill: skill.slug,
    label: skill.label,
    section: skill.section,
    alpha: 1 + correct,
    beta: 1 + total - correct,
    evidence: total,
    lastPracticedAt: null,
    nextReviewAt: null,
    streak: 0,
    lapses: 0,
  });
}

export function reviewDecision(
  state: MasteryState,
  attempt: PracticeAttemptInput,
): ReviewDecision {
  if (!attempt.correct) {
    return {
      nextReviewAt: addDays(attempt.answeredAt, 1),
      intervalDays: 1,
      reason: "You missed this question, so Scout scheduled a short review.",
    };
  }

  const base =
    state.band === "secure"
      ? 14
      : state.band === "steady"
        ? 7
        : state.streak >= 2
          ? 4
          : 2;
  const intervalDays =
    attempt.difficulty === "hard"
      ? base + 1
      : attempt.difficulty === "easy"
        ? Math.max(2, base - 1)
        : base;

  return {
    nextReviewAt: addDays(attempt.answeredAt, intervalDays),
    intervalDays,
    reason: "You got this right, so Scout moved the review farther out.",
  };
}

export function applyPracticeAttempt(
  state: MasteryState,
  attempt: PracticeAttemptInput,
): { mastery: MasteryState; review: ReviewDecision } {
  if (state.skill !== attempt.skill) {
    throw new RangeError("Practice attempt belongs to a different skill.");
  }
  const weight =
    DIFFICULTY_WEIGHT[attempt.difficulty] *
    answerEvidenceWeight(attempt.confidence, attempt.selfCorrected);
  const review = reviewDecision(state, attempt);
  return {
    review,
    mastery: normalize({
      ...state,
      alpha: state.alpha + (attempt.correct ? weight : 0),
      beta: state.beta + (attempt.correct ? 0 : weight),
      evidence: state.evidence + 1,
      lastPracticedAt: attempt.answeredAt,
      nextReviewAt: review.nextReviewAt,
      streak: attempt.correct ? state.streak + 1 : 0,
      lapses: attempt.correct ? state.lapses : state.lapses + 1,
    }),
  };
}

function masteryRank(state: MasteryState) {
  const uncertainty = 1 / Math.max(1, state.evidence + 1);
  const lapsePressure = state.lapses * 0.08;
  return state.mastery - uncertainty - lapsePressure;
}

export function chooseNextSkill(
  states: ReadonlyArray<MasteryState>,
): MasteryState {
  if (states.length === 0)
    throw new RangeError("At least one mastery state is required.");
  return [...states].sort((left, right) => {
    const rank = masteryRank(left) - masteryRank(right);
    if (rank !== 0) return rank;
    if (left.evidence !== right.evidence) return left.evidence - right.evidence;
    return left.label.localeCompare(right.label);
  })[0];
}

export function decideFutureTask(
  todaySkill: SkillSlug,
  previousNextSkill: SkillSlug,
  states: ReadonlyArray<MasteryState>,
): FutureTaskDecision {
  const next = chooseNextSkill(states);
  const changed = next.skill !== previousNextSkill;
  return {
    todaySkill,
    nextSkill: next.skill,
    changed,
    reason: changed
      ? `${next.label} needs the most work after this practice set.`
      : `${next.label} still needs the most attention.`,
  };
}
