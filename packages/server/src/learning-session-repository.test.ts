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

function buildExpandedBank(): LearningBankInput {
  const extras = [
    {
      slug: "english-secondary",
      label: "English secondary",
      section: "english" as const,
      category: "Conventions",
    },
    {
      slug: "math-secondary",
      label: "Math secondary",
      section: "math" as const,
      category: "Algebra",
    },
    {
      slug: "reading-secondary",
      label: "Reading secondary",
      section: "reading" as const,
      category: "Key Ideas",
    },
    {
      slug: "math-tertiary",
      label: "Math tertiary",
      section: "math" as const,
      category: "Algebra",
    },
  ];
  const lessons = extras.map((extra) => {
    const template = bank.lessons.find((lesson) => {
      const skill = bank.skills.find((item) => item.slug === lesson.skill);
      return skill?.section === extra.section;
    });
    if (!template) throw new Error(`Missing ${extra.section} lesson template.`);
    return {
      ...structuredClone(template),
      id: `${extra.slug}-lesson-v1`,
      skill: extra.slug,
      title: extra.label,
    };
  });
  const practice = extras.flatMap((extra) => {
    const templateSkill = bank.skills.find(
      (skill) => skill.section === extra.section,
    );
    if (!templateSkill)
      throw new Error(`Missing ${extra.section} practice template.`);
    return bank.practice
      .filter((question) => question.skill === templateSkill.slug)
      .map((question, index) => ({
        ...structuredClone(question),
        id: `${extra.slug}-practice-${index + 1}`,
        skill: extra.slug,
        section: extra.section,
      }));
  });
  return {
    version: "test-bank-expanded-v1",
    skills: [
      ...bank.skills,
      ...extras.map((extra) => ({
        ...extra,
        diagnosticSkill: extra.slug,
      })),
    ],
    lessons: [...bank.lessons, ...lessons],
    practice: [...bank.practice, ...practice],
  };
}

