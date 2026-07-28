import { describe, expect, it } from "vitest";

import {
  ACT_LEARNING_BANK,
  ACT_LESSONS,
  ACT_PRACTICE_QUESTIONS,
  ACT_SKILLS,
} from "./learning-content";
import { REVIEWED_ACT_QUESTION_EXAMPLES } from "./question-generation-examples";
import { validateLearningBank } from "./learning-schema";

describe("ACT learning content", () => {
  it("validates the published adaptive learning bank", () => {
    expect(() => validateLearningBank(ACT_LEARNING_BANK)).not.toThrow();
  });

  it("contains one lesson and five focused questions for every skill", () => {
    for (const skill of ACT_SKILLS) {
      expect(
        ACT_LESSONS.filter((lesson) => lesson.skill === skill.slug),
      ).toHaveLength(1);
      expect(
        ACT_PRACTICE_QUESTIONS.filter(
          (question) => question.skill === skill.slug,
        ),
      ).toHaveLength(5);
    }
  });

  it("keeps answer keys and rationales in secure practice records only", () => {
    for (const question of ACT_PRACTICE_QUESTIONS) {
      expect(question.choices.map((choice) => choice.id)).toContain(
        question.correctChoiceId,
      );
      expect(question.rationale.length).toBeGreaterThan(20);
      expect(question.content.license).toBe("original");
    }
  });

  it("uses rotated keys and skill-specific distractors instead of placeholders", () => {
    expect(
      new Set(
        ACT_PRACTICE_QUESTIONS.map((question) => question.correctChoiceId),
      ),
    ).toEqual(new Set(["A", "B", "C", "D"]));
    const serializedChoices = JSON.stringify(
      ACT_PRACTICE_QUESTIONS.flatMap((question) => question.choices),
    );
    expect(serializedChoices).not.toContain("Opposite relationship");
    expect(serializedChoices).not.toContain("Too broad");
    expect(serializedChoices).not.toContain("Not enough information");
    for (const question of ACT_PRACTICE_QUESTIONS) {
      expect(new Set(question.choices.map((choice) => choice.text)).size).toBe(
        4,
      );
    }
  });

  it("puts a reviewed, substantive hard item at the end of every skill set", () => {
    for (const skill of ACT_SKILLS) {
      const practice = ACT_PRACTICE_QUESTIONS.filter(
        (question) => question.skill === skill.slug,
      );
      const hardAnchor = REVIEWED_ACT_QUESTION_EXAMPLES.find(
        (example) => example.skill === skill.slug,
      );

      expect(practice.map((question) => question.difficulty)).toEqual([
        "easy",
        "medium",
        "medium",
        "medium",
        "hard",
      ]);
      expect(practice[4]?.version).toBe(2);
      expect(practice[4]?.prompt).toBe(hardAnchor?.prompt);
      expect(practice[4]?.rationale).toBe(hardAnchor?.rationale);
    }
  });
});
