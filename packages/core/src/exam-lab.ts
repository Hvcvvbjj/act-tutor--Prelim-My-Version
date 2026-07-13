import type {
  DiagnosticFormSecure,
  DiagnosticQuestionPublic,
  DiagnosticQuestionSecure,
} from "./diagnostic";
import { calculateEmrComposite } from "./scoring";
import type { CoreSection } from "./types";

export type ExamLabMode = "sprint" | "section" | "core";
export type ExamLabSection = CoreSection | "mixed";
export type ExamConfidence = "guess" | "unsure" | "sure";
export type ExamLabPhase = "questions" | "review" | "results";

export const EXAM_SECTION_MINUTES: Record<CoreSection, number> = {
  english: 18,
  math: 25,
  reading: 20,
};

export interface ExamLabResponse {
  choiceId: string | null;
  confidence: ExamConfidence;
  flagged: boolean;
  elapsedSeconds: number;
}

export interface ExamLabProgress {
  responses: Record<string, ExamLabResponse>;
  currentIndex: number;
  currentSection: ExamLabSection;
  phase: ExamLabPhase;
  updatedAt: string;
}

export interface ExamLabSectionResult {
  section: CoreSection;
  correct: number;
  total: number;
  accuracy: number;
  practiceEstimate: number;
  averageSeconds: number;
  expectedAverageSeconds: number;
}

export interface ExamLabSkillResult {
  skill: string;
  label: string;
  section: CoreSection;
  correct: number;
  total: number;
  accuracy: number;
  averageSeconds: number;
  overconfidentMisses: number;
}

export interface ExamConfidenceResult {
  confidence: ExamConfidence;
  correct: number;
  total: number;
  accuracy: number | null;
}

export interface ExamPacingResult {
  averageSeconds: number;
  expectedAverageSeconds: number;
  rushed: number;
  overtime: number;
  onPace: number;
  diagnosis: "rushing" | "overinvesting" | "balanced" | "insufficient-data";
}

export interface ExamQuestionReview {
  questionId: string;
  section: CoreSection;
  skill: string;
  skillLabel: string;
  selectedChoiceId: string | null;
  correctChoiceId: string;
  correct: boolean;
  rationale: string;
  confidence: ExamConfidence | null;
  flagged: boolean;
  elapsedSeconds: number;
  expectedSeconds: number;
}

export interface ExamDebrief {
  headline: string;
  summary: string;
  wins: ReadonlyArray<string>;
  priorities: ReadonlyArray<string>;
  nextAction: string;
  generation: {
    mode: "ai" | "authored-fallback";
    provider: string;
    model: string | null;
    generatedAt: string;
  };
}

export interface ExamLabScoredResult {
  mode: ExamLabMode;
  correct: number;
  total: number;
  accuracy: number;
  unanswered: number;
  flagged: number;
  practiceEstimate: {
    low: number;
    estimate: number;
    high: number;
    composite: boolean;
  };
  sections: ReadonlyArray<ExamLabSectionResult>;
  skills: ReadonlyArray<ExamLabSkillResult>;
  focusSkills: ReadonlyArray<ExamLabSkillResult>;
  confidence: ReadonlyArray<ExamConfidenceResult>;
  overconfidentMisses: number;
  luckyGuesses: number;
  pacing: ExamPacingResult;
  review: ReadonlyArray<ExamQuestionReview>;
}

export interface ExamLabResult extends ExamLabScoredResult {
  debrief: ExamDebrief;
}

export interface ExamLabSessionPayload {
  id: string;
  mode: ExamLabMode;
  selectedSection: CoreSection | null;
  title: string;
  questions: ReadonlyArray<DiagnosticQuestionPublic>;
  status: "in_progress" | "completed";
  progress: ExamLabProgress;
  sectionStartedAt: string;
  sectionDeadlineAt: string;
  result: ExamLabResult | null;
}

const SECTION_ORDER: ReadonlyArray<CoreSection> = ["english", "math", "reading"];
const CONFIDENCE_ORDER: ReadonlyArray<ExamConfidence> = ["guess", "unsure", "sure"];

function clampScore(value: number) {
  return Math.max(1, Math.min(36, Math.round(value)));
}

function practiceEstimate(correct: number, total: number) {
  return clampScore(1 + ((correct + 1) / (total + 2)) * 35);
}

