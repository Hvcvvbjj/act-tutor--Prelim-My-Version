import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    {
      slug: "supported-inference",
      label: "Supported inference",
      section: "reading",
      category: "Key Ideas",
      diagnosticSkill: "supported-inference",
    },
  ],
  lessons: [
    {
      id: "sentence-boundaries-lesson-v1",
      skill: "sentence-boundaries",
      title: "Sentence boundaries",
      minutes: 7,
      objective: "Find complete sentence boundaries.",
      concept:
        "A complete sentence needs a subject, verb, and complete thought.",
      steps: [
        "Find the subject.",
        "Find the verb.",
        "Check for a complete thought.",
      ],
      workedExample: {
        prompt: "Because the door opened.",
        answer: "Fragment",
        explanation: [
          "Because makes the clause dependent.",
          "No independent clause follows.",
        ],
      },
      trap: "Do not use pauses as a punctuation rule.",
    },
    {
      id: "linear-equations-lesson-v1",
      skill: "linear-equations",
      title: "Linear equations",
      minutes: 7,
      objective: "Solve one-variable equations.",
      concept: "Undo operations while keeping both sides balanced.",
      steps: ["Combine terms.", "Undo addition.", "Undo multiplication."],
      workedExample: {
        prompt: "2x + 4 = 10",
        answer: "x = 3",
        explanation: ["Subtract 4.", "Divide by 2."],
      },
      trap: "Apply every operation to both sides.",
    },
    {
      id: "supported-inference-lesson-v1",
      skill: "supported-inference",
      title: "Supported inference",
      minutes: 7,
      objective: "Choose the inference with direct textual support.",
      concept: "An inference must follow from passage evidence.",
      steps: [
        "Find the claim.",
        "Locate evidence.",
        "Reject added assumptions.",
      ],
      workedExample: {
        prompt: "The lights are off and the door is locked.",
        answer: "The building may be closed.",
        explanation: ["Both details support the cautious inference."],
      },
      trap: "Do not turn a possibility into a certainty.",
    },
  ],
  practice: [
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `sentence-boundaries-practice-${index + 1}`,
      version: 1,
      skill: "sentence-boundaries",
      section: "english" as const,
      difficulty:
        index < 2
          ? ("easy" as const)
          : index < 4
            ? ("medium" as const)
            : ("hard" as const),
      prompt: `Practice prompt ${index + 1}`,
      choices: [
        { id: "A", text: "Correct" },
        {
          id: "B",
          text: "Distractor",
          misconception: "This distractor adds unsupported logic.",
        },
        { id: "C", text: "Distractor two" },
        { id: "D", text: "Distractor three" },
      ],
      correctChoiceId: "A",
      rationale: "The correct answer follows the tested rule.",
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `linear-equations-practice-${index + 1}`,
      version: 1,
      skill: "linear-equations",
      section: "math" as const,
      difficulty: "medium" as const,
      prompt: `Math practice ${index + 1}`,
      choices: [
        { id: "A", text: "Correct" },
        { id: "B", text: "Distractor" },
        { id: "C", text: "Distractor two" },
        { id: "D", text: "Distractor three" },
      ],
      correctChoiceId: "A",
      rationale: "Balance the equation.",
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `supported-inference-practice-${index + 1}`,
      version: 1,
      skill: "supported-inference",
      section: "reading" as const,
      difficulty: "hard" as const,
      prompt: `Reading practice ${index + 1}`,
      choices: [
        { id: "A", text: "Correct" },
        { id: "B", text: "Distractor" },
        { id: "C", text: "Distractor two" },
        { id: "D", text: "Distractor three" },
      ],
      correctChoiceId: "A",
      rationale: "Use only supported evidence.",
    })),
  ],
};

const plan = {
  goalScore: 31,
  currentScore: 24,
  daysUntilTest: 42,
  minutesPerSession: 35,
} as const;

