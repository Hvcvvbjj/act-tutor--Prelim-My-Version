import type {
  DiagnosticDifficulty,
  DiagnosticQuestionPublic,
} from "./diagnostic";
import type { CoreSection } from "./types";

export const ADAPTIVE_CALIBRATION_MODEL = {
  name: "Two-parameter logistic Item Response Theory",
  shortName: "2PL IRT",
  version: "irt-2pl-1.0",
  description:
    "A Bayesian ability model that chooses the unanswered ACT-aligned item expected to reduce uncertainty the most.",
} as const;

export const CALIBRATION_MIN_ITEMS = 8;
export const CALIBRATION_MAX_ITEMS = 12;
export const CALIBRATION_TARGET_STANDARD_ERROR = 0.56;

export interface IrtItemParameters {
  difficulty: number;
  discrimination: number;
}

export interface CalibrationItemDescriptor {
  id: string;
  section: CoreSection;
  skill: string;
  skillLabel: string;
  difficulty: DiagnosticDifficulty;
  parameters: IrtItemParameters;
}

export interface CalibrationObservation extends CalibrationItemDescriptor {
  correct: boolean;
  answeredAt: string;
}

export type CalibrationPrecision = "broad" | "stabilizing" | "precise";

export interface AbilityEstimate {
  theta: number;
  standardError: number;
  interval80: {
    low: number;
    high: number;
  };
  readinessIndex: number;
  precision: CalibrationPrecision;
  testInformation: number;
}

export interface CalibrationCandidateScore extends CalibrationItemDescriptor {
  probabilityCorrect: number;
  itemInformation: number;
  sectionCoverageBoost: number;
  skillCoverageBoost: number;
  selectionScore: number;
}

export interface CalibrationSelection {
  selectedItemId: string;
  reason: string;
  candidates: ReadonlyArray<CalibrationCandidateScore>;
}

export interface CalibrationHistoryEvent {
  questionId: string;
  section: CoreSection;
  skill: string;
  skillLabel: string;
  difficulty: DiagnosticDifficulty;
  correct: boolean;
  thetaBefore: number;
  thetaAfter: number;
  standardErrorBefore: number;
  standardErrorAfter: number;
  information: number;
  answeredAt: string;
}

export interface CalibrationFeedback {
  questionId: string;
  selectedChoiceId: string;
  correctChoiceId: string;
  correct: boolean;
  rationale: string;
  event: CalibrationHistoryEvent;
}

export interface AdaptiveCalibrationPayload {
  sessionId: string;
  bankVersion: string;
  model: typeof ADAPTIVE_CALIBRATION_MODEL;
  status: "in_progress" | "complete";
  currentQuestion: DiagnosticQuestionPublic | null;
  estimate: AbilityEstimate;
  selection: CalibrationSelection | null;
  history: ReadonlyArray<CalibrationHistoryEvent>;
  lastFeedback: CalibrationFeedback | null;
  answeredQuestionIds: ReadonlyArray<string>;
  responseCount: number;
  minimumItems: number;
  maximumItems: number;
  progress: number;
  stopReason: string | null;
  representativeDemo: boolean;
  learningTwinUpdated: boolean;
  updatedAt: string;
}

const LOGISTIC_SCALE = 1.7;
const PRIOR_VARIANCE = 2.25;
const INTERVAL_80_Z = 1.281552;
const THETA_FLOOR = -3;
const THETA_CEILING = 3;

const PARAMETERS_BY_DIFFICULTY: Record<
  DiagnosticDifficulty,
  IrtItemParameters
