import { describe, expect, it } from "vitest";

import { RAPID_DIAGNOSTIC_FORM } from "./rapid-diagnostic";
import { validateRapidDiagnosticForm } from "./schema";

function mutableFixture() {
  return structuredClone(RAPID_DIAGNOSTIC_FORM);
}

describe("rapid diagnostic content", () => {
  it("publishes 24 validated items across 3 sections and 12 skills", () => {
    const form = validateRapidDiagnosticForm(RAPID_DIAGNOSTIC_FORM);
    const skills = new Set(
      form.questions.map((question) => question.primarySkill),
    );

    expect(form.questions).toHaveLength(24);
    expect(form.questions.filter((item) => item.section === "english")).toHaveLength(8);
    expect(form.questions.filter((item) => item.section === "math")).toHaveLength(8);
    expect(form.questions.filter((item) => item.section === "reading")).toHaveLength(8);
    expect(skills.size).toBe(12);
    expect(
      form.questions.every(
        (question) =>
          question.content.status === "published" &&
          question.content.license === "original",
      ),
    ).toBe(true);
  });

  it("rejects duplicate question IDs", () => {
    const form = mutableFixture();
    form.questions[1].id = form.questions[0].id;
    expect(() => validateRapidDiagnosticForm(form)).toThrow(
      "Question IDs must be unique",
    );
  });

  it("rejects keys that do not identify a choice", () => {
    const form = mutableFixture();
    form.questions[0].correctChoiceId = "missing";
    expect(() => validateRapidDiagnosticForm(form)).toThrow(
      "The correct choice must exist",
    );
  });

  it("rejects an invalid section blueprint", () => {
    const form = mutableFixture();
    form.questions[0].section = "math";
    expect(() => validateRapidDiagnosticForm(form)).toThrow(
      "Rapid blueprint requires 8 english questions",
    );
  });

  it("rejects missing review metadata", () => {
    const form = mutableFixture() as unknown as {
      questions: Array<{ content: { reviewer?: string } }>;
    };
    delete form.questions[0].content.reviewer;
    expect(() => validateRapidDiagnosticForm(form)).toThrow();
  });
});
