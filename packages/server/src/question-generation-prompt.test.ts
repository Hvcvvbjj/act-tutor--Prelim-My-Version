import { describe, expect, it } from "vitest";

import {
  buildActQuestionGenerationMessages,
  buildDefaultQuestionDifficultyPlan,
  QUESTION_GENERATION_PROMPT_VERSION,
} from "./question-generation-prompt";

const geometryInput = {
  section: "math" as const,
  skill: {
    slug: "geometry-and-measurement",
    label: "Geometry and measurement",
    category: "Geometry",
  },
  count: 5,
  purpose: "lesson-progress" as const,
};

describe("ACT question generation prompt", () => {
  it("raises the default practice mix to medium and hard items", () => {
    expect(buildDefaultQuestionDifficultyPlan(8, "lesson-progress")).toEqual([
      "medium",
      "hard",
      "medium",
      "hard",
      "medium",
      "hard",
      "medium",
      "hard",
    ]);
    expect(
      buildDefaultQuestionDifficultyPlan(10, "full-test").filter(
        (difficulty) => difficulty === "easy",
      ),
    ).toHaveLength(2);
  });

  it("includes the explicit rubric and reviewed same-section few-shot examples", () => {
    const messages = buildActQuestionGenerationMessages(geometryInput);
    const request = JSON.parse(messages[1]?.content ?? "{}") as {
      promptVersion: string;
      difficultyPlan: string[];
      requestedDifficultyRubric: Record<string, unknown>;
      reviewedOriginalFewShotExamples: Array<{
        skill: string;
        section: string;
        content: { license: string };
      }>;
      finalChecks: string[];
    };

    expect(messages[0]?.content).toMatch(
      /never quote, reconstruct, lightly paraphrase/i,
    );
    expect(messages[0]?.content).toMatch(
      /Medium and hard questions must require linked reasoning/i,
    );
    expect(request.promptVersion).toBe(QUESTION_GENERATION_PROMPT_VERSION);
    expect(request.difficultyPlan).toEqual([
      "medium",
      "hard",
      "medium",
      "hard",
      "medium",
    ]);
    expect(Object.keys(request.requestedDifficultyRubric).sort()).toEqual([
      "hard",
      "medium",
    ]);
    expect(request.reviewedOriginalFewShotExamples).toHaveLength(4);
    expect(request.reviewedOriginalFewShotExamples[0]?.skill).toBe(
      "geometry-and-measurement",
    );
    expect(
      request.reviewedOriginalFewShotExamples.every(
        (example) =>
          example.section === "math" && example.content.license === "original",
      ),
    ).toBe(true);
    expect(request.finalChecks.join(" ")).toMatch(
      /four unique choices|misconception|independently verifies/i,
    );
  });

  it("anchors English and Reading generations to examples from their own section", () => {
    for (const [section, skill] of [
      ["english", "logical-transitions"],
      ["reading", "supported-inference"],
    ] as const) {
      const messages = buildActQuestionGenerationMessages({
        section,
        skill: {
          slug: skill,
          label: skill,
          category: "Test category",
        },
        count: 2,
        purpose: "adaptive-practice",
      });
      const request = JSON.parse(messages[1]?.content ?? "{}") as {
        reviewedOriginalFewShotExamples: Array<{
          section: string;
          skill: string;
        }>;
        sectionRequirements: string;
      };

      expect(
        request.reviewedOriginalFewShotExamples.every(
          (example) => example.section === section,
        ),
      ).toBe(true);
      expect(request.reviewedOriginalFewShotExamples[0]?.skill).toBe(skill);
      expect(request.sectionRequirements.length).toBeGreaterThan(100);
    }
  });

  it("honors an explicit difficulty plan and rejects malformed requests", () => {
    const messages = buildActQuestionGenerationMessages({
      ...geometryInput,
      count: 3,
      difficultyPlan: ["easy", "medium", "hard"],
    });
    const request = JSON.parse(messages[1]?.content ?? "{}") as {
      difficultyPlan: string[];
      requestedDifficultyRubric: Record<string, unknown>;
    };

    expect(request.difficultyPlan).toEqual(["easy", "medium", "hard"]);
    expect(Object.keys(request.requestedDifficultyRubric).sort()).toEqual([
      "easy",
      "hard",
      "medium",
    ]);
    expect(() =>
      buildActQuestionGenerationMessages({
        ...geometryInput,
        count: 2,
        difficultyPlan: ["hard"],
      }),
    ).toThrow(/one level per requested question/);
    expect(() => buildDefaultQuestionDifficultyPlan(0, "diagnostic")).toThrow(
      /integer from 1 to 60/,
    );
  });
});
