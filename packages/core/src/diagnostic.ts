import { calculateEmrComposite } from "./scoring";
import {
  CORE_SECTIONS,
  type CoreSection,
  type CoreSectionScores,
  type NormalizedScoreEvidence,
} from "./types";

export type DiagnosticDifficulty = "easy" | "medium" | "hard";

export interface DiagnosticChoice {
  id: string;
  text: string;
}

export interface DiagnosticQuestionPublic {
  id: string;
  version: number;
  section: CoreSection;
  category: string;
  primarySkill: string;
  skillLabel: string;
  difficulty: DiagnosticDifficulty;
  prompt: string;
  stimulus?: string;
  choices: ReadonlyArray<DiagnosticChoice>;
  expectedSeconds: number;
  format: "passage" | "standalone";
  passageId?: string;
  passageTitle?: string;
  lineReference?: string;
}

export interface DiagnosticSectionBlueprint {
  section: CoreSection;
  officialQuestions: number;
  officialScoredQuestions: number;
  officialMinutes: number;
  diagnosticQuestions: number;
  diagnosticMinutes: number;
  reportingCategories: ReadonlyArray<{
    label: string;
    range: string;
  }>;
}

export interface DiagnosticQuestionSecure extends DiagnosticQuestionPublic {
  correctChoiceId: string;
  rationale: string;
  content: {
    status: "published";
    license: "original";
    reviewer: string;
    reviewedAt: string;
  };
}

export interface DiagnosticFormPublic {
  id: string;
  version: string;
  mode: "starter" | "rapid";
  title: string;
  estimatedMinutes: number;
  blueprint: ReadonlyArray<DiagnosticSectionBlueprint>;
  questions: ReadonlyArray<DiagnosticQuestionPublic>;
}

export interface DiagnosticFormSecure extends Omit<
  DiagnosticFormPublic,
  "questions"
> {
  questions: ReadonlyArray<DiagnosticQuestionSecure>;
}

export interface DiagnosticAnswer {
  questionId: string;
  choiceId: string;
}

export interface DiagnosticScoreRange {
  low: number;
  high: number;
  estimate: number;
}

export interface DiagnosticSectionResult {
  section: CoreSection;
  correct: number;
  total: number;
  range: DiagnosticScoreRange;
}

export interface DiagnosticSkillResult {
  skill: string;
  label: string;
  section: CoreSection;
  correct: number;
  total: number;
  accuracy: number;
  signal: "strength" | "developing" | "focus";
}

export interface DiagnosticQuestionFeedback {
  questionId: string;
  selectedChoiceId: string;
  correctChoiceId: string;
  correct: boolean;
  rationale: string;
}

export interface DiagnosticResult {
  formId: string;
  formVersion: string;
  source: "starter_diagnostic" | "rapid_diagnostic";
  calibrationVersion: "starter-v1" | "rapid-v1";
  sectionResults: ReadonlyArray<DiagnosticSectionResult>;
  compositeRange: DiagnosticScoreRange;
  planningBaseline: CoreSectionScores;
  skillResults: ReadonlyArray<DiagnosticSkillResult>;
  strengths: ReadonlyArray<DiagnosticSkillResult>;
  focusSkills: ReadonlyArray<DiagnosticSkillResult>;
  feedback: ReadonlyArray<DiagnosticQuestionFeedback>;
}

export interface DiagnosticSessionProgress {
  answers: Record<string, string>;
  currentIndex: number;
  phase: "questions" | "review";
  updatedAt: string;
}

export interface DiagnosticSessionPayload {
  form: DiagnosticFormPublic;
  progress: DiagnosticSessionProgress;
  status: "in_progress" | "completed";
  result: DiagnosticResult | null;
}

export function toPublicDiagnosticForm(
  form: DiagnosticFormSecure,
): DiagnosticFormPublic {
  return {
    id: form.id,
    version: form.version,
    mode: form.mode,
    title: form.title,
    estimatedMinutes: form.estimatedMinutes,
    blueprint: form.blueprint,
    questions: form.questions.map(
      ({
        correctChoiceId: _key,
        rationale: _rationale,
        content: _content,
        ...question
      }) => question,
    ),
  };
}

function estimateSectionRange(
  correct: number,
  total: number,
  mode: DiagnosticFormSecure["mode"],
): DiagnosticScoreRange {
  if (!Number.isInteger(correct) || !Number.isInteger(total) || total <= 0) {
    throw new RangeError(
      "Diagnostic section counts must be positive integers.",
    );
  }
  if (correct < 0 || correct > total) {
    throw new RangeError("Correct answers must be between zero and total.");
  }

  // A light Beta(1,1) prior keeps short forms from claiming a floor of 1 or
  // ceiling of 36. Rapid mode has twice the evidence of the starter slice, so
  // it earns a narrower (but still intentionally cautious) range.
  const smoothedAccuracy = (correct + 1) / (total + 2);
  const estimate = Math.round(1 + smoothedAccuracy * 35);
  const margin = mode === "rapid" ? 2 : 6;

  return {
    low: Math.max(1, estimate - margin),
    high: Math.min(36, estimate + margin),
    estimate,
  };
}

