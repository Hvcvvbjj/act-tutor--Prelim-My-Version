import { describe, expect, it } from "vitest";

import { RAPID_DIAGNOSTIC_FORM } from "./rapid-diagnostic";
import { validateRapidDiagnosticForm } from "./schema";

function mutableFixture() {
  return structuredClone(RAPID_DIAGNOSTIC_FORM);
}

describe("half-length diagnostic content", () => {
  it("publishes 66 validated ACT-proportioned items across 3 sections and 12 skills", () => {
    const form = validateRapidDiagnosticForm(RAPID_DIAGNOSTIC_FORM);
    const skills = new Set(
      form.questions.map((question) => question.primarySkill),
    );

    expect(form.questions).toHaveLength(66);
    expect(form.questions.filter((item) => item.section === "english")).toHaveLength(25);
    expect(form.questions.filter((item) => item.section === "math")).toHaveLength(23);
    expect(form.questions.filter((item) => item.section === "reading")).toHaveLength(18);
    expect(skills.size).toBe(12);
    expect(
      form.questions.every(
        (question) =>
          question.content.status === "published" &&
          question.content.license === "original",
      ),
    ).toBe(true);
    expect(form.blueprint.map((section) => section.diagnosticQuestions)).toEqual([25, 23, 18]);
    expect(
      form.questions
        .filter((question) => question.section !== "math")
        .every((question) => question.format === "passage" && question.passageId),
    ).toBe(true);
    const categoryCounts = Object.fromEntries(
      ["english", "math", "reading"].map((section) => [
        section,
        form.questions
          .filter((question) => question.section === section)
          .reduce<Record<string, number>>((counts, question) => {
            counts[question.category] = (counts[question.category] ?? 0) + 1;
            return counts;
          }, {}),
      ]),
    );
    expect(categoryCounts).toEqual({
      english: {
        "Conventions of Standard English": 10,
        "Knowledge of Language": 5,
        "Production of Writing": 10,
      },
      math: {
        "Preparing for Higher Math": 18,
        "Integrating Essential Skills": 5,
      },
      reading: {
        "Key Ideas and Details": 9,
        "Craft and Structure": 5,
        "Integration of Knowledge and Ideas": 4,
      },
    });
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
      "Half-length blueprint requires 25 english questions",
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
