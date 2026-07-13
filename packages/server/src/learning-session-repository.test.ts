import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import type { LearningBankInput } from "./learning-session-repository";
import { FileLearningSessionRepository } from "./learning-session-repository";

const bank: LearningBankInput = {
  version: "test-bank-v1",
  skills: [
    {
      slug: "sentence-boundaries",
      label: "Sentence boundaries",
      section: "english",
      category: "Conventions",
      diagnosticSkill: "sentence-boundaries",
    },
    {
      slug: "linear-equations",
      label: "Linear equations",
      section: "math",
      category: "Algebra",
      diagnosticSkill: "linear-equations",
    },
  ],
  lessons: [
    {
      id: "sentence-boundaries-lesson-v1",
      skill: "sentence-boundaries",
      title: "Sentence boundaries",
      minutes: 7,
      objective: "Find complete sentence boundaries.",
      concept: "A complete sentence needs a subject, verb, and complete thought.",
      steps: ["Find the subject.", "Find the verb.", "Check for a complete thought."],
      workedExample: {
        prompt: "Because the door opened.",
        answer: "Fragment",
        explanation: ["Because makes the clause dependent.", "No independent clause follows."],
      },
      trap: "Do not use pauses as a punctuation rule.",
    },
  ],
  practice: Array.from({ length: 5 }, (_, index) => ({
    id: `sentence-boundaries-practice-${index + 1}`,
    version: 1,
    skill: "sentence-boundaries",
    section: "english",
    difficulty: index < 2 ? "easy" : index < 4 ? "medium" : "hard",
    prompt: `Practice prompt ${index + 1}`,
    choices: [
      { id: "A", text: "Correct" },
      { id: "B", text: "Distractor", misconception: "This distractor adds unsupported logic." },
      { id: "C", text: "Distractor two" },
      { id: "D", text: "Distractor three" },
    ],
    correctChoiceId: "A",
    rationale: "The correct answer follows the tested rule.",
  })),
};

const plan = {
  goalScore: 31,
  currentScore: 24,
  daysUntilTest: 42,
  minutesPerSession: 35,
} as const;

async function withRepository<T>(run: (repo: FileLearningSessionRepository, path: string) => Promise<T>) {
  const dir = await mkdtemp(join(tmpdir(), "act-learning-"));
  const filePath = join(dir, "learning.json");
  try {
    return await run(new FileLearningSessionRepository(filePath), filePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("FileLearningSessionRepository", () => {
  it("starts a public learning session without answer keys", async () => {
    await withRepository(async (repo) => {
      const { payload } = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        diagnosticSkillResults: [{ skill: "sentence-boundaries", label: "Sentence boundaries", section: "english", correct: 0, total: 2, accuracy: 0, signal: "focus" }],
        plan,
      });

      expect(payload.questions).toHaveLength(5);
      expect(JSON.stringify(payload.questions)).not.toContain("correctChoiceId");
      expect(JSON.stringify(payload.questions)).not.toContain("rationale");
      expect(payload.mastery.mastery).toBeCloseTo(0.25);
    });
  });

  it("persists lesson completion and answer feedback across repository instances", async () => {
    await withRepository(async (repo, filePath) => {
      const started = await repo.getOrCreate(null, bank, { skill: "sentence-boundaries", plan });
      await repo.completeLesson(started.sessionId, bank);
      const answered = await repo.answerQuestion(started.sessionId, bank, {
        questionId: "sentence-boundaries-practice-1",
        choiceId: "B",
      });

      expect(answered.lastFeedback?.correct).toBe(false);
      expect(answered.lastFeedback?.misconception).toContain("unsupported");

      const restarted = new FileLearningSessionRepository(filePath);
      const resumed = await restarted.get(started.sessionId, bank);
      expect(resumed.lessonComplete).toBe(true);
      expect(resumed.answeredQuestionIds).toEqual(["sentence-boundaries-practice-1"]);
    });
  });

  it("returns the same feedback for duplicate identical answers", async () => {
    await withRepository(async (repo) => {
      const started = await repo.getOrCreate(null, bank, { skill: "sentence-boundaries", plan });
      await repo.completeLesson(started.sessionId, bank);
      const first = await repo.answerQuestion(started.sessionId, bank, {
        questionId: "sentence-boundaries-practice-1",
        choiceId: "A",
      });
      const duplicate = await repo.answerQuestion(started.sessionId, bank, {
        questionId: "sentence-boundaries-practice-1",
        choiceId: "A",
      });

      expect(duplicate.lastFeedback).toEqual(first.lastFeedback);
      expect(duplicate.answeredQuestionIds).toHaveLength(1);
    });
  });

  it("does not store public-only payloads as the source of truth", async () => {
    await withRepository(async (repo, filePath) => {
      const started = await repo.getOrCreate(null, bank, { skill: "sentence-boundaries", plan });
      await repo.completeLesson(started.sessionId, bank);
      await repo.answerQuestion(started.sessionId, bank, {
        questionId: "sentence-boundaries-practice-1",
        choiceId: "A",
      });

      const raw = await readFile(filePath, "utf8");
      expect(raw).toContain("The correct answer follows the tested rule.");
    });
  });
});
