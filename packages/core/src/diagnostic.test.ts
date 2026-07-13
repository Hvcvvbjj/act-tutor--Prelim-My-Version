import { describe, expect, it } from "vitest";

import {
  diagnosticResultToEvidence,
  scoreDiagnostic,
  toPublicDiagnosticForm,
  type DiagnosticAnswer,
  type DiagnosticFormSecure,
  type DiagnosticQuestionSecure,
} from "./diagnostic";

function question(
  id: string,
  section: "english" | "math" | "reading",
  skill: string,
  correctChoiceId = "b",
): DiagnosticQuestionSecure {
  return {
    id,
    version: 1,
    section,
    category: "test category",
    primarySkill: skill,
    skillLabel: skill,
    difficulty: "medium",
    prompt: `Prompt for ${id}`,
    choices: [
      { id: "a", text: "Choice A" },
      { id: "b", text: "Choice B" },
      { id: "c", text: "Choice C" },
      { id: "d", text: "Choice D" },
    ],
    expectedSeconds: 60,
    correctChoiceId,
    rationale: `Rationale for ${id}`,
  };
}

const FORM: DiagnosticFormSecure = {
  id: "fixture",
  version: "fixture-v1",
  mode: "starter",
  title: "Fixture diagnostic",
  estimatedMinutes: 3,
  questions: [
    question("e1", "english", "boundaries"),
    question("e2", "english", "boundaries"),
    question("m1", "math", "algebra"),
    question("m2", "math", "algebra"),
    question("r1", "reading", "inference"),
    question("r2", "reading", "inference"),
  ],
};

function answers(choiceByQuestion: Record<string, string>): DiagnosticAnswer[] {
  return FORM.questions.map((item) => ({
    questionId: item.id,
    choiceId: choiceByQuestion[item.id] ?? "b",
  }));
}

describe("diagnostic form boundary", () => {
  it("removes answer keys and rationales from the public form", () => {
    const publicForm = toPublicDiagnosticForm(FORM);
    const serialized = JSON.stringify(publicForm);

    expect(serialized).not.toContain("correctChoiceId");
    expect(serialized).not.toContain("Rationale");
    expect(publicForm.questions).toHaveLength(6);
  });
});

describe("scoreDiagnostic", () => {
  it("scores a complete response deterministically", () => {
    const first = scoreDiagnostic(FORM, answers({}));
    const second = scoreDiagnostic(FORM, answers({}));

    expect(first).toEqual(second);
    expect(first.sectionResults.every((section) => section.correct === 2)).toBe(
      true,
    );
    expect(first.compositeRange.estimate).toBe(27);
    expect(first.strengths.map((skill) => skill.skill)).toEqual([
      "algebra",
      "boundaries",
    ]);
  });

  it("returns wide estimated ranges for the starter form", () => {
    const result = scoreDiagnostic(
      FORM,
      answers({ e1: "a", e2: "a", m1: "a", r1: "a" }),
    );

    expect(
      result.compositeRange.high - result.compositeRange.low,
    ).toBeGreaterThan(5);
    expect(result.focusSkills.length).toBeGreaterThan(0);
  });

  it("converts the result into low-confidence planning evidence", () => {
    const result = scoreDiagnostic(FORM, answers({ m1: "a", m2: "a" }));
    const evidence = diagnosticResultToEvidence(result);

    expect(evidence.source).toBe("starter_diagnostic");
    expect(evidence.confidence).toBe("low");
    expect(evidence.planningBaseline).toEqual(result.planningBaseline);
  });

  it("rejects missing answers", () => {
    expect(() => scoreDiagnostic(FORM, answers({}).slice(0, -1))).toThrow(
      "Every diagnostic question must be answered",
    );
  });

  it("rejects duplicate answers", () => {
    const response = answers({});
    expect(() => scoreDiagnostic(FORM, [...response, response[0]])).toThrow(
      "Duplicate answer",
    );
  });

  it("rejects choices that do not exist", () => {
    expect(() => scoreDiagnostic(FORM, answers({ e1: "missing" }))).toThrow(
      "Unknown choice",
    );
  });

  it("rejects unknown question IDs", () => {
    const response = answers({});
    response[0] = { questionId: "unknown", choiceId: "a" };
    expect(() => scoreDiagnostic(FORM, response)).toThrow("Unknown diagnostic");
  });
});