function compareSkillResults(
  left: DiagnosticSkillResult,
  right: DiagnosticSkillResult,
) {
  if (left.accuracy !== right.accuracy) return left.accuracy - right.accuracy;
  if (left.total !== right.total) return right.total - left.total;
  return left.label.localeCompare(right.label);
}

export function scoreDiagnostic(
  form: DiagnosticFormSecure,
  answers: ReadonlyArray<DiagnosticAnswer>,
): DiagnosticResult {
  const questionsById = new Map(
    form.questions.map((question) => [question.id, question]),
  );
  if (questionsById.size !== form.questions.length) {
    throw new RangeError("Diagnostic question IDs must be unique.");
  }

  const answersByQuestion = new Map<string, DiagnosticAnswer>();
  for (const answer of answers) {
    const question = questionsById.get(answer.questionId);
    if (!question) {
      throw new RangeError(
        `Unknown diagnostic question: ${answer.questionId}.`,
      );
    }
    if (answersByQuestion.has(answer.questionId)) {
      throw new RangeError(`Duplicate answer for ${answer.questionId}.`);
    }
    if (!question.choices.some((choice) => choice.id === answer.choiceId)) {
      throw new RangeError(`Unknown choice for ${answer.questionId}.`);
    }
    answersByQuestion.set(answer.questionId, answer);
  }

  if (answersByQuestion.size !== form.questions.length) {
    throw new RangeError("Every diagnostic question must be answered.");
  }

  const feedback: DiagnosticQuestionFeedback[] = [];
  const sectionCounts = new Map<
    CoreSection,
    { correct: number; total: number }
  >();
  const skillCounts = new Map<
    string,
    {
      label: string;
      section: CoreSection;
      correct: number;
      total: number;
    }
  >();

  for (const question of form.questions) {
    const answer = answersByQuestion.get(question.id);
    if (!answer) throw new Error("Validated answer unexpectedly missing.");
    const correct = answer.choiceId === question.correctChoiceId;

    feedback.push({
      questionId: question.id,
      selectedChoiceId: answer.choiceId,
      correctChoiceId: question.correctChoiceId,
      correct,
      rationale: question.rationale,
    });

    const section = sectionCounts.get(question.section) ?? {
      correct: 0,
      total: 0,
    };
    section.total += 1;
    if (correct) section.correct += 1;
    sectionCounts.set(question.section, section);

    const skill = skillCounts.get(question.primarySkill) ?? {
      label: question.skillLabel,
      section: question.section,
      correct: 0,
      total: 0,
    };
    skill.total += 1;
    if (correct) skill.correct += 1;
    skillCounts.set(question.primarySkill, skill);
  }

  const sectionResults = CORE_SECTIONS.map((section) => {
    const counts = sectionCounts.get(section);
    if (!counts) {
      throw new RangeError(`Diagnostic form is missing ${section} questions.`);
    }
    return {
      section,
      ...counts,
      range: estimateSectionRange(counts.correct, counts.total, form.mode),
    };
  });

  const planningBaseline = Object.fromEntries(
    sectionResults.map((result) => [result.section, result.range.estimate]),
  ) as CoreSectionScores;

  const compositeRange = {
    low: calculateEmrComposite(
      Object.fromEntries(
        sectionResults.map((result) => [result.section, result.range.low]),
      ) as CoreSectionScores,
    ),
    high: calculateEmrComposite(
      Object.fromEntries(
        sectionResults.map((result) => [result.section, result.range.high]),
      ) as CoreSectionScores,
    ),
    estimate: calculateEmrComposite(planningBaseline),
  };

  const skillResults = Array.from(skillCounts, ([skill, counts]) => {
    const accuracy = counts.correct / counts.total;
    return {
      skill,
      ...counts,
      accuracy,
      signal:
        accuracy === 1
          ? ("strength" as const)
          : accuracy <= 0.5
            ? ("focus" as const)
            : ("developing" as const),
    };
  }).sort(compareSkillResults);

  return {
    formId: form.id,
    formVersion: form.version,
    source:
      form.mode === "rapid" ? "rapid_diagnostic" : "starter_diagnostic",
    calibrationVersion: form.mode === "rapid" ? "rapid-v1" : "starter-v1",
    sectionResults,
    compositeRange,
    planningBaseline,
    skillResults,
    strengths: skillResults
      .filter((skill) => skill.signal === "strength")
      .sort((left, right) => {
        if (left.accuracy !== right.accuracy) {
          return right.accuracy - left.accuracy;
        }
        if (left.total !== right.total) return right.total - left.total;
        return left.label.localeCompare(right.label);
      })
      .slice(0, 2),
    focusSkills: skillResults
      .filter((skill) => skill.signal === "focus")
      .slice(0, 2),
    feedback,
  };
}

export function diagnosticResultToEvidence(
  result: DiagnosticResult,
): NormalizedScoreEvidence {
  return {
    source: result.source,
    reportedComposite: null,
    calculatedComposite: result.compositeRange.estimate,
    reportedSections: null,
    planningBaseline: result.planningBaseline,
    science: null,
    confidence: "low",
    compositeDifference: null,
  };
}
