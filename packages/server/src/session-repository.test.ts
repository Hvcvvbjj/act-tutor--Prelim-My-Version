import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  DiagnosticAnswer,
  DiagnosticFormSecure,
  DiagnosticQuestionSecure,
} from "@act-tutor/core";
import { afterEach, describe, expect, it } from "vitest";

import { FileDiagnosticSessionRepository } from "./session-repository";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

function question(
  id: string,
  section: "english" | "math" | "reading",
): DiagnosticQuestionSecure {
  return {
    id,
    version: 1,
    section,
    category: "Fixture category",
    primarySkill: `${section}-skill`,
    skillLabel: `${section} skill`,
    difficulty: "medium",
    prompt: `Which choice is correct for ${id}?`,
    choices: [
      { id: "a", text: "Incorrect" },
      { id: "b", text: "Correct" },
      { id: "c", text: "Incorrect again" },
      { id: "d", text: "Still incorrect" },
    ],
    expectedSeconds: 45,
    format: "standalone",
    correctChoiceId: "b",
    rationale: "Choice B is the authored correct response for this fixture.",
    content: {
      status: "published",
      license: "original",
      reviewer: "Fixture reviewer",
      reviewedAt: "2026-07-12",
    },
  };
}

const FORM: DiagnosticFormSecure = {
  id: "session-fixture",
  version: "session-fixture-v1",
  mode: "starter",
  title: "Session fixture",
  estimatedMinutes: 5,
  blueprint: [
    { section: "english", officialQuestions: 50, officialScoredQuestions: 40, officialMinutes: 35, diagnosticQuestions: 2, diagnosticMinutes: 2, reportingCategories: [{ label: "Writing", range: "50%" }, { label: "Language", range: "50%" }] },
    { section: "math", officialQuestions: 45, officialScoredQuestions: 41, officialMinutes: 50, diagnosticQuestions: 2, diagnosticMinutes: 2, reportingCategories: [{ label: "Higher Math", range: "80%" }, { label: "Essential Skills", range: "20%" }] },
    { section: "reading", officialQuestions: 36, officialScoredQuestions: 27, officialMinutes: 40, diagnosticQuestions: 2, diagnosticMinutes: 2, reportingCategories: [{ label: "Ideas", range: "50%" }, { label: "Structure", range: "50%" }] },
  ],
  questions: [
    question("english-1", "english"),
    question("english-2", "english"),
    question("math-1", "math"),
    question("math-2", "math"),
    question("reading-1", "reading"),
    question("reading-2", "reading"),
  ],
};

const ANSWERS: DiagnosticAnswer[] = FORM.questions.map((question) => ({
  questionId: question.id,
  choiceId: question.correctChoiceId,
}));

async function repository() {
  const directory = await mkdtemp(join(tmpdir(), "act-tutor-session-"));
  temporaryDirectories.push(directory);
  const filePath = join(directory, "sessions.json");
  return {
    filePath,
    first: new FileDiagnosticSessionRepository(filePath),
  };
}

describe("FileDiagnosticSessionRepository", () => {
  it("persists progress across repository instances", async () => {
    const { filePath, first } = await repository();
    const created = await first.getOrCreate(null, FORM);
    await first.saveProgress(created.sessionId, FORM, {
      answers: { "english-1": "a" },
      currentIndex: 1,
      phase: "questions",
    });

    const restarted = new FileDiagnosticSessionRepository(filePath);
    const resumed = await restarted.getOrCreate(created.sessionId, FORM);

    expect(resumed.sessionId).toBe(created.sessionId);
    expect(resumed.payload.progress.answers).toEqual({ "english-1": "a" });
    expect(resumed.payload.progress.currentIndex).toBe(1);
    expect(JSON.parse(await readFile(filePath, "utf8")).version).toBe(1);
  });

  it("finalizes once and returns the same result for duplicate submissions", async () => {
    const { first } = await repository();
    const created = await first.getOrCreate(null, FORM);
    const [firstResult, duplicateResult] = await Promise.all([
      first.finalize(created.sessionId, FORM, ANSWERS),
      first.finalize(
        created.sessionId,
        FORM,
        ANSWERS.map((answer) => ({ ...answer, choiceId: "a" })),
      ),
    ]);

    expect(firstResult.status).toBe("completed");
    expect(duplicateResult.result).toEqual(firstResult.result);
    expect(duplicateResult.result?.sectionResults.every((item) => item.correct === 2)).toBe(true);
  });

  it("rejects invalid saved choices without mutating progress", async () => {
    const { first } = await repository();
    const created = await first.getOrCreate(null, FORM);

    await expect(
      first.saveProgress(created.sessionId, FORM, {
        answers: { "english-1": "missing" },
        currentIndex: 0,
        phase: "questions",
      }),
    ).rejects.toThrow("Unknown choice");

    const resumed = await first.getOrCreate(created.sessionId, FORM);
    expect(resumed.payload.progress.answers).toEqual({});
  });
});
