import type { DiagnosticSkillResult } from "./diagnostic";
import type {
  PracticeDifficulty,
  SkillDefinition,
  SkillSlug,
} from "./learning";
import type { CoreSection } from "./types";

export const LEARNING_TWIN_MODEL = {
  name: "Bayesian Knowledge Tracing",
  shortName: "BKT",
  version: "bkt-1.0",
  description:
    "An interpretable probabilistic model that estimates whether a learner has acquired each ACT skill after every trusted response.",
} as const;

export type KnowledgePriorSource =
  "diagnostic" | "score-estimate" | "neutral-prior";
export type KnowledgeConfidence = "exploring" | "forming" | "stable";
export type LearningEvidenceSource = "practice" | "calibration";

export interface KnowledgeModelParameters {
  transition: number;
  guess: number;
  slip: number;
}

export interface KnowledgeUpdateTrace {
  correct: boolean;
  difficulty: PracticeDifficulty;
  learnedBefore: number;
  posteriorAfterEvidence: number;
  learnedAfterTransition: number;
  predictedCorrectAfter: number;
  delta: number;
  observedAt: string;
}

export interface KnowledgeState {
  skill: SkillSlug;
  label: string;
  section: CoreSection;
  learnedProbability: number;
  predictedCorrectProbability: number;
  uncertainty: number;
  baselineEvidence: number;
  observations: number;
  correctObservations: number;
  evidenceCount: number;
  confidence: KnowledgeConfidence;
  priorSource: KnowledgePriorSource;
  parameters: KnowledgeModelParameters;
  lastUpdate: KnowledgeUpdateTrace | null;
}

export interface KnowledgeObservation {
  questionId: string;
  correct: boolean;
  difficulty: PracticeDifficulty;
  observedAt: string;
  source?: LearningEvidenceSource;
}

export interface LearningTwinEvent {
  id: string;
  questionId: string;
  skill: SkillSlug;
  skillLabel: string;
  section: CoreSection;
  correct: boolean;
  difficulty: PracticeDifficulty;
  learnedBefore: number;
  learnedAfter: number;
  predictedCorrectAfter: number;
  observedAt: string;
  source: LearningEvidenceSource;
}

export type RecommendationContributionId =
  "knowledge-gap" | "uncertainty" | "evidence-scarcity" | "recent-lapse";

export interface RecommendationContribution {
  id: RecommendationContributionId;
  label: string;
  points: number;
  explanation: string;
}

export interface LearningTwinRecommendation {
  skill: SkillSlug;
  label: string;
  section: CoreSection;
  priorityScore: number;
  reason: string;
  contributions: ReadonlyArray<RecommendationContribution>;
}

export interface LearningTwinForecast {
  additionalSessions: number;
  label: string;
  averageReadiness: number;
  averageUncertainty: number;
  projectedSecureSkills: number;
}

export interface LearningTwinSnapshot {
  model: typeof LEARNING_TWIN_MODEL;
  skills: ReadonlyArray<KnowledgeState>;
  recommendation: LearningTwinRecommendation;
  events: ReadonlyArray<LearningTwinEvent>;
  forecast: ReadonlyArray<LearningTwinForecast>;
  evidence: {
    total: number;
    diagnostic: number;
    practice: number;
    calibration: number;
    lastUpdatedAt: string | null;
  };
}

export interface LearningTwinImpactComparison {
  skill: SkillSlug;
  skillLabel: string;
  learnedBefore: number;
  learnedAfter: number;
  predictedCorrectBefore: number;
  predictedCorrectAfter: number;
  recommendationBefore: LearningTwinRecommendation;
  recommendationAfter: LearningTwinRecommendation;
  recommendationChanged: boolean;
}

const PARAMETERS_BY_DIFFICULTY: Record<
  PracticeDifficulty,
  KnowledgeModelParameters
> = {
  easy: { transition: 0.08, guess: 0.24, slip: 0.08 },
  medium: { transition: 0.08, guess: 0.2, slip: 0.12 },
  hard: { transition: 0.08, guess: 0.14, slip: 0.17 },
};

const DEFAULT_PARAMETERS = PARAMETERS_BY_DIFFICULTY.medium;
const SECTION_ORDER: Record<CoreSection, number> = {
  english: 0,
  math: 1,
  reading: 2,
};

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 6) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function binaryUncertainty(probability: number) {
  const p = clamp(probability, 0.000001, 0.999999);
  return clamp(-(p * Math.log2(p) + (1 - p) * Math.log2(1 - p)));
}

