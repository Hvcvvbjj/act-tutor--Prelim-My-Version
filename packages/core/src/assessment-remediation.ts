export interface AssessmentRemediationResponse {
  choiceId: string;
  attempts: number;
  correctedAt: string | null;
}

export interface AssessmentRemediationProgress {
  status: "required" | "complete";
  requiredQuestionIds: ReadonlyArray<string>;
  responses: Readonly<Record<string, AssessmentRemediationResponse>>;
  updatedAt: string;
}

function validTimestamp(value: string) {
  if (Number.isNaN(new Date(value).getTime())) {
    throw new RangeError("Assessment review needs a valid timestamp.");
  }
  return value;
}

export function createAssessmentRemediationProgress(
  questionIds: ReadonlyArray<string>,
  updatedAt = new Date().toISOString(),
): AssessmentRemediationProgress {
  const requiredQuestionIds = [...new Set(questionIds)];
  if (requiredQuestionIds.some((questionId) => !questionId)) {
    throw new RangeError("Assessment review question IDs cannot be empty.");
  }
  return {
    status: requiredQuestionIds.length ? "required" : "complete",
    requiredQuestionIds,
    responses: {},
    updatedAt: validTimestamp(updatedAt),
  };
}

export function recordAssessmentRemediationResponse(
  progress: AssessmentRemediationProgress,
  input: {
    questionId: string;
    choiceId: string;
    correct: boolean;
    answeredAt?: string;
  },
): AssessmentRemediationProgress {
  if (!progress.requiredQuestionIds.includes(input.questionId)) {
    throw new RangeError(
      "That question is not part of the required assessment review.",
    );
  }
  if (!input.choiceId) {
    throw new RangeError("Choose an answer before checking it.");
  }
  const previous = progress.responses[input.questionId];
  if (previous?.correctedAt) return progress;

  const answeredAt = validTimestamp(
    input.answeredAt ?? new Date().toISOString(),
  );
  const responses = {
    ...progress.responses,
    [input.questionId]: {
      choiceId: input.choiceId,
      attempts: (previous?.attempts ?? 0) + 1,
      correctedAt: input.correct ? answeredAt : null,
    },
  };
  const complete = progress.requiredQuestionIds.every(
    (questionId) => responses[questionId]?.correctedAt,
  );
  return {
    ...progress,
    status: complete ? "complete" : "required",
    responses,
    updatedAt: answeredAt,
  };
}