function average(values: ReadonlyArray<number>) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function toPublicExamQuestion(question: DiagnosticQuestionSecure): DiagnosticQuestionPublic {
  const { correctChoiceId: _correct, rationale: _rationale, content: _content, ...publicQuestion } = question;
  return publicQuestion;
}

export function selectExamLabQuestions(
  form: DiagnosticFormSecure,
  mode: ExamLabMode,
  selectedSection?: CoreSection | null,
): DiagnosticQuestionSecure[] {
  if (mode === "core") return [...form.questions];
  if (mode === "section") {
    if (!selectedSection) throw new RangeError("A section is required for section simulation.");
    return form.questions.filter((question) => question.section === selectedSection);
  }
  const seen = new Set<string>();
  return form.questions.filter((question) => {
    if (seen.has(question.primarySkill)) return false;
    seen.add(question.primarySkill);
    return true;
  });
}

export function examLabInitialSection(
  mode: ExamLabMode,
  selectedSection?: CoreSection | null,
): ExamLabSection {
  if (mode === "core") return "english";
  if (mode === "section") {
    if (!selectedSection) throw new RangeError("A section is required for section simulation.");
    return selectedSection;
  }
  return "mixed";
}

export function examLabMinutes(mode: ExamLabMode, section: ExamLabSection) {
  if (mode === "sprint") return 15;
  if (section === "mixed") throw new RangeError("Mixed timing is available only for sprint mode.");
  return EXAM_SECTION_MINUTES[section];
}

export function nextExamSection(section: ExamLabSection): CoreSection | null {
  if (section === "mixed") return null;
  const index = SECTION_ORDER.indexOf(section);
  return SECTION_ORDER[index + 1] ?? null;
}

export function scoreExamLab(
  mode: ExamLabMode,
  questions: ReadonlyArray<DiagnosticQuestionSecure>,
  responses: Readonly<Record<string, ExamLabResponse>>,
): ExamLabScoredResult {
  if (!questions.length) throw new RangeError("Exam Lab needs at least one question.");
  const reviews: ExamQuestionReview[] = questions.map((question) => {
    const response = responses[question.id];
    if (response && response.choiceId !== null && !question.choices.some((choice) => choice.id === response.choiceId)) {
      throw new RangeError(`Unknown choice for ${question.id}.`);
    }
    return {
      questionId: question.id,
      section: question.section,
      skill: question.primarySkill,
      skillLabel: question.skillLabel,
      selectedChoiceId: response?.choiceId ?? null,
      correctChoiceId: question.correctChoiceId,
      correct: response?.choiceId === question.correctChoiceId,
      rationale: question.rationale,
      confidence: response?.choiceId ? response.confidence : null,
      flagged: response?.flagged ?? false,
      elapsedSeconds: response?.elapsedSeconds ?? 0,
      expectedSeconds: question.expectedSeconds,
    };
  });

  const sections = SECTION_ORDER.flatMap((section) => {
    const sectionReviews = reviews.filter((review) => review.section === section);
    if (!sectionReviews.length) return [];
    const correct = sectionReviews.filter((review) => review.correct).length;
    return [{
      section,
      correct,
      total: sectionReviews.length,
      accuracy: correct / sectionReviews.length,
      practiceEstimate: practiceEstimate(correct, sectionReviews.length),
      averageSeconds: average(sectionReviews.filter((review) => review.selectedChoiceId !== null).map((review) => review.elapsedSeconds)),
      expectedAverageSeconds: average(sectionReviews.map((review) => review.expectedSeconds)),
    } satisfies ExamLabSectionResult];
  });

  const skillMap = new Map<string, ExamQuestionReview[]>();
  for (const review of reviews) {
    const existing = skillMap.get(review.skill) ?? [];
    existing.push(review);
    skillMap.set(review.skill, existing);
  }
  const skills = Array.from(skillMap, ([skill, items]) => {
    const answered = items.filter((item) => item.selectedChoiceId !== null);
    const correct = items.filter((item) => item.correct).length;
    return {
      skill,
      label: items[0].skillLabel,
      section: items[0].section,
      correct,
      total: items.length,
      accuracy: correct / items.length,
      averageSeconds: average(answered.map((item) => item.elapsedSeconds)),
      overconfidentMisses: items.filter((item) => !item.correct && item.confidence === "sure").length,
    } satisfies ExamLabSkillResult;
  }).sort((left, right) => left.accuracy - right.accuracy || right.averageSeconds - left.averageSeconds || left.label.localeCompare(right.label));

  const confidence = CONFIDENCE_ORDER.map((confidenceValue) => {
    const items = reviews.filter((review) => review.confidence === confidenceValue);
    const correct = items.filter((review) => review.correct).length;
    return {
      confidence: confidenceValue,
      correct,
      total: items.length,
      accuracy: items.length ? correct / items.length : null,
    } satisfies ExamConfidenceResult;
  });

  const answered = reviews.filter((review) => review.selectedChoiceId !== null);
  const rushed = answered.filter((review) => review.elapsedSeconds < review.expectedSeconds * 0.4).length;
  const overtime = answered.filter((review) => review.elapsedSeconds > review.expectedSeconds * 1.5).length;
  const pacing: ExamPacingResult = {
    averageSeconds: average(answered.map((review) => review.elapsedSeconds)),
    expectedAverageSeconds: average(reviews.map((review) => review.expectedSeconds)),
    rushed,
    overtime,
    onPace: Math.max(0, answered.length - rushed - overtime),
    diagnosis:
      answered.length < 3
        ? "insufficient-data"
        : rushed / answered.length >= 0.35
          ? "rushing"
          : overtime / answered.length >= 0.35
            ? "overinvesting"
            : "balanced",
  };

  const correct = reviews.filter((review) => review.correct).length;
  const sectionEstimates = Object.fromEntries(sections.map((section) => [section.section, section.practiceEstimate])) as Partial<Record<CoreSection, number>>;
  const isComposite = SECTION_ORDER.every((section) => sectionEstimates[section] !== undefined);
  const estimate = isComposite
    ? calculateEmrComposite(sectionEstimates as Record<CoreSection, number>)
    : sections[0]?.practiceEstimate ?? practiceEstimate(correct, reviews.length);
  const margin = mode === "sprint" ? 4 : 3;

  return {
    mode,
    correct,
    total: reviews.length,
    accuracy: correct / reviews.length,
    unanswered: reviews.filter((review) => review.selectedChoiceId === null).length,
    flagged: reviews.filter((review) => review.flagged).length,
    practiceEstimate: {
      low: Math.max(1, estimate - margin),
      estimate,
      high: Math.min(36, estimate + margin),
      composite: isComposite,
    },
    sections,
    skills,
    focusSkills: skills.slice(0, 3),
    confidence,
    overconfidentMisses: reviews.filter((review) => !review.correct && review.confidence === "sure").length,
    luckyGuesses: reviews.filter((review) => review.correct && review.confidence === "guess").length,
    pacing,
    review: reviews,
  };
}