function predictCorrect(
  learnedProbability: number,
  parameters: KnowledgeModelParameters = DEFAULT_PARAMETERS,
) {
  return clamp(
    learnedProbability * (1 - parameters.slip) +
      (1 - learnedProbability) * parameters.guess,
  );
}

function confidenceFor(evidenceCount: number, uncertainty: number) {
  if (evidenceCount < 3) return "exploring" as const;
  if (evidenceCount >= 7 && uncertainty <= 0.82) return "stable" as const;
  return "forming" as const;
}

function initialProbability(
  diagnosticResult?: Pick<DiagnosticSkillResult, "correct" | "total"> | null,
  scoreEstimate?: number | null,
) {
  if (diagnosticResult && diagnosticResult.total > 0) {
    if (
      !Number.isInteger(diagnosticResult.correct) ||
      !Number.isInteger(diagnosticResult.total) ||
      diagnosticResult.correct < 0 ||
      diagnosticResult.correct > diagnosticResult.total
    ) {
      throw new RangeError(
        "Invalid diagnostic evidence for the learning twin.",
      );
    }
    return {
      probability: clamp(
        (diagnosticResult.correct + 1) / (diagnosticResult.total + 2),
        0.08,
        0.92,
      ),
      baselineEvidence: diagnosticResult.total,
      priorSource: "diagnostic" as const,
    };
  }

  if (scoreEstimate !== null && scoreEstimate !== undefined) {
    if (
      !Number.isInteger(scoreEstimate) ||
      scoreEstimate < 1 ||
      scoreEstimate > 36
    ) {
      throw new RangeError(
        "ACT score estimate must be an integer from 1 to 36.",
      );
    }
    return {
      probability: clamp(0.12 + ((scoreEstimate - 1) / 35) * 0.76, 0.12, 0.88),
      baselineEvidence: 0,
      priorSource: "score-estimate" as const,
    };
  }

  return {
    probability: 0.5,
    baselineEvidence: 0,
    priorSource: "neutral-prior" as const,
  };
}

function normalizeState(
  state: Omit<
    KnowledgeState,
    | "predictedCorrectProbability"
    | "uncertainty"
    | "evidenceCount"
    | "confidence"
  >,
): KnowledgeState {
  const learnedProbability = clamp(state.learnedProbability);
  const uncertainty = binaryUncertainty(learnedProbability);
  const evidenceCount = state.baselineEvidence + state.observations;
  return {
    ...state,
    learnedProbability: round(learnedProbability),
    predictedCorrectProbability: round(
      predictCorrect(learnedProbability, state.parameters),
    ),
    uncertainty: round(uncertainty),
    evidenceCount,
    confidence: confidenceFor(evidenceCount, uncertainty),
  };
}

export function createInitialKnowledgeState(
  skill: SkillDefinition,
  diagnosticResult?: Pick<DiagnosticSkillResult, "correct" | "total"> | null,
  scoreEstimate?: number | null,
): KnowledgeState {
  const prior = initialProbability(diagnosticResult, scoreEstimate);
  return normalizeState({
    skill: skill.slug,
    label: skill.label,
    section: skill.section,
    learnedProbability: prior.probability,
    baselineEvidence: prior.baselineEvidence,
    observations: 0,
    correctObservations: 0,
    priorSource: prior.priorSource,
    parameters: { ...DEFAULT_PARAMETERS },
    lastUpdate: null,
  });
}

