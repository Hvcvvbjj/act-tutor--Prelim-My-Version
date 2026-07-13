import { describe, expect, it } from "vitest";

import type { DiagnosticFormSecure } from "./diagnostic";
import {
  buildAuthoredExamDebrief,
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
  ].map(([id, section, primarySkill, skillLabel, correctChoiceId, expectedSeconds]) => ({
    id, version: 1, section, category: "Test", primarySkill, skillLabel, difficulty: "medium",
    prompt: `Question ${id}`, choices: ["a", "b", "c", "d"].map((choice) => ({ id: choice, text: choice })),
    expectedSeconds, format: "standalone", correctChoiceId, rationale: `Reason ${id}`,
    content: { status: "published", license: "original", reviewer: "test", reviewedAt: "2026-07-12" },
  })),
} as DiagnosticFormSecure;

describe("Exam Lab scoring", () => {
  it("selects one question per skill for a sprint", () => {
    expect(selectExamLabQuestions(form, "sprint").map((question) => question.id)).toEqual(["e1", "m1", "r1"]);
  });

  it("scores unanswered work, confidence, pacing, and a composite estimate", () => {
    const responses: Record<string, ExamLabResponse> = {
      e1: { choiceId: "a", confidence: "sure", flagged: false, elapsedSeconds: 12 },
      m1: { choiceId: "a", confidence: "sure", flagged: true, elapsedSeconds: 110 },
    };
    const result = scoreExamLab("sprint", form.questions, responses);
    expect(result.correct).toBe(1);
    expect(result.unanswered).toBe(1);
    expect(result.flagged).toBe(1);
    expect(result.overconfidentMisses).toBe(1);
    expect(result.practiceEstimate.composite).toBe(true);
    expect(result.review).toHaveLength(3);
  });

  it("builds an actionable deterministic debrief", () => {
    const result = scoreExamLab("sprint", form.questions, {});
    const debrief = buildAuthoredExamDebrief(result, "2026-07-12T12:00:00.000Z");
    expect(debrief.priorities).toHaveLength(2);
    expect(debrief.nextAction).toContain("Assign");
    expect(debrief.generation.mode).toBe("authored-fallback");
  });
});
