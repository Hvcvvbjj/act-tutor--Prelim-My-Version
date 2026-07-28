import { describe, expect, it } from "vitest";

import { ACT_SKILLS } from "./learning-content";
import {
  ACT_QUESTION_DIFFICULTY_RUBRIC,
  getReviewedQuestionExamples,
  REVIEWED_ACT_QUESTION_EXAMPLES,
} from "./question-generation-examples";

describe("reviewed ACT-style question generation examples", () => {
  it("covers every taught question type with original reviewed content", () => {
    expect(
      new Set(REVIEWED_ACT_QUESTION_EXAMPLES.map((example) => example.skill)),
    ).toEqual(new Set(ACT_SKILLS.map((skill) => skill.slug)));

    for (const example of REVIEWED_ACT_QUESTION_EXAMPLES) {
      expect(example.content).toMatchObject({
        status: "published",
        license: "original",
        purpose: "ai-few-shot",
      });
      expect(example.choices).toHaveLength(4);
      expect(new Set(example.choices.map((choice) => choice.text)).size).toBe(
        4,
      );
      expect(example.choices.map((choice) => choice.id)).toContain(
        example.correctChoiceId,
      );
      expect(example.rationale.length).toBeGreaterThan(100);
      expect(example.difficultyEvidence.length).toBeGreaterThanOrEqual(2);
      expect(example.difficulty).not.toBe("easy");
    }
  });

  it("uses substantive passage context for every reading example", () => {
    const readingExamples = getReviewedQuestionExamples("reading");

    expect(readingExamples).toHaveLength(4);
    for (const example of readingExamples) {
      expect(example.stimulus?.length ?? 0).toBeGreaterThan(250);
      expect(example.difficultyEvidence.join(" ")).toMatch(
        /connect|distinguish|sequence|relationship|synthesiz/i,
      );
    }
  });

  it("defines operational standards for every level and section", () => {
    expect(ACT_QUESTION_DIFFICULTY_RUBRIC.sharedRequirements).toHaveLength(5);

    for (const level of ["easy", "medium", "hard"] as const) {
      const standard = ACT_QUESTION_DIFFICULTY_RUBRIC.levels[level];
      expect(standard.label).toBe(level);
      expect(standard.cognitiveDemand.length).toBeGreaterThan(80);
      expect(standard.distractorStandard.length).toBeGreaterThan(70);
      expect(Object.keys(standard.sectionSignals).sort()).toEqual([
        "english",
        "math",
        "reading",
      ]);
    }

    expect(ACT_QUESTION_DIFFICULTY_RUBRIC.levels.hard.cognitiveDemand).toMatch(
      /Several linked decisions|close distinction/,
    );
    expect(
      ACT_QUESTION_DIFFICULTY_RUBRIC.levels.medium.distractorStandard,
    ).toMatch(/partial solution|incomplete reading/);
  });

  it("prioritizes a matching skill before other examples in its section", () => {
    const examples = getReviewedQuestionExamples(
      "math",
      "geometry-and-measurement",
    );

    expect(examples).toHaveLength(4);
    expect(examples[0]?.skill).toBe("geometry-and-measurement");
    expect(examples.every((example) => example.section === "math")).toBe(true);
  });
});
