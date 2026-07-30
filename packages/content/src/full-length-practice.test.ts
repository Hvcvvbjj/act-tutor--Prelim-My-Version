import { describe, expect, it } from "vitest";

import { ACT_PRACTICE_QUESTIONS } from "./learning-content";
import { RAPID_DIAGNOSTIC_FORM } from "./rapid-diagnostic";
import {
  EXAM_LAB_FORMS,
  FULL_LENGTH_PRACTICE_FORM,
  FULL_LENGTH_PRACTICE_FORMS,
  PROGRESS_CHECK_FORMS,
  assessmentFormForAttempt,
  assessmentQuestionFingerprint,
} from "./full-length-practice";

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

  it("uses distinct authored forms for full tests and progress checks", () => {
    expect(FULL_LENGTH_PRACTICE_FORMS).toHaveLength(2);
    expect(PROGRESS_CHECK_FORMS).toHaveLength(2);
    expect(EXAM_LAB_FORMS).toHaveLength(4);
    expect(new Set(EXAM_LAB_FORMS.map((form) => form.id)).size).toBe(4);

    for (const form of EXAM_LAB_FORMS) {
      expect(form.questions).toHaveLength(131);
      expect(
        form.questions.filter((question) => question.section === "english"),
      ).toHaveLength(50);
      expect(
        form.questions.filter((question) => question.section === "math"),
      ).toHaveLength(45);
      expect(
        form.questions.filter((question) => question.section === "reading"),
      ).toHaveLength(36);
    }
  });

  it("rotates sequential attempts within the correct disjoint form family", () => {
    expect(assessmentFormForAttempt("full-test", 0).id).toBe(
      FULL_LENGTH_PRACTICE_FORMS[0].id,
    );
    expect(assessmentFormForAttempt("full-test", 1).id).toBe(
      FULL_LENGTH_PRACTICE_FORMS[1].id,
    );
    expect(assessmentFormForAttempt("full-test", 2).id).toBe(
      FULL_LENGTH_PRACTICE_FORMS[0].id,
    );
    expect(assessmentFormForAttempt("progress-check", 0).id).toBe(
      PROGRESS_CHECK_FORMS[0].id,
    );
    expect(assessmentFormForAttempt("progress-check", 1).id).toBe(
      PROGRESS_CHECK_FORMS[1].id,
    );
    expect(assessmentFormForAttempt("progress-check", 2).id).toBe(
      PROGRESS_CHECK_FORMS[0].id,
    );
  });

  it("has zero exact question overlap across lessons, baseline, full tests, and progress checks", () => {
    const surfaces = [
      {
        name: "lesson practice",
        fingerprints: new Set(
          ACT_PRACTICE_QUESTIONS.map(assessmentQuestionFingerprint),
        ),
      },
      {
        name: "66-question diagnostic",
        fingerprints: new Set(
          RAPID_DIAGNOSTIC_FORM.questions.map(assessmentQuestionFingerprint),
        ),
      },
      ...FULL_LENGTH_PRACTICE_FORMS.map((form, index) => ({
        name: `full test ${index + 1}`,
        fingerprints: new Set(
          form.questions.map(assessmentQuestionFingerprint),
        ),
      })),
      ...PROGRESS_CHECK_FORMS.map((form, index) => ({
        name: `progress check ${index + 1}`,
        fingerprints: new Set(
          form.questions.map(assessmentQuestionFingerprint),
        ),
      })),
    ];

    for (let leftIndex = 0; leftIndex < surfaces.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < surfaces.length;
        rightIndex += 1
      ) {
        const left = surfaces[leftIndex];
        const right = surfaces[rightIndex];
        const overlap = [...left.fingerprints].filter((fingerprint) =>
          right.fingerprints.has(fingerprint),
        );
        expect(
          overlap,
          `${left.name} overlaps ${right.name}: ${overlap.join(" | ")}`,
        ).toHaveLength(0);
      }
    }
  });

  it("does not inflate obvious one-step items into medium or hard labels", () => {
    const assessed = [
      ...RAPID_DIAGNOSTIC_FORM.questions,
      ...EXAM_LAB_FORMS.flatMap((form) => form.questions),
    ].filter((question) => question.difficulty !== "easy");

    for (const question of assessed) {
      const text =
        `${question.prompt} ${question.stimulus ?? ""}`.toLowerCase();
      expect(text).not.toMatch(
        /what is f\([−-]?\d+\)|which revision removes redundancy/,
      );
      expect(question.rationale.length).toBeGreaterThan(24);
    }
  });

  it("reserves hard labels for questions with additional reasoning demands", () => {
    for (const form of EXAM_LAB_FORMS) {
      const hard = form.questions.filter(
        (question) => question.difficulty === "hard",
      );
      const easy = form.questions.filter(
        (question) => question.difficulty === "easy",
      );

      expect(hard.length).toBeGreaterThanOrEqual(35);
      expect(easy.length).toBeLessThanOrEqual(5);
      for (const item of hard) {
        if (item.section === "english") {
          expect(item.primarySkill).toBe("sentence-boundaries");
          expect(item.prompt).toContain("logical connector");
        }
        if (item.section === "math") {
          expect(item.prompt.toLowerCase()).not.toMatch(
            /^what is \d+% of|what is f\([−-]?\d+\)/,
          );
        }
        if (item.section === "reading") {
          expect(item.prompt).toMatch(
            /inference|primarily serves|most strongly support/i,
          );
        }
      }
    }
  });

  it("keeps the repaired diagnostic items cognitively substantive", () => {
    const functionItem = RAPID_DIAGNOSTIC_FORM.questions.find(
      (question) => question.id === "math-02",
    );
    const concisionItem = RAPID_DIAGNOSTIC_FORM.questions.find(
      (question) => question.id === "eng-clay-4",
    );

    expect(functionItem?.prompt).toContain("g(x) = f(x + 2)");
    expect(functionItem?.rationale).toContain("Expanding");
    expect(concisionItem?.prompt).toContain("both benefits");
    expect(concisionItem?.rationale).toContain("testing a proposed function");
    expect(concisionItem?.rationale).toContain(
      "protecting the fragile original",
    );
  });

  it("keeps all 650 audited question records structurally and typographically clean", () => {
    const questions = [
      ...RAPID_DIAGNOSTIC_FORM.questions,
      ...ACT_PRACTICE_QUESTIONS,
      ...EXAM_LAB_FORMS.flatMap((form) => form.questions),
    ];

    expect(questions).toHaveLength(650);
    for (const question of questions) {
      expect(question.prompt).toBe(question.prompt.trim());
      expect(question.rationale).toMatch(/[.!?]$/);
      expect(new Set(question.choices.map((choice) => choice.id)).size).toBe(4);
      expect(
        new Set(question.choices.map((choice) => choice.text.toLowerCase()))
          .size,
      ).toBe(4);
      expect(
        question.choices.some(
          (choice) => choice.id === question.correctChoiceId,
        ),
      ).toBe(true);

      const serialized = JSON.stringify(question);
      expect(serialized).not.toMatch(
        /probability both|how many blue\?|negative 1|\b[0-9]pi\b|\ba (?:8|11)-/,
      );
      if (
        question.section === "english" &&
        /-english-(?:38|39|4[0-9]|50)$/.test(question.id)
      ) {
        expect(question.stimulus).not.toMatch(
          /^(?:During|In the)[^.!?]+, [A-Z][a-z]+/,
        );
      }
      if (
        question.section === "english" &&
        /-english-(?:01|05|09|13)$/.test(question.id)
      ) {
        expect(question.prompt).toContain(
          "without changing their logical relationship",
        );
      }
    }
  });
});