export function applyKnowledgeObservation(
  state: KnowledgeState,
  observation: KnowledgeObservation,
): { state: KnowledgeState; event: LearningTwinEvent } {
  if (!observation.questionId) {
    throw new RangeError("A question ID is required for knowledge evidence.");
  }
  const observedAt = new Date(observation.observedAt);
  if (Number.isNaN(observedAt.getTime())) {
    throw new RangeError("Knowledge evidence requires a valid ISO date.");
  }
  const parameters = PARAMETERS_BY_DIFFICULTY[observation.difficulty];
  const learnedBefore = clamp(state.learnedProbability);
  const learnedLikelihood = observation.correct
    ? learnedBefore * (1 - parameters.slip)
    : learnedBefore * parameters.slip;
  const unlearnedLikelihood = observation.correct
    ? (1 - learnedBefore) * parameters.guess
    : (1 - learnedBefore) * (1 - parameters.guess);
  const denominator = learnedLikelihood + unlearnedLikelihood;
  const posteriorAfterEvidence =
    denominator === 0 ? learnedBefore : learnedLikelihood / denominator;
  const learnedAfterTransition = clamp(
    posteriorAfterEvidence +
      (1 - posteriorAfterEvidence) * parameters.transition,
  );
  const predictedCorrectAfter = predictCorrect(
    learnedAfterTransition,
    DEFAULT_PARAMETERS,
  );
  const trace: KnowledgeUpdateTrace = {
    correct: observation.correct,
    difficulty: observation.difficulty,
    learnedBefore: round(learnedBefore),
    posteriorAfterEvidence: round(posteriorAfterEvidence),
    learnedAfterTransition: round(learnedAfterTransition),
    predictedCorrectAfter: round(predictedCorrectAfter),
    delta: round(learnedAfterTransition - learnedBefore),
    observedAt: observedAt.toISOString(),
  };
  const next = normalizeState({
    ...state,
    learnedProbability: learnedAfterTransition,
    observations: state.observations + 1,
    correctObservations:
      state.correctObservations + (observation.correct ? 1 : 0),
    parameters: { ...DEFAULT_PARAMETERS },
    lastUpdate: trace,
  });
  return {
    state: next,
    event: {
      id: `${observation.questionId}:${next.observations}`,
      questionId: observation.questionId,
      skill: state.skill,
      skillLabel: state.label,
      section: state.section,
      correct: observation.correct,
      difficulty: observation.difficulty,
      learnedBefore: trace.learnedBefore,
      learnedAfter: trace.learnedAfterTransition,
      predictedCorrectAfter: trace.predictedCorrectAfter,
      observedAt: trace.observedAt,
      source: observation.source ?? "practice",
    },
  };
}

function contributionSet(state: KnowledgeState) {
  const values: Array<RecommendationContribution & { raw: number }> = [
    {
      id: "knowledge-gap",
      label: "Knowledge gap",
      raw: (1 - state.predictedCorrectProbability) * 0.52,
      points: 0,
      explanation: "Lower predicted next-answer accuracy raises priority.",
    },
    {
      id: "uncertainty",
      label: "Model uncertainty",
      raw: state.uncertainty * 0.24,
      points: 0,
      explanation:
        "Uncertain skills receive probes that teach the model faster.",
    },
    {
      id: "evidence-scarcity",
      label: "Evidence scarcity",
      raw: (1 / (state.evidenceCount + 1)) * 0.14,
      points: 0,
      explanation:
        "Thin evidence is sampled before the route becomes overconfident.",
    },
    {
      id: "recent-lapse",
      label: "Recent lapse",
      raw: state.lastUpdate && !state.lastUpdate.correct ? 0.1 : 0,
      points: 0,
      explanation: "A recent miss creates short-term repair pressure.",
    },
  ];
  return values.map(({ raw, ...item }) => ({
    ...item,
    points: Math.round(raw * 100),
  }));
}

function recommendationFor(state: KnowledgeState): LearningTwinRecommendation {
  const contributions = contributionSet(state);
  const priorityScore = Math.min(
    100,
    contributions.reduce(
      (total, contribution) => total + contribution.points,
      0,
    ),
  );
  const leading = [...contributions]
    .sort((left, right) => right.points - left.points)
    .slice(0, 2)
    .map((item) => item.label.toLowerCase());
  return {
    skill: state.skill,
    label: state.label,
    section: state.section,
    priorityScore,
    reason: `${state.label} ranks first because ${leading.join(
      " and ",
    )} carry the most weight in the next-decision score.`,
    contributions,
  };
}

export function rankKnowledgeStates(
  states: ReadonlyArray<KnowledgeState>,
  preferredSkill?: SkillSlug,
) {
  if (states.length === 0) {
    throw new RangeError("At least one knowledge state is required.");
  }
  return [...states].sort((left, right) => {
    const leftScore = recommendationFor(left).priorityScore;
    const rightScore = recommendationFor(right).priorityScore;
    if (leftScore !== rightScore) return rightScore - leftScore;
    if (preferredSkill) {
      if (left.skill === preferredSkill && right.skill !== preferredSkill)
        return -1;
      if (right.skill === preferredSkill && left.skill !== preferredSkill)
        return 1;
    }
    if (left.evidenceCount !== right.evidenceCount) {
      return left.evidenceCount - right.evidenceCount;
    }
    return left.label.localeCompare(right.label);
  });
}

