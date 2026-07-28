import { describe, expect, it } from "vitest";

import type { DiagnosticFormSecure } from "./diagnostic";
import {
  buildAuthoredExamDebrief,
  examLabInterpretationReadiness,
  scoreExamLab,
  selectExamLabQuestions,
  type ExamLabResponse,
} from "./exam-lab";

const form = {
  id: "lab-test",
  version: "1",
  mode: "rapid",
  title: "Lab test",
  estimatedMinutes: 10,
  blueprint: [],
  questions: [
    ["e1", "english", "boundaries", "Sentence boundaries", "a", 40],
    ["m1", "math", "linear", "Linear equations", "b", 60],
    ["r1", "reading", "inference", "Inference", "c", 50],
  ].map(
    ([
      id,
      section,
      primarySkill,
      skillLabel,
      correctChoiceId,
      expectedSeconds,
    ]) => ({
      id,
      version: 1,
      section,
      category: "Test",
      primarySkill,
      skillLabel,
      difficulty: "medium",
      prompt: `Question ${id}`,
      choices: ["a", "b", "c", "d"].map((choice) => ({
        id: choice,
        text: choice,
      })),
      expectedSeconds,
      format: "standalone",
      correctChoiceId,
      rationale: `Reason ${id}`,
      content: {
        status: "published",
        license: "original",
        reviewer: "test",
        reviewedAt: "2026-07-12",
      },
    }),
  ),
} as DiagnosticFormSecure;

describe("Exam Lab scoring", () => {
  it("selects one question per skill for a sprint", () => {
    expect(
      selectExamLabQuestions(form, "sprint").map((question) => question.id),
    ).toEqual(["e1", "m1", "r1"]);
  });

  it("scores unanswered work, confidence, pacing, and a composite estimate", () => {
    const responses: Record<string, ExamLabResponse> = {
      e1: {
        choiceId: "a",
        confidence: "sure",
        flagged: false,
        elapsedSeconds: 12,
      },
      m1: {
        choiceId: "a",
        confidence: "sure",
        flagged: true,
        elapsedSeconds: 110,
      },
    };
    const result = scoreExamLab("sprint", form.questions, responses);
    expect(result.correct).toBe(1);
    expect(result.unanswered).toBe(1);
    expect(result.flagged).toBe(1);
    expect(result.overconfidentMisses).toBe(1);
    expect(result.practiceEstimate.composite).toBe(true);
    expect(examLabInterpretationReadiness(result)).toEqual({
      answered: 2,
      minimumAnswered: 3,
      sufficient: false,
    });
    expect(result.review).toHaveLength(3);
  });

  it("scores answers without presenting unreported confidence as learner input", () => {
    const responses: Record<string, ExamLabResponse> = {
      e1: {
        choiceId: "a",
        confidence: "unreported",
        flagged: false,
        elapsedSeconds: 40,
      },
      m1: {
        choiceId: "a",
        confidence: "unreported",
        flagged: false,
        elapsedSeconds: 60,
      },
    };

    const result = scoreExamLab("sprint", form.questions, responses);

    expect(result.correct).toBe(1);
    expect(
      result.review.slice(0, 2).map((review) => review.confidence),
    ).toEqual([null, null]);
    expect(result.confidence).toEqual([
      { confidence: "guess", correct: 0, total: 0, accuracy: null },
      { confidence: "unsure", correct: 0, total: 0, accuracy: null },
      { confidence: "sure", correct: 0, total: 0, accuracy: null },
    ]);
    expect(result.overconfidentMisses).toBe(0);
    expect(result.luckyGuesses).toBe(0);
  });

  it("withholds interpretation and recommendations from incomplete work", () => {
    const result = scoreExamLab("sprint", form.questions, {});
    const debrief = buildAuthoredExamDebrief(
      result,
      "2026-07-12T12:00:00.000Z",
    );
    expect(debrief.headline).toContain("Finish more questions");
    expect(debrief.summary).toContain("answered 0 of 3");
    expect(debrief.nextAction).toContain("answer at least 3");
    expect(debrief.generation.mode).toBe("authored-fallback");
  });

  it.each([
    ["0%", 100, false],
    ["1%", 99, false],
    ["49%", 51, false],
    ["50%", 50, false],
    ["100%", 0, true],
  ])(
    "applies the section-report evidence gate at %s answered",
    (_label, unanswered, sufficient) => {
      expect(
        examLabInterpretationReadiness({
          mode: "section",
          total: 100,
          unanswered,
        }),
      ).toEqual({
        answered: 100 - unanswered,
        minimumAnswered: 80,
        sufficient,
      });
    },
  );

  it("builds an actionable deterministic debrief from enough answers", () => {
    const responses: Record<string, ExamLabResponse> = Object.fromEntries(
      form.questions.map((question) => [
        question.id,
        {
          choiceId: question.correctChoiceId,
          confidence: "sure",
          flagged: false,
          elapsedSeconds: question.expectedSeconds,
        },
      ]),
    );
    const result = scoreExamLab("sprint", form.questions, responses);
    const debrief = buildAuthoredExamDebrief(
      result,
      "2026-07-12T12:00:00.000Z",
    );
    expect(examLabInterpretationReadiness(result).sufficient).toBe(true);
    expect(debrief.priorities).toHaveLength(2);
    expect(debrief.nextAction).toContain("Start a short");
    expect(debrief.generation.mode).toBe("authored-fallback");
  });
});