const expandedAssessmentResults = [
  {
    skill: "sentence-boundaries",
    label: "Sentence boundaries",
    section: "english",
    correct: 3,
    total: 4,
    accuracy: 0.75,
    signal: "developing",
  },
  {
    skill: "linear-equations",
    label: "Linear equations",
    section: "math",
    correct: 3,
    total: 4,
    accuracy: 0.75,
    signal: "developing",
  },
  {
    skill: "supported-inference",
    label: "Supported inference",
    section: "reading",
    correct: 3,
    total: 4,
    accuracy: 0.75,
    signal: "developing",
  },
  {
    skill: "english-secondary",
    label: "English secondary",
    section: "english",
    correct: 0,
    total: 4,
    accuracy: 0,
    signal: "focus",
  },
  {
    skill: "math-secondary",
    label: "Math secondary",
    section: "math",
    correct: 1,
    total: 4,
    accuracy: 0.25,
    signal: "focus",
  },
  {
    skill: "reading-secondary",
    label: "Reading secondary",
    section: "reading",
    correct: 1,
    total: 4,
    accuracy: 0.25,
    signal: "focus",
  },
  {
    skill: "math-tertiary",
    label: "Math tertiary",
    section: "math",
    correct: 2,
    total: 4,
    accuracy: 0.5,
    signal: "developing",
  },
] as const;

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
        skill: "supported-inference",
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
      expect(payload.todaySkill).toBe("sentence-boundaries");
      expect(payload.mode).toBe("foundation");
      expect(payload.lesson.depth).toBe("foundation");
      expect(payload.cycle).toEqual({
        roundNumber: 1,
        kind: "foundation",
        status: "lessons",
        requiredSkills: [
          "sentence-boundaries",
          "linear-equations",
          "supported-inference",
        ],
        completedSkills: [],
        nextSkill: "sentence-boundaries",
      });
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

  it("keeps learning history when an official score updates the plan context", async () => {
    await withRepository(async (repo, filePath) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan,
      });
      await repo.completeLesson(started.sessionId, bank);
      const practiced = await repo.answerQuestion(started.sessionId, bank, {
        questionId: "sentence-boundaries-practice-1",
        choiceId: "A",
      });

      const refreshed = await repo.getOrCreate(started.sessionId, bank, {
        skill: "sentence-boundaries",
        plan: {
          ...plan,
          currentScore: 27,
          sectionScores: { english: 28, math: 25, reading: 27 },
        },
      });

      expect(refreshed.sessionId).toBe(started.sessionId);
      expect(refreshed.payload.mission.progress).toEqual(
        practiced.mission.progress,
      );
      expect(refreshed.payload.cycle).toEqual(practiced.cycle);
      expect(refreshed.payload.learningTwin.evidence).toEqual(
        practiced.learningTwin.evidence,
      );
      const stored = JSON.parse(await readFile(filePath, "utf8")) as {
        sessions: Record<
          string,
          {
            planContext: {
              currentScore: number;
              sectionScores?: {
                english: number;
                math: number;
                reading: number;
              };
            };
          }
        >;
      };
      expect(stored.sessions[started.sessionId]?.planContext).toMatchObject({
        currentScore: 27,
        sectionScores: { english: 28, math: 25, reading: 27 },
      });
    });
  });

  it("rebases a temporary no-score session without changing canonical Learning Twin evidence", async () => {
    await withRepository(async (repo) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan: { ...plan, currentScore: 18 },
      });
      const calibrationEvidence = [
        {
          questionId: "calibration-english-1",
          skill: "sentence-boundaries",
          correct: true,
          difficulty: "easy" as const,
          observedAt: "2026-07-25T15:00:00.000Z",
          confidence: "sure" as const,
        },
        {
          questionId: "calibration-math-1",
          skill: "linear-equations",
          correct: false,
          difficulty: "hard" as const,
          observedAt: "2026-07-25T15:01:00.000Z",
          confidence: "guessing" as const,
        },
        {
          questionId: "calibration-reading-1",
          skill: "supported-inference",
          correct: true,
          difficulty: "medium" as const,
          observedAt: "2026-07-25T15:02:00.000Z",
          confidence: "sure" as const,
        },
        {
          questionId: "calibration-math-2",
          skill: "linear-equations",
          correct: false,
          difficulty: "medium" as const,
          observedAt: "2026-07-25T15:03:00.000Z",
          confidence: "unsure" as const,
        },
      ];
      for (const evidence of calibrationEvidence) {
        await repo.recordCalibrationEvidence(started.sessionId, bank, evidence);
      }
      const beforeRebase = await repo.get(started.sessionId, bank);
      expect(beforeRebase.learningTwin.evidence.calibration).toBe(4);
      expect(beforeRebase.learningTwin.recommendation.skill).toBe(
        "linear-equations",
      );
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

      expect(rebased.todaySkill).toBe("sentence-boundaries");
      expect(rebased.nextSkill).toBe("sentence-boundaries");
      expect(rebased.lesson.skill).toBe("sentence-boundaries");
      expect(rebased.mode).toBe("foundation");
      expect(rebased.cycle.nextSkill).toBe("sentence-boundaries");
      expect(rebased.learningTwin).toEqual(beforeRebase.learningTwin);
      expect(rebased.decisionHistory).toEqual(beforeRebase.decisionHistory);
      expect(
        rebased.questions.every(
          (question) => question.skill === "sentence-boundaries",
        ),
      ).toBe(true);
      expect(rebased.status).toBe("lesson");
      expect(rebased.mission.progress.totalAnswered).toBe(0);
      expect(
        rebased.learningTwin.skills.find(
          (skill) => skill.skill === "linear-equations",
        )?.priorSource,
      ).toBe(
        beforeRebase.learningTwin.skills.find(
          (skill) => skill.skill === "linear-equations",
        )?.priorSource,
      );
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
      expect(answered.futureTask.reason).toContain("foundation lesson");
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
      delete legacy.sessions[started.sessionId].cycle;
      legacy.sessions[started.sessionId].mode = "focus";
      await writeFile(filePath, `${JSON.stringify(legacy, null, 2)}\n`);

      const restarted = new FileLearningSessionRepository(filePath);
      const migrated = await restarted.get(started.sessionId, bank);
      expect(migrated.sessionId).toBe(started.sessionId);
      expect(migrated.learningTwin.skills).toHaveLength(3);
      expect(
        migrated.learningTwin.skills.every(
          (skill) => skill.priorSource === "score-estimate",
        ),
      ).toBe(true);
      expect(migrated.mode).toBe("foundation");
      expect(migrated.cycle).toMatchObject({
        roundNumber: 1,
        kind: "foundation",
        status: "lessons",
        completedSkills: [],
        nextSkill: "sentence-boundaries",
      });

      const persisted = await readFile(filePath, "utf8");
      expect(persisted).toContain('"learningTwinBySkill"');
      expect(persisted).toContain('"planContext"');
      expect(persisted).toContain('"cycle"');
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

  it("does not let prerequisite routing skip or repeat the foundation curriculum", async () => {
    await withRepository(async (repo) => {
      const prerequisiteBank: LearningBankInput = {
        ...bank,
        skills: [
          bank.skills[1],
          {
            slug: "ratios-and-percent",
            label: "Ratios and percent",
            section: "math",
            category: "Algebra",
            diagnosticSkill: "ratios-and-percent",
          },
          bank.skills[0],
          bank.skills[2],
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
      expect(target.cycle.completedSkills).toEqual(["linear-equations"]);
      expect(target.futureTask.reason).toContain("Round 1 continues");

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
      expect(prerequisite.nextSkill).toBe("sentence-boundaries");
      expect(prerequisite.cycle.completedSkills).toEqual([
        "linear-equations",
        "ratios-and-percent",
      ]);
      expect(prerequisite.futureTask.reason).toContain(
        "Round 1 continues with Sentence boundaries",
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
      expect(completed.cycle).toMatchObject({
        status: "lessons",
        completedSkills: ["sentence-boundaries"],
        nextSkill: "linear-equations",
      });

      await expect(
        repo.beginFocus(started.sessionId, bank, {
          skill: "sentence-boundaries",
          plan,
        }),
      ).rejects.toThrow("cannot be skipped or repeated");
      await expect(
        repo.beginFocus(started.sessionId, bank, {
          skill: "supported-inference",
          plan,
        }),
      ).rejects.toThrow("cannot be skipped or repeated");

      const next = await repo.beginFocus(started.sessionId, bank, {
        skill: "linear-equations",
        plan,
      });
      expect(next.todaySkill).toBe("linear-equations");
      expect(next.nextSkill).toBe("linear-equations");
      expect(next.mode).toBe("foundation");
      expect(next.cycle.nextSkill).toBe("linear-equations");
      expect(next.status).toBe("lesson");
      expect(next.mission.progress.xp).toBe(completed.mission.progress.xp);
      expect(
        next.mission.skillMap.find(
          (skill) => skill.skill === "sentence-boundaries",
        )?.evidence,
      ).toBe(5);
    });
  });

  it("enters assessment choice only after every full foundation practice set", async () => {
    await withRepository(async (repo, filePath) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "supported-inference",
        diagnosticSkillResults: [
          {
            skill: "supported-inference",
            label: "Supported inference",
            section: "reading",
            correct: 2,
            total: 2,
            accuracy: 1,
            signal: "strength",
          },
        ],
        plan,
      });
      const orderedSkills = [
        "sentence-boundaries",
        "linear-equations",
        "supported-inference",
      ] as const;
      let payload = started.payload;
      let priorXp = payload.mission.progress.xp;

      for (const [skillIndex, skill] of orderedSkills.entries()) {
        if (skillIndex > 0) {
          payload = await repo.beginFocus(started.sessionId, bank, {
            plan,
          });
        }
        expect(payload.todaySkill).toBe(skill);
        expect(payload.cycle.nextSkill).toBe(skill);
        payload = await repo.completeLesson(started.sessionId, bank);
        expect(payload.cycle.completedSkills).toEqual(
          orderedSkills.slice(0, skillIndex),
        );

        for (let questionIndex = 0; questionIndex < 4; questionIndex += 1) {
          const question = payload.questions[questionIndex];
          payload = await repo.answerQuestion(started.sessionId, bank, {
            questionId: question.id,
            choiceId: "A",
          });
          expect(payload.cycle.completedSkills).toEqual(
            orderedSkills.slice(0, skillIndex),
          );
          expect(payload.cycle.status).toBe("lessons");
          expect(payload.cycle.nextSkill).toBe(skill);
        }

        const exitQuestion = payload.questions[4];
        payload = await repo.answerQuestion(started.sessionId, bank, {
          questionId: exitQuestion.id,
          choiceId: "A",
        });
        expect(payload.cycle.completedSkills).toEqual(
          orderedSkills.slice(0, skillIndex + 1),
        );
        expect(payload.mission.progress.xp).toBeGreaterThan(priorXp);
        priorXp = payload.mission.progress.xp;
      }

      expect(payload.cycle).toEqual({
        roundNumber: 1,
        kind: "foundation",
        status: "assessment-choice",
        requiredSkills: [...orderedSkills],
        completedSkills: [...orderedSkills],
        nextSkill: null,
      });
      expect(payload.mission.progress.completedSets).toBe(3);
      await expect(
        repo.beginFocus(started.sessionId, bank, { plan }),
      ).rejects.toThrow("Choose the next assessment");

      const resumed = await new FileLearningSessionRepository(filePath).get(
        started.sessionId,
        bank,
      );
      expect(resumed.cycle).toEqual(payload.cycle);
      expect(resumed.mission.progress).toEqual(payload.mission.progress);
    });
  });

  it("requires the current lesson round to reach assessment choice", async () => {
    await withRepository(async (repo) => {
      const learningBank = buildExpandedBank();
      const started = await repo.getOrCreate(null, learningBank, {
        skill: "math-tertiary",
        plan,
      });

      await expect(
        repo.applyRoundAssessment(started.sessionId, learningBank, {
          assessmentKey: "assessment-before-round-complete",
          diagnosticSkillResults: expandedAssessmentResults,
          plan,
        }),
      ).rejects.toThrow(
        "Finish the current lesson round before applying an assessment",
      );

      const unchanged = await repo.get(started.sessionId, learningBank);
      expect(unchanged.cycle).toEqual(started.payload.cycle);
      expect(unchanged.mission.progress).toEqual(
        started.payload.mission.progress,
      );
    });
  });

  it("uses a new official-score key to advance a completed round even when the score is unchanged", async () => {
    await withRepository(async (repo, filePath) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan,
      });
      const beforeStore = JSON.parse(await readFile(filePath, "utf8")) as {
        sessions: Record<
          string,
          {
            cycle: Record<string, unknown>;
            profile: { xp: number };
          }
        >;
      };
      beforeStore.sessions[started.sessionId].cycle = {
        roundNumber: 1,
        kind: "foundation",
        status: "assessment-choice",
        requiredSkills: bank.skills.map((skill) => skill.slug),
        completedSkills: bank.skills.map((skill) => skill.slug),
        nextSkill: null,
      };
      beforeStore.sessions[started.sessionId].profile.xp = 140;
      await writeFile(filePath, `${JSON.stringify(beforeStore, null, 2)}\n`);

      const advanced = await repo.getOrCreate(started.sessionId, bank, {
        skill: "sentence-boundaries",
        plan: {
          ...plan,
          scoreEvidenceKey: "official-score-same-0001",
          sectionScores: { english: 24, math: 21, reading: 27 },
        },
      });

      expect(advanced.sessionId).toBe(started.sessionId);
      expect(advanced.payload.cycle).toMatchObject({
        roundNumber: 2,
        kind: "adaptive",
        status: "lessons",
        completedSkills: [],
      });
      expect(advanced.payload.cycle.requiredSkills[0]).toBe("linear-equations");
      expect(advanced.payload.mission.progress.xp).toBe(140);
      expect(advanced.payload.learningTwin.evidence).toEqual(
        started.payload.learningTwin.evidence,
      );
      expect(advanced.payload.futureTask.reason).toContain(
        "new official score",
      );
    });
  });

  it("keeps the next unfinished adaptive skill after an official score arrives between lessons", async () => {
    await withRepository(async (repo, filePath) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan,
      });
      const stored = JSON.parse(await readFile(filePath, "utf8")) as {
        sessions: Record<string, { cycle: Record<string, unknown> }>;
      };
      stored.sessions[started.sessionId].cycle = {
        roundNumber: 2,
        kind: "adaptive",
        status: "lessons",
        requiredSkills: [
          "sentence-boundaries",
          "linear-equations",
          "supported-inference",
        ],
        completedSkills: ["sentence-boundaries"],
        nextSkill: "linear-equations",
      };
      await writeFile(filePath, `${JSON.stringify(stored, null, 2)}\n`);

      const adjusted = await repo.getOrCreate(started.sessionId, bank, {
        skill: "sentence-boundaries",
        plan: {
          ...plan,
          scoreEvidenceKey: "official-score-between-lessons-0001",
          sectionScores: { english: 24, math: 21, reading: 27 },
        },
      });

      expect(adjusted.payload.cycle).toMatchObject({
        roundNumber: 2,
        kind: "adaptive",
        status: "lessons",
        completedSkills: ["sentence-boundaries"],
        nextSkill: "linear-equations",
      });
      expect(adjusted.payload.cycle.requiredSkills).toEqual([
        "sentence-boundaries",
        "linear-equations",
        "supported-inference",
      ]);
      expect(adjusted.payload.futureTask).toMatchObject({
        todaySkill: "sentence-boundaries",
        nextSkill: "linear-equations",
        changed: true,
      });
    });
  });

  it("starts an assessment-driven round with the weakest measured section instead of a fixed English seed", async () => {
    await withRepository(async (repo, filePath) => {
      const started = await repo.getOrCreate(null, bank, {
        skill: "sentence-boundaries",
        plan,
      });
      const stored = JSON.parse(await readFile(filePath, "utf8")) as {
        sessions: Record<string, { cycle: Record<string, unknown> }>;
      };
      stored.sessions[started.sessionId].cycle = {
        roundNumber: 1,
        kind: "foundation",
        status: "assessment-choice",
        requiredSkills: bank.skills.map((skill) => skill.slug),
        completedSkills: bank.skills.map((skill) => skill.slug),
        nextSkill: null,
      };
      await writeFile(filePath, `${JSON.stringify(stored, null, 2)}\n`);

      const adaptive = await repo.applyRoundAssessment(
        started.sessionId,
        bank,
        {
          assessmentKey: "math-first-assessment-0001",
          diagnosticSkillResults: [
            {
              skill: "sentence-boundaries",
              label: "Sentence boundaries",
              section: "english",
              correct: 4,
              total: 4,
              accuracy: 1,
              signal: "strength",
            },
            {
              skill: "linear-equations",
              label: "Linear equations",
              section: "math",
              correct: 0,
              total: 4,
              accuracy: 0,
              signal: "focus",
            },
            {
              skill: "supported-inference",
              label: "Supported inference",
              section: "reading",
              correct: 3,
              total: 4,
              accuracy: 0.75,
              signal: "developing",
            },
          ],
          plan,
        },
      );

      expect(adaptive.cycle.requiredSkills).toEqual([
        "linear-equations",
        "supported-inference",
        "sentence-boundaries",
      ]);
      expect(adaptive.todaySkill).toBe("linear-equations");
    });
  });

  it("applies one trusted assessment into a finite adaptive round and completes that round once", async () => {
    await withRepository(async (repo, filePath) => {
      const learningBank = buildExpandedBank();
      const started = await repo.getOrCreate(null, learningBank, {
        skill: "math-tertiary",
        plan,
      });
      let foundationComplete = await repo.completeLesson(
        started.sessionId,
        learningBank,
      );
      for (const [index, question] of foundationComplete.questions.entries()) {
        foundationComplete = await repo.answerQuestion(
          started.sessionId,
          learningBank,
          {
            questionId: question.id,
            choiceId: index === 0 ? "B" : "A",
          },
        );
      }
      const foundationStore = JSON.parse(await readFile(filePath, "utf8")) as {
        sessions: Record<string, { cycle: Record<string, unknown> }>;
      };
      foundationStore.sessions[started.sessionId].cycle = {
        roundNumber: 1,
        kind: "foundation",
        status: "assessment-choice",
        requiredSkills: learningBank.skills.map((skill) => skill.slug),
        completedSkills: learningBank.skills.map((skill) => skill.slug),
        nextSkill: null,
      };
      await writeFile(
        filePath,
        `${JSON.stringify(foundationStore, null, 2)}\n`,
      );
      foundationComplete = await repo.get(started.sessionId, learningBank);
      expect(foundationComplete.cycle).toMatchObject({
        roundNumber: 1,
        kind: "foundation",
        status: "assessment-choice",
        nextSkill: null,
      });
      expect(foundationComplete.cycle.completedSkills).toEqual(
        learningBank.skills.map((skill) => skill.slug),
      );
      expect(foundationComplete.mission.unresolvedMistakes).toBe(1);

      const progressBeforeAssessment = foundationComplete.mission.progress;
      const decisionHistoryBeforeAssessment =
        foundationComplete.decisionHistory;
      const practiceEvidenceBeforeAssessment =
        foundationComplete.learningTwin.evidence.practice;
      const calibrationEvidenceBeforeAssessment =
        foundationComplete.learningTwin.evidence.calibration;
      const masteryEvidenceBeforeAssessment = Object.fromEntries(
        foundationComplete.mission.skillMap.map((skill) => [
          skill.skill,
          skill.evidence,
        ]),
      );
      const assessmentKey = "round-assessment-expanded-0001";
      const adaptive = await repo.applyRoundAssessment(
        started.sessionId,
        learningBank,
        {
          assessmentKey,
          diagnosticSkillResults: expandedAssessmentResults,
          plan: { ...plan, currentScore: 26 },
        },
      );

      expect(adaptive.cycle).toEqual({
        roundNumber: 2,
        kind: "adaptive",
        status: "lessons",
        requiredSkills: [
          "english-secondary",
          "math-secondary",
          "reading-secondary",
          "math-tertiary",
          "linear-equations",
          "sentence-boundaries",
        ],
        completedSkills: [],
        nextSkill: "english-secondary",
      });
      expect(adaptive.cycle.requiredSkills).toHaveLength(6);
      expect(new Set(adaptive.cycle.requiredSkills).size).toBe(6);
      expect(adaptive.cycle.requiredSkills).not.toContain(
        "supported-inference",
      );
      expect(adaptive.todaySkill).toBe(adaptive.cycle.nextSkill);
      expect(adaptive.mode).toBe("focus");
      expect(adaptive.mission.progress).toEqual(progressBeforeAssessment);
      expect(adaptive.mission.unresolvedMistakes).toBe(1);
      expect(adaptive.decisionHistory).toEqual(decisionHistoryBeforeAssessment);
      expect(adaptive.learningTwin.evidence.practice).toBe(
        practiceEvidenceBeforeAssessment,
      );
      expect(adaptive.learningTwin.evidence.calibration).toBe(
        calibrationEvidenceBeforeAssessment +
          expandedAssessmentResults.reduce(
            (total, result) => total + result.total,
            0,
          ),
      );
      for (const result of expandedAssessmentResults) {
        const skill = adaptive.mission.skillMap.find(
          (item) => item.skill === result.skill,
        );
        expect(skill?.evidence).toBe(
          masteryEvidenceBeforeAssessment[result.skill] + result.total,
        );
      }

      const duplicate = await repo.applyRoundAssessment(
        started.sessionId,
        learningBank,
        {
          assessmentKey,
          diagnosticSkillResults: expandedAssessmentResults.map((result) => ({
            ...result,
            correct: result.total,
            accuracy: 1,
            signal: "strength" as const,
          })),
          plan: { ...plan, currentScore: 30 },
        },
      );
      expect(duplicate.cycle).toEqual(adaptive.cycle);
      expect(duplicate.mission.progress).toEqual(adaptive.mission.progress);
      expect(duplicate.learningTwin).toEqual(adaptive.learningTwin);
      expect(duplicate.mission.skillMap).toEqual(adaptive.mission.skillMap);

      let firstMissionComplete = await repo.completeLesson(
        started.sessionId,
        learningBank,
      );
      for (const question of firstMissionComplete.questions) {
        firstMissionComplete = await repo.answerQuestion(
          started.sessionId,
          learningBank,
          {
            questionId: question.id,
            choiceId: "A",
          },
        );
      }
      const firstAdaptiveSkill = adaptive.cycle.requiredSkills[0];
      const secondAdaptiveSkill = adaptive.cycle.requiredSkills[1];
      const skippedAdaptiveSkill = adaptive.cycle.requiredSkills[2];
      expect(firstMissionComplete.cycle).toMatchObject({
        roundNumber: 2,
        kind: "adaptive",
        status: "lessons",
        completedSkills: [firstAdaptiveSkill],
        nextSkill: secondAdaptiveSkill,
      });
      await expect(
        repo.beginFocus(started.sessionId, learningBank, {
          skill: firstAdaptiveSkill,
          plan,
        }),
      ).rejects.toThrow("cannot be skipped or repeated");
      await expect(
        repo.beginFocus(started.sessionId, learningBank, {
          skill: skippedAdaptiveSkill,
          plan,
        }),
      ).rejects.toThrow("cannot be skipped or repeated");

      const lastAdaptiveSkill = adaptive.cycle.requiredSkills.at(-1);
      expect(lastAdaptiveSkill).toBeDefined();
      const adaptiveStore = JSON.parse(await readFile(filePath, "utf8")) as {
        sessions: Record<
          string,
          {
            cycle: {
              completedSkills: string[];
              nextSkill: string | null;
              status: string;
            };
          }
        >;
      };
      adaptiveStore.sessions[started.sessionId].cycle.completedSkills =
        adaptive.cycle.requiredSkills.slice(0, -1);
      adaptiveStore.sessions[started.sessionId].cycle.nextSkill =
        lastAdaptiveSkill ?? null;
      adaptiveStore.sessions[started.sessionId].cycle.status = "lessons";
      await writeFile(filePath, `${JSON.stringify(adaptiveStore, null, 2)}\n`);
      let adaptiveComplete = await repo.beginFocus(
        started.sessionId,
        learningBank,
        { skill: lastAdaptiveSkill, plan },
      );
      expect(adaptiveComplete.todaySkill).toBe(lastAdaptiveSkill);
      adaptiveComplete = await repo.completeLesson(
        started.sessionId,
        learningBank,
      );
      for (const question of adaptiveComplete.questions) {
        adaptiveComplete = await repo.answerQuestion(
          started.sessionId,
          learningBank,
          {
            questionId: question.id,
            choiceId: "A",
          },
        );
      }
      expect(adaptiveComplete.cycle).toEqual({
        roundNumber: 2,
        kind: "adaptive",
        status: "assessment-choice",
        requiredSkills: adaptive.cycle.requiredSkills,
        completedSkills: adaptive.cycle.requiredSkills,
        nextSkill: null,
      });
      expect(adaptiveComplete.mission.progress.xp).toBeGreaterThan(
        progressBeforeAssessment.xp,
      );
      expect(adaptiveComplete.mission.mistakes).toHaveLength(1);
      expect(adaptiveComplete.mission.unresolvedMistakes).toBe(0);
      expect(adaptiveComplete.mission.mistakes[0].resolvedAt).not.toBeNull();
      await expect(
        repo.beginFocus(started.sessionId, learningBank, { plan }),
      ).rejects.toThrow("Choose the next assessment");

      const resumed = await new FileLearningSessionRepository(filePath).get(
        started.sessionId,
        learningBank,
      );
      expect(resumed.cycle).toEqual(adaptiveComplete.cycle);
      expect(resumed.mission.progress).toEqual(
        adaptiveComplete.mission.progress,
      );
      expect(resumed.mission.mistakes).toEqual(
        adaptiveComplete.mission.mistakes,
      );
    });
  }, 20_000);

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