export function recommendKnowledgeState(
  states: ReadonlyArray<KnowledgeState>,
  preferredSkill?: SkillSlug,
) {
  return recommendationFor(rankKnowledgeStates(states, preferredSkill)[0]);
}

function projectState(state: KnowledgeState, additionalSessions: number) {
  const learnedProbability =
    1 -
    (1 - state.learnedProbability) *
      (1 - state.parameters.transition) ** additionalSessions;
  return {
    readiness: predictCorrect(learnedProbability),
    uncertainty: binaryUncertainty(learnedProbability),
  };
}

export function buildLearningTwinForecast(
  states: ReadonlyArray<KnowledgeState>,
): ReadonlyArray<LearningTwinForecast> {
  if (states.length === 0) return [];
  return [0, 3, 6, 10].map((additionalSessions) => {
    const projected = states.map((state) =>
      projectState(state, additionalSessions),
    );
    return {
      additionalSessions,
      label:
        additionalSessions === 0
          ? "Now"
          : `+${additionalSessions} evidence sessions`,
      averageReadiness: round(
        projected.reduce((total, item) => total + item.readiness, 0) /
          projected.length,
      ),
      averageUncertainty: round(
        projected.reduce((total, item) => total + item.uncertainty, 0) /
          projected.length,
      ),
      projectedSecureSkills: projected.filter((item) => item.readiness >= 0.75)
        .length,
    };
  });
}

export function buildLearningTwinSnapshot(input: {
  states: ReadonlyArray<KnowledgeState>;
  events?: ReadonlyArray<LearningTwinEvent>;
  preferredSkill?: SkillSlug;
}): LearningTwinSnapshot {
  const skills = [...input.states].sort(
    (left, right) =>
      SECTION_ORDER[left.section] - SECTION_ORDER[right.section] ||
      left.label.localeCompare(right.label),
  );
  const allEvents = [...(input.events ?? [])]
    .map((event) => ({ ...event, source: event.source ?? "practice" }))
    .sort((left, right) => right.observedAt.localeCompare(left.observedAt));
  const events = allEvents.slice(0, 12);
  const diagnosticEvidence = skills.reduce(
    (total, skill) => total + skill.baselineEvidence,
    0,
  );
  const practiceEvidence = allEvents.filter(
    (event) => event.source === "practice",
  ).length;
  const calibrationEvidence = allEvents.filter(
    (event) => event.source === "calibration",
  ).length;
  return {
    model: LEARNING_TWIN_MODEL,
    skills,
    recommendation: recommendKnowledgeState(skills, input.preferredSkill),
    events,
    forecast: buildLearningTwinForecast(skills),
    evidence: {
      total: diagnosticEvidence + practiceEvidence + calibrationEvidence,
      diagnostic: diagnosticEvidence,
      practice: practiceEvidence,
      calibration: calibrationEvidence,
      lastUpdatedAt: events[0]?.observedAt ?? null,
    },
  };
}

/**
 * Builds the public, student-facing explanation for one trusted answer.
 * This deliberately compares snapshots instead of recalculating BKT in the UI.
 */
export function compareLearningTwinSnapshots(input: {
  before: LearningTwinSnapshot;
  after: LearningTwinSnapshot;
  skill: SkillSlug;
  questionId?: string;
}): LearningTwinImpactComparison | null {
  const beforeState = input.before.skills.find(
    (state) => state.skill === input.skill,
  );
  const afterState = input.after.skills.find(
    (state) => state.skill === input.skill,
  );
  if (!beforeState || !afterState) return null;

  const exactEvent = input.questionId
    ? input.after.events.find(
        (event) =>
          event.questionId === input.questionId && event.skill === input.skill,
      )
    : undefined;

  return {
    skill: input.skill,
    skillLabel: afterState.label,
    learnedBefore: exactEvent?.learnedBefore ?? beforeState.learnedProbability,
    learnedAfter: exactEvent?.learnedAfter ?? afterState.learnedProbability,
    predictedCorrectBefore: beforeState.predictedCorrectProbability,
    predictedCorrectAfter:
      exactEvent?.predictedCorrectAfter ??
      afterState.predictedCorrectProbability,
    recommendationBefore: input.before.recommendation,
    recommendationAfter: input.after.recommendation,
    recommendationChanged:
      input.before.recommendation.skill !== input.after.recommendation.skill,
  };
}
