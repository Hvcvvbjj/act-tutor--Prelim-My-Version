import { describe, expect, it } from "vitest";

import { FULL_LENGTH_PRACTICE_FORM } from "./full-length-practice";

describe("FULL_LENGTH_PRACTICE_FORM", () => {
  it("matches the enhanced full core count and timing", () => {
    expect(FULL_LENGTH_PRACTICE_FORM.estimatedMinutes).toBe(125);
    expect(FULL_LENGTH_PRACTICE_FORM.questions).toHaveLength(131);
    expect(
      FULL_LENGTH_PRACTICE_FORM.questions.filter(
        (question) => question.section === "english",
      ),
    ).toHaveLength(50);
    expect(
      FULL_LENGTH_PRACTICE_FORM.questions.filter(
        (question) => question.section === "math",
      ),
    ).toHaveLength(45);
    expect(
      FULL_LENGTH_PRACTICE_FORM.questions.filter(
        (question) => question.section === "reading",
      ),
    ).toHaveLength(36);
  });

  it("freezes unique public IDs and four-choice reviewed items", () => {
    const ids = FULL_LENGTH_PRACTICE_FORM.questions.map(
      (question) => question.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      FULL_LENGTH_PRACTICE_FORM.questions.every(
        (question) =>
          question.choices.length === 4 &&
          question.choices.some(
            (choice) => choice.id === question.correctChoiceId,
          ) &&
          question.content.license === "original",
      ),
    ).toBe(true);
  });
});
