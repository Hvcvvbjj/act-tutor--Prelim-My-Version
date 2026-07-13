import { describe, expect, it } from "vitest";

import {
  ACT_LEARNING_BANK,
  ACT_LESSONS,
  ACT_PRACTICE_QUESTIONS,
  ACT_SKILLS,
} from "./learning-content";
import { validateLearningBank } from "./learning-schema";

describe("ACT learning content", () => {
  it("validates the published adaptive learning bank", () => {
    expect(() => validateLearningBank(ACT_LEARNING_BANK)).not.toThrow();
  });

  it("contains one lesson and five focused questions for every skill", () => {
    for (const skill of ACT_SKILLS) {
      expect(ACT_LESSONS.filter((lesson) => lesson.skill === skill.slug)).toHaveLength(1);
      expect(ACT_PRACTICE_QUESTIONS.filter((question) => question.skill === skill.slug)).toHaveLength(5);
    }
  });

  it("keeps answer keys and rationales in secure practice records only", () => {
    for (const question of ACT_PRACTICE_QUESTIONS) {
      expect(question.choices.map((choice) => choice.id)).toContain(question.correctChoiceId);
      expect(question.rationale.length).toBeGreaterThan(20);
      expect(question.content.license).toBe("original");
    }
  });
});