async function withRepository<T>(
  run: (repo: FileLearningSessionRepository, path: string) => Promise<T>,
) {
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
        diagnosticSkillResults: [
          {
            skill: "sentence-boundaries",
            label: "Sentence boundaries",
            section: "english",
            correct: 0,
            total: 2,
            accuracy: 0,
            signal: "focus",
          },
        ],
        plan,
      });

      expect(payload.questions).toHaveLength(5);
      expect(JSON.stringify(payload.questions)).not.toContain(
        "correctChoiceId",
      );
      expect(JSON.stringify(payload.questions)).not.toContain("rationale");
      expect(payload.mastery.mastery).toBeCloseTo(0.25);
      expect(payload.learningTwin.model.shortName).toBe("BKT");
      expect(
        payload.learningTwin.skills.find(
          (skill) => skill.skill === "sentence-boundaries",
        )?.priorSource,
      ).toBe("diagnostic");
      expect(JSON.stringify(payload.learningTwin)).not.toContain(
        "correctChoiceId",
      );
    });
  });

  it("persists lesson completion and answer feedback across repository instances", async () => {
    await withRepository(async (repo, filePath) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan,
      });
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
      expect(resumed.answeredQuestionIds).toEqual([
        "sentence-boundaries-practice-1",
      ]);
    });
  });

  it("returns the same feedback for duplicate identical answers", async () => {
    await withRepository(async (repo) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan,
      });
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

  it("updates and persists the BKT learner model from server-scored evidence", async () => {
    await withRepository(async (repo, filePath) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        diagnosticSkillResults: [
          {
            skill: "sentence-boundaries",
            label: "Sentence boundaries",
            section: "english",
            correct: 1,
            total: 2,
            accuracy: 0.5,
            signal: "focus",
          },
        ],
        plan,
      });
      const before = started.payload.learningTwin.skills.find(
        (skill) => skill.skill === "sentence-boundaries",
      );
      await repo.completeLesson(started.sessionId, bank);
      const answered = await repo.answerQuestion(started.sessionId, bank, {
        questionId: "sentence-boundaries-practice-1",
        choiceId: "B",
      });
      const after = answered.learningTwin.skills.find(
        (skill) => skill.skill === "sentence-boundaries",
      );

      expect(before).toBeDefined();
      expect(after?.learnedProbability).toBeLessThan(
        before?.learnedProbability ?? 0,
      );
      expect(answered.learningTwin.events).toHaveLength(1);
      expect(answered.learningTwin.events[0]).toMatchObject({
        questionId: "sentence-boundaries-practice-1",
        correct: false,
        difficulty: "easy",
      });
      expect(answered.futureTask.reason).toContain("ranks first");

      const restarted = new FileLearningSessionRepository(filePath);
      const resumed = await restarted.get(started.sessionId, bank);
      expect(resumed.learningTwin.events).toEqual(answered.learningTwin.events);
      expect(
        resumed.learningTwin.skills.find(
          (skill) => skill.skill === "sentence-boundaries",
        )?.learnedProbability,
      ).toBe(after?.learnedProbability);
    });
  });

  it("migrates and persists a legacy session before returning it", async () => {
    await withRepository(async (repo, filePath) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan,
      });
      const legacy = JSON.parse(await readFile(filePath, "utf8")) as {
        sessions: Record<string, Record<string, unknown>>;
      };
      delete legacy.sessions[started.sessionId].learningTwinBySkill;
      delete legacy.sessions[started.sessionId].learningTwinEvents;
      delete legacy.sessions[started.sessionId].planContext;
      await writeFile(filePath, `${JSON.stringify(legacy, null, 2)}\n`);

      const restarted = new FileLearningSessionRepository(filePath);
      const migrated = await restarted.getOrCreate(started.sessionId, bank, {
        skill: "sentence-boundaries",
        plan,
      });
      expect(migrated.payload.learningTwin.skills).toHaveLength(3);
      expect(
        migrated.payload.learningTwin.skills.every(
          (skill) => skill.priorSource === "score-estimate",
        ),
      ).toBe(true);

      const persisted = await readFile(filePath, "utf8");
      expect(persisted).toContain('"learningTwinBySkill"');
      expect(persisted).toContain('"planContext"');
    });
  });

  it("does not store public-only payloads as the source of truth", async () => {
    await withRepository(async (repo, filePath) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan,
      });
      await repo.completeLesson(started.sessionId, bank);
      await repo.answerQuestion(started.sessionId, bank, {
        questionId: "sentence-boundaries-practice-1",
        choiceId: "A",
      });

      const raw = await readFile(filePath, "utf8");
      expect(raw).toContain("The correct answer follows the tested rule.");
    });
  });

  it("turns misses into a replayable mistake and resolves them for bonus XP", async () => {
    await withRepository(async (repo) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan,
      });
      await repo.completeLesson(started.sessionId, bank);
      let payload = await repo.answerQuestion(started.sessionId, bank, {
        questionId: "sentence-boundaries-practice-1",
        choiceId: "B",
      });
      for (let index = 2; index <= 5; index += 1) {
        payload = await repo.answerQuestion(started.sessionId, bank, {
          questionId: `sentence-boundaries-practice-${index}`,
          choiceId: "A",
        });
      }

      expect(payload.status).toBe("complete");
      expect(payload.mission.progress.xp).toBeGreaterThan(20);
      expect(payload.mission.unresolvedMistakes).toBe(1);
      const mistake = payload.mission.mistakes[0];

      const repair = await repo.beginRepair(
        started.sessionId,
        bank,
        mistake.id,
      );
      expect(repair.mode).toBe("repair");
      expect(repair.questions).toHaveLength(1);
      const repaired = await repo.answerQuestion(started.sessionId, bank, {
        questionId: mistake.questionId,
        choiceId: "A",
      });
      expect(repaired.mission.unresolvedMistakes).toBe(0);
      expect(repaired.mission.mistakes[0].resolvedAt).not.toBeNull();
      expect(repaired.mission.progress.xp).toBeGreaterThan(
        payload.mission.progress.xp,
      );
    });
  });

  it("builds a mixed checkpoint from the three weakest skill models", async () => {
    await withRepository(async (repo) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan,
      });
      await repo.completeLesson(started.sessionId, bank);
      for (let index = 1; index <= 5; index += 1) {
        await repo.answerQuestion(started.sessionId, bank, {
          questionId: `sentence-boundaries-practice-${index}`,
          choiceId: "A",
        });
      }
      const checkpoint = await repo.beginCheckpoint(started.sessionId, bank);
      expect(checkpoint.mode).toBe("checkpoint");
      expect(checkpoint.questions).toHaveLength(3);
      expect(
        new Set(checkpoint.questions.map((question) => question.skill)).size,
      ).toBe(3);
      expect(JSON.stringify(checkpoint.questions)).not.toContain(
        "correctChoiceId",
      );
    });
  });

  it("starts a selected next skill without losing cumulative profile progress", async () => {
    await withRepository(async (repo) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan,
      });
      await repo.completeLesson(started.sessionId, bank);
      let completed = started.payload;
      for (let index = 1; index <= 5; index += 1) {
        completed = await repo.answerQuestion(started.sessionId, bank, {
          questionId: `sentence-boundaries-practice-${index}`,
          choiceId: "A",
        });
      }

      const next = await repo.beginFocus(started.sessionId, bank, {
        skill: "linear-equations",
        plan,
      });
      expect(next.todaySkill).toBe("linear-equations");
      expect(next.nextSkill).toBe("linear-equations");
      expect(next.status).toBe("lesson");
      expect(next.mission.progress.xp).toBe(completed.mission.progress.xp);
      expect(
        next.mission.skillMap.find(
          (skill) => skill.skill === "sentence-boundaries",
        )?.evidence,
      ).toBe(5);
    });
  });
});