export function buildAuthoredExamDebrief(
  result: ExamLabScoredResult,
  generatedAt = new Date().toISOString(),
): ExamDebrief {
  const topSection = [...result.sections].sort((left, right) => right.accuracy - left.accuracy)[0];
  const focus = result.focusSkills[0];
  const pacingCopy =
    result.pacing.diagnosis === "rushing"
      ? "Your misses cluster around decisions made much faster than their expected pace."
      : result.pacing.diagnosis === "overinvesting"
        ? "A meaningful share of questions absorbed more time than the target pace allows."
        : result.pacing.diagnosis === "balanced"
          ? "Your overall pacing stayed near the expected decision window."
          : "Answer more questions before treating the pacing signal as stable.";
  return {
    headline: focus ? `Turn ${focus.label.toLowerCase()} into the next score lever.` : "Bank more evidence before changing the route.",
    summary: `${result.correct} of ${result.total} decisions were correct. ${pacingCopy}`,
    wins: [
      topSection ? `${topSection.section} produced the strongest section evidence at ${Math.round(topSection.accuracy * 100)}%.` : "The simulation established a first timing baseline.",
      result.overconfidentMisses === 0 ? "No confident wrong answers appeared in this run." : `${result.luckyGuesses} low-confidence answers were still correct; those rules need consolidation.`,
    ],
    priorities: [
      focus ? `${focus.label}: ${focus.correct}/${focus.total} correct with ${Math.round(focus.averageSeconds)} seconds per decision.` : "Complete a larger simulation for skill-level priorities.",
      result.pacing.diagnosis === "overinvesting" ? "Use a two-pass rule: bank reachable questions before returning to time sinks." : "Keep labeling confidence so Scout can separate knowledge gaps from execution errors.",
    ],
    nextAction: focus ? `Assign a focused lesson and five-question set for ${focus.label}.` : "Run a 12-skill sprint next.",
    generation: { mode: "authored-fallback", provider: "Reviewed debrief engine", model: null, generatedAt },
  };
}
