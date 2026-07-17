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

  it("uses each reported section score for that section's BKT prior", async () => {
    await withRepository(async (repo) => {
      const { payload } = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        diagnosticSkillResults: [],
        plan: {
          ...plan,
          sectionScores: { english: 12, math: 24, reading: 36 },
        },
      });

      const bySkill = new Map(
        payload.learningTwin.skills.map((skill) => [skill.skill, skill]),
      );
      expect(
        bySkill.get("sentence-boundaries")?.learnedProbability,
      ).toBeCloseTo(0.12 + (11 / 35) * 0.76);
      expect(bySkill.get("linear-equations")?.learnedProbability).toBeCloseTo(
        0.12 + (23 / 35) * 0.76,
      );
      expect(bySkill.get("supported-inference")?.learnedProbability).toBe(0.88);
    });
  });

  it("transactionally rebases a temporary no-score session from calibration", async () => {
    await withRepository(async (repo) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan: { ...plan, currentScore: 18 },
      });
      const diagnosticSkillResults = [
        {
          skill: "sentence-boundaries",
          label: "Sentence boundaries",
          section: "english" as const,
          correct: 2,
          total: 2,
          accuracy: 1,
          signal: "strength" as const,
        },
        {
          skill: "linear-equations",
          label: "Linear equations",
          section: "math" as const,
          correct: 0,
          total: 2,
          accuracy: 0,
          signal: "focus" as const,
        },
        {
          skill: "supported-inference",
          label: "Supported inference",
          section: "reading" as const,
          correct: 1,
          total: 2,
          accuracy: 0.5,
          signal: "developing" as const,
        },
      ];

      const rebased = await repo.rebaseAfterCalibration(
        started.sessionId,
        bank,
        {
          calibrationKey: "calibration-1:bank-1",
          diagnosticSkillResults,
          plan: { ...plan, currentScore: 21 },
        },
      );

      expect(rebased.todaySkill).toBe("linear-equations");
      expect(rebased.nextSkill).toBe("linear-equations");
      expect(rebased.lesson.skill).toBe("linear-equations");
      expect(rebased.learningTwin.evidence.calibration).toBe(0);
      expect(
        rebased.questions.every(
          (question) => question.skill === "linear-equations",
        ),
      ).toBe(true);
      expect(rebased.status).toBe("lesson");
      expect(rebased.mission.progress.totalAnswered).toBe(0);
      expect(
        rebased.learningTwin.skills.find(
          (skill) => skill.skill === "linear-equations",
        )?.priorSource,
      ).toBe("diagnostic");
      expect(rebased.futureTask.reason).toContain(
        "replaced the temporary baseline",
      );

      const duplicate = await repo.rebaseAfterCalibration(
        started.sessionId,
        bank,
        {
          calibrationKey: "calibration-1:bank-1",
          diagnosticSkillResults,
          plan: { ...plan, currentScore: 21 },
        },
      );
      expect(duplicate).toEqual(rebased);
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

  it("applies a versioned answer command once and rejects stale replay", async () => {
    await withRepository(async (repo) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan,
      });
      await repo.completeLesson(started.sessionId, bank);
      const command = {
        schemaVersion: 2 as const,
        idempotencyKey: "answer-command-0001",
        learnerSessionId: started.sessionId,
        bankVersion: bank.version,
        questionVersion: 1,
        sequence: 0,
        answerRevision: 1 as const,
        issuedAt: "2026-07-14T12:00:00.000Z",
      };
      const first = await repo.answerQuestion(started.sessionId, bank, {
        questionId: "sentence-boundaries-practice-1",
        choiceId: "A",
        command,
      });
      const retry = await repo.answerQuestion(started.sessionId, bank, {
        questionId: "sentence-boundaries-practice-1",
        choiceId: "A",
        command,
      });
      expect(retry.answeredQuestionIds).toEqual(first.answeredQuestionIds);

      await expect(
        repo.answerQuestion(started.sessionId, bank, {
          questionId: "sentence-boundaries-practice-2",
          choiceId: "A",
          command: {
            ...command,
            idempotencyKey: "answer-command-stale",
            sequence: 0,
          },
        }),
      ).rejects.toThrow("out of order");
      await expect(
        repo.answerQuestion(started.sessionId, bank, {
          questionId: "sentence-boundaries-practice-2",
          choiceId: "A",
          command: {
            ...command,
            idempotencyKey: "answer-command-old-content",
            sequence: 1,
            questionVersion: 99,
          },
        }),
      ).rejects.toThrow("outdated question version");
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
      expect(answered.decisionHistory[0]).toMatchObject({
        modelVersion: "bkt-1.0",
        comparisonModelVersion: "accuracy-1.0",
      });

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
      expect(repair.questions[0].id).not.toBe(mistake.questionId);
      expect(repair.mission.steps).toEqual([
        expect.objectContaining({
          id: "repair",
          state: "current",
          progress: 0,
          total: 1,
        }),
      ]);
      const repaired = await repo.answerQuestion(started.sessionId, bank, {
        questionId: repair.questions[0].id,
        choiceId: "A",
      });
      expect(repaired.mission.unresolvedMistakes).toBe(0);
      expect(repaired.mission.mistakes[0].resolvedAt).not.toBeNull();
      expect(repaired.mission.progress.xp).toBeGreaterThan(
        payload.mission.progress.xp,
      );
    });
  });

  it("attributes a missed alternate repair back to the original mistake", async () => {
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
      const original = payload.mission.mistakes[0];
      const repair = await repo.beginRepair(
        started.sessionId,
        bank,
        original.id,
      );
      const missedAgain = await repo.answerQuestion(started.sessionId, bank, {
        questionId: repair.questions[0].id,
        choiceId: "B",
      });

      expect(missedAgain.mission.mistakes).toHaveLength(1);
      expect(missedAgain.mission.mistakes[0]).toMatchObject({
        id: original.id,
        questionId: original.questionId,
        attempts: 2,
        resolvedAt: null,
      });
      let repeated = missedAgain;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const nextRepair = await repo.beginRepair(
          started.sessionId,
          bank,
          original.id,
        );
        repeated = await repo.answerQuestion(started.sessionId, bank, {
          questionId: nextRepair.questions[0].id,
          choiceId: "B",
        });
      }
      expect(repeated.mission.mistakes[0].attempts).toBe(4);
      expect(
        repeated.trustReport.itemHealth.find(
          (item) => item.questionId === original.questionId,
        )?.status,
      ).not.toBe("watch");
    });
  });

  it("freezes lesson evidence when the lesson is created", async () => {
    await withRepository(async (repo) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan,
      });
      expect(started.payload.lessonReceipt.evidenceQuestionIds).toEqual([]);
      await repo.completeLesson(started.sessionId, bank);
      const afterAnswer = await repo.answerQuestion(started.sessionId, bank, {
        questionId: "sentence-boundaries-practice-1",
        choiceId: "A",
      });

      expect(afterAnswer.learningTwin.events).toHaveLength(1);
      expect(afterAnswer.lessonReceipt.evidenceQuestionIds).toEqual([]);
    });
  });

  it("runs exact two-question retention and three-question challenge modes", async () => {
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

      const retention = await repo.beginRetention(
        started.sessionId,
        bank,
        "sentence-boundaries",
      );
      expect(retention.mode).toBe("retention");
      expect(retention.questions).toHaveLength(2);
      expect(retention.mission.steps).toEqual([
        expect.objectContaining({
          state: "current",
          progress: 0,
          total: 2,
        }),
      ]);
      let retentionResult = retention;
      for (const question of retention.questions) {
        retentionResult = await repo.answerQuestion(started.sessionId, bank, {
          questionId: question.id,
          choiceId: "A",
        });
      }
      expect(retentionResult.mission.steps[0]).toMatchObject({
        state: "done",
        progress: 2,
        total: 2,
      });

      const challenge = await repo.beginChallenge(
        started.sessionId,
        bank,
        "sentence-boundaries",
      );
      expect(challenge.mode).toBe("challenge");
      expect(challenge.questions).toHaveLength(3);
      expect(
        challenge.questions.some((question) => question.difficulty === "hard"),
      ).toBe(true);
      expect(challenge.mission.steps).toEqual([
        expect.objectContaining({
          state: "current",
          progress: 0,
          total: 3,
        }),
      ]);
      for (const question of challenge.questions) {
        await repo.answerQuestion(started.sessionId, bank, {
          questionId: question.id,
          choiceId: "A",
        });
      }

      const micro = await repo.beginMicro(started.sessionId, bank, {
        skill: "sentence-boundaries",
        plan,
      });
      expect(micro).toMatchObject({
        mode: "micro",
        lesson: { minutes: 3 },
      });
      expect(micro.lesson.sections).toHaveLength(1);
      expect(micro.questions).toHaveLength(1);
      expect(micro.mission.steps).toEqual([
        expect.objectContaining({ id: "learn", state: "current", total: 1 }),
        expect.objectContaining({ id: "practice", state: "queued", total: 1 }),
      ]);
    });
  });

  it("routes through a weak prerequisite and then returns to the target skill", async () => {
    await withRepository(async (repo) => {
      const prerequisiteBank: LearningBankInput = {
        ...bank,
        skills: [
          ...bank.skills,
          {
            slug: "ratios-and-percent",
            label: "Ratios and percent",
            section: "math",
            category: "Algebra",
            diagnosticSkill: "ratios-and-percent",
          },
        ],
        lessons: [
          ...bank.lessons,
          {
            id: "ratios-and-percent-lesson-v1",
            skill: "ratios-and-percent",
            title: "Ratios and percent",
            minutes: 7,
            objective: "Translate ratios and percents.",
            concept: "Keep the compared quantities in the same order.",
            steps: ["Name the quantities.", "Match their order.", "Scale."],
            workedExample: {
              prompt: "2 out of 5",
              answer: "40%",
              explanation: ["Divide 2 by 5."],
            },
            trap: "Do not reverse the ratio.",
          },
        ],
        practice: [
          ...bank.practice,
          ...Array.from({ length: 5 }, (_, index) => ({
            id: `ratios-and-percent-practice-${index + 1}`,
            version: 1,
            skill: "ratios-and-percent",
            section: "math" as const,
            difficulty: "medium" as const,
            prompt: `Ratio practice ${index + 1}`,
            choices: [
              { id: "A", text: "Correct" },
              { id: "B", text: "Distractor" },
              { id: "C", text: "Distractor two" },
              { id: "D", text: "Distractor three" },
            ],
            correctChoiceId: "A",
            rationale: "Keep the ratio in order.",
          })),
        ],
      };
      const started = await repo.getOrCreate(null, prerequisiteBank, {
        skill: "linear-equations",
        diagnosticSkillResults: [
          {
            skill: "linear-equations",
            label: "Linear equations",
            section: "math",
            correct: 0,
            total: 2,
            accuracy: 0,
            signal: "focus",
          },
          {
            skill: "ratios-and-percent",
            label: "Ratios and percent",
            section: "math",
            correct: 0,
            total: 2,
            accuracy: 0,
            signal: "focus",
          },
        ],
        plan,
      });
      await repo.completeLesson(started.sessionId, prerequisiteBank);
      let target = started.payload;
      for (let index = 1; index <= 5; index += 1) {
        target = await repo.answerQuestion(
          started.sessionId,
          prerequisiteBank,
          {
            questionId: `linear-equations-practice-${index}`,
            choiceId: "B",
          },
        );
      }
      expect(target.nextSkill).toBe("ratios-and-percent");
      expect(target.futureTask.reason).toContain("weak prerequisite");

      let prerequisite = await repo.beginFocus(
        started.sessionId,
        prerequisiteBank,
        { skill: "ratios-and-percent", plan },
      );
      await repo.completeLesson(started.sessionId, prerequisiteBank);
      for (let index = 1; index <= 5; index += 1) {
        prerequisite = await repo.answerQuestion(
          started.sessionId,
          prerequisiteBank,
          {
            questionId: `ratios-and-percent-practice-${index}`,
            choiceId: "A",
          },
        );
      }
      expect(prerequisite.nextSkill).toBe("linear-equations");
      expect(prerequisite.futureTask.reason).toContain(
        "Return to Linear equations",
      );
    });
  });

  it("scores teach-back and caps learner correction by model version", async () => {
    await withRepository(async (repo) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan,
      });
      const teachBack = await repo.recordTeachBack(
        started.sessionId,
        bank,
        "A complete sentence needs a subject and verb because it must finish the thought. For example, I can test whether it stands alone.",
      );
      expect(teachBack.teachBack?.score).toBeGreaterThanOrEqual(2);

      const before = teachBack.learningTwin.skills.find(
        (state) => state.skill === "sentence-boundaries",
      );
      const corrected = await repo.correctLearnerModel(
        started.sessionId,
        bank,
        {
          skill: "sentence-boundaries",
          kind: "too-high",
          note: "I recognized the wording from class rather than using the rule.",
        },
      );
      const after = corrected.learningTwin.skills.find(
        (state) => state.skill === "sentence-boundaries",
      );
      expect(after?.learnedProbability).toBeLessThan(
        before?.learnedProbability ?? 0,
      );
      expect(corrected.learnerModel.corrections).toHaveLength(1);
      expect(corrected.learnerModel.corrections[0].modelVersion).toBe(
        "bkt-1.0",
      );
      await expect(
        repo.correctLearnerModel(started.sessionId, bank, {
          skill: "sentence-boundaries",
          kind: "too-low",
          note: "Trying to move the same estimate again.",
        }),
      ).rejects.toThrow("already recorded a correction");
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
      expect(checkpoint.mission.steps).toEqual([
        expect.objectContaining({
          id: "checkpoint",
          state: "current",
          progress: 0,
          total: 3,
        }),
      ]);
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

  it("routes trusted IRT calibration evidence into BKT without awarding practice XP", async () => {
    await withRepository(async (repo) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan,
      });
      const before = started.payload.learningTwin.skills.find(
        (skill) => skill.skill === "linear-equations",
      );
      const evidence = {
        questionId: "adaptive-math-probe-1",
        skill: "linear-equations",
        correct: false,
        difficulty: "hard" as const,
        observedAt: "2026-07-13T18:00:00.000Z",
        confidence: "guessing" as const,
      };
      const updated = await repo.recordCalibrationEvidence(
        started.sessionId,
        bank,
        evidence,
      );
      const after = updated.learningTwin.skills.find(
        (skill) => skill.skill === "linear-equations",
      );

      expect(after?.learnedProbability).toBeLessThan(
        before?.learnedProbability ?? 0,
      );
      expect(updated.learningTwin.events[0]).toMatchObject({
        questionId: evidence.questionId,
        source: "calibration",
        correct: false,
      });
      expect(updated.learningTwin.evidence.calibration).toBe(1);
      expect(updated.learningTwin.evidence.practice).toBe(0);
      expect(updated.mission.progress.xp).toBe(0);
      expect(updated.decisionHistory[0].informationWeight).toBe(0.48);
      expect(updated.decisionHistory[0].informationLabel).toBe("low");

      const retried = await repo.recordCalibrationEvidence(
        started.sessionId,
        bank,
        evidence,
      );
      expect(retried.learningTwin.evidence.calibration).toBe(1);
    });
  });
});
