import { describe, expect, it } from "vitest";

import {
  createAssessmentRemediationProgress,
  recordAssessmentRemediationResponse,
} from "./assessment-remediation";

describe("assessment remediation progress", () => {
  it("deduplicates misses and completes only after every required item is corrected", () => {
    const created = createAssessmentRemediationProgress(
      ["q1", "q2", "q1"],
      "2026-07-28T12:00:00.000Z",
    );
    expect(created).toMatchObject({
      status: "required",
      requiredQuestionIds: ["q1", "q2"],
    });

    const missedAgain = recordAssessmentRemediationResponse(created, {
      questionId: "q1",
      choiceId: "B",
      correct: false,
      answeredAt: "2026-07-28T12:01:00.000Z",
    });
    expect(missedAgain.status).toBe("required");
    expect(missedAgain.responses.q1).toMatchObject({
      attempts: 1,
      correctedAt: null,
    });

    const firstCorrected = recordAssessmentRemediationResponse(missedAgain, {
      questionId: "q1",
      choiceId: "A",
      correct: true,
      answeredAt: "2026-07-28T12:02:00.000Z",
    });
    expect(firstCorrected.status).toBe("required");

    const completed = recordAssessmentRemediationResponse(firstCorrected, {
      questionId: "q2",
      choiceId: "D",
      correct: true,
      answeredAt: "2026-07-28T12:03:00.000Z",
    });
    expect(completed.status).toBe("complete");
  });

  it("starts complete when an assessment has no missed questions", () => {
    expect(
      createAssessmentRemediationProgress([], "2026-07-28T12:00:00.000Z")
        .status,
    ).toBe("complete");
  });

  it("is idempotent after an item has been corrected", () => {
    const created = createAssessmentRemediationProgress(
      ["q1"],
      "2026-07-28T12:00:00.000Z",
    );
    const corrected = recordAssessmentRemediationResponse(created, {
      questionId: "q1",
      choiceId: "A",
      correct: true,
      answeredAt: "2026-07-28T12:01:00.000Z",
    });
    expect(
      recordAssessmentRemediationResponse(corrected, {
        questionId: "q1",
        choiceId: "B",
        correct: false,
        answeredAt: "2026-07-28T12:02:00.000Z",
      }),
    ).toBe(corrected);
  });
});