> = {
  easy: { difficulty: -1.05, discrimination: 1.05 },
  medium: { difficulty: 0, discrimination: 1.2 },
  hard: { difficulty: 1.05, discrimination: 1.35 },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function precisionFor(standardError: number): CalibrationPrecision {
  if (standardError <= CALIBRATION_TARGET_STANDARD_ERROR) return "precise";
  if (standardError <= 0.82) return "stabilizing";
  return "broad";
}

export function parametersForDifficulty(
  difficulty: DiagnosticDifficulty,
): IrtItemParameters {
  return { ...PARAMETERS_BY_DIFFICULTY[difficulty] };
}

export function irtProbabilityCorrect(
  theta: number,
  parameters: IrtItemParameters,
) {
  const exponent =
    -LOGISTIC_SCALE *
    parameters.discrimination *
    (theta - parameters.difficulty);
  return clamp(1 / (1 + Math.exp(exponent)), 0.000001, 0.999999);
}

export function irtItemInformation(
  theta: number,
  parameters: IrtItemParameters,
) {
  const probability = irtProbabilityCorrect(theta, parameters);
  const slope = LOGISTIC_SCALE * parameters.discrimination;
  return slope ** 2 * probability * (1 - probability);
}

export function estimateAbility(
  observations: ReadonlyArray<CalibrationObservation>,
): AbilityEstimate {
  let theta = 0;

  for (let iteration = 0; iteration < 24; iteration += 1) {
    let gradient = -theta / PRIOR_VARIANCE;
    let hessian = -1 / PRIOR_VARIANCE;
    for (const observation of observations) {
      const probability = irtProbabilityCorrect(theta, observation.parameters);
      const slope = LOGISTIC_SCALE * observation.parameters.discrimination;
      gradient += slope * ((observation.correct ? 1 : 0) - probability);
      hessian -= slope ** 2 * probability * (1 - probability);
    }
    const step = gradient / hessian;
    theta = clamp(theta - step, THETA_FLOOR, THETA_CEILING);
    if (Math.abs(step) < 0.00001) break;
  }

  const testInformation = observations.reduce(
    (total, observation) =>
      total + irtItemInformation(theta, observation.parameters),
    0,
  );
  const standardError = 1 / Math.sqrt(testInformation + 1 / PRIOR_VARIANCE);
  const low = clamp(
    theta - INTERVAL_80_Z * standardError,
    THETA_FLOOR,
    THETA_CEILING,
  );
  const high = clamp(
    theta + INTERVAL_80_Z * standardError,
    THETA_FLOOR,
    THETA_CEILING,
  );

  return {
    theta: round(theta),
    standardError: round(standardError),
    interval80: { low: round(low), high: round(high) },
    readinessIndex: Math.round(((theta - THETA_FLOOR) / 6) * 100),
    precision: precisionFor(standardError),
    testInformation: round(testInformation),
  };
}

function countsBy<T extends string>(values: ReadonlyArray<T>) {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

export function selectNextCalibrationItem(
  candidates: ReadonlyArray<CalibrationItemDescriptor>,
  observations: ReadonlyArray<CalibrationObservation>,
): CalibrationSelection | null {
  const answered = new Set(observations.map((observation) => observation.id));
  const remaining = candidates.filter(
    (candidate) => !answered.has(candidate.id),
  );
  if (remaining.length === 0) return null;

  const estimate = estimateAbility(observations);
  const sectionCounts = countsBy(
    observations.map((observation) => observation.section),
  );
  const skillCounts = countsBy(
    observations.map((observation) => observation.skill),
  );
  const leastCoveredSection = Math.min(
    sectionCounts.get("english") ?? 0,
    sectionCounts.get("math") ?? 0,
    sectionCounts.get("reading") ?? 0,
  );

  const ranked = remaining
    .map((candidate) => {
      const itemInformation = irtItemInformation(
        estimate.theta,
        candidate.parameters,
      );
      const sectionCount = sectionCounts.get(candidate.section) ?? 0;
      const sectionCoverageBoost =
        sectionCount === 0
          ? 1.35
          : sectionCount === leastCoveredSection
            ? 0.24
            : 0;
      const skillCoverageBoost =
        (skillCounts.get(candidate.skill) ?? 0) === 0 ? 0.12 : 0;
      return {
        ...candidate,
        probabilityCorrect: round(
          irtProbabilityCorrect(estimate.theta, candidate.parameters),
        ),
        itemInformation: round(itemInformation),
        sectionCoverageBoost,
        skillCoverageBoost,
        selectionScore: round(
          itemInformation + sectionCoverageBoost + skillCoverageBoost,
        ),
      };
    })
    .sort(
      (left, right) =>
        right.selectionScore - left.selectionScore ||
        right.itemInformation - left.itemInformation ||
        left.id.localeCompare(right.id),
    );
  const selected = ranked[0];
  const coverageReason =
    selected.sectionCoverageBoost >= 1
      ? `${selected.section} has not been sampled yet`
      : `${selected.section} is currently least covered`;
  return {
    selectedItemId: selected.id,
    reason: `${selected.skillLabel} is the next best probe because it offers ${selected.itemInformation.toFixed(2)} Fisher information at the current ability estimate and ${coverageReason}.`,
    candidates: ranked.slice(0, 5),
  };
}

export function calibrationStopDecision(
  observations: ReadonlyArray<CalibrationObservation>,
  candidateCount: number,
): { complete: boolean; reason: string | null } {
  const count = observations.length;
  if (count >= Math.min(CALIBRATION_MAX_ITEMS, candidateCount)) {
    return {
      complete: true,
      reason: `Reached the ${Math.min(CALIBRATION_MAX_ITEMS, candidateCount)}-item evidence cap.`,
    };
  }
  if (count < CALIBRATION_MIN_ITEMS) return { complete: false, reason: null };

  const sections = countsBy(
    observations.map((observation) => observation.section),
  );
  const hasCoverage = (["english", "math", "reading"] as const).every(
    (section) => (sections.get(section) ?? 0) >= 2,
  );
  const estimate = estimateAbility(observations);
  if (
    hasCoverage &&
    estimate.standardError <= CALIBRATION_TARGET_STANDARD_ERROR
  ) {
    return {
      complete: true,
      reason: `Stopped after ${count} items because every core section has evidence and uncertainty reached the precision target.`,
    };
  }
  return { complete: false, reason: null };
}
