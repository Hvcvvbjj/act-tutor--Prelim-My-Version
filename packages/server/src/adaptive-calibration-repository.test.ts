import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { DiagnosticQuestionSecure } from "@act-tutor/core";
import { describe, expect, it } from "vitest";

import {
  FileAdaptiveCalibrationRepository,
  type CalibrationBankInput,
} from "./adaptive-calibration-repository";

const sectionSkills = {
  english: ["sentence-boundaries", "Sentence boundaries"],
  math: ["linear-equations", "Linear equations"],
  reading: ["supported-inference", "Supported inference"],
} as const;

const questions = (
  Object.entries(sectionSkills) as Array<
    [
      keyof typeof sectionSkills,
      (typeof sectionSkills)[keyof typeof sectionSkills],
    ]
  >
).flatMap(([section, [skill, skillLabel]]) =>
  Array.from({ length: 5 }, (_, index) => {
    const difficulty = index < 1 ? "easy" : index < 4 ? "medium" : "hard";
    return {
      id: `${section}-${index + 1}`,
      version: 1,
      section,
      category: `${section} category`,
      primarySkill: skill,
      skillLabel,
      difficulty,
      prompt: `${section} prompt ${index + 1}`,
      choices: ["A", "B", "C", "D"].map((id) => ({ id, text: `Choice ${id}` })),
      expectedSeconds: 45,
      format: "standalone",
      correctChoiceId: index % 2 === 0 ? "B" : "C",
      rationale: `Reviewed rationale for ${section} ${index + 1}.`,
      content: {
        status: "published",
        license: "original",
        reviewer: "test",
        reviewedAt: "2026-07-13",
      },
    } satisfies DiagnosticQuestionSecure;
  }),
);

const bank: CalibrationBankInput = {
  id: "calibration-test-bank",
  version: "v1",
  questions,
};

async function withRepo<T>(
  run: (repo: FileAdaptiveCalibrationRepository) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "adaptive-calibration-"));
  try {
    return await run(
      new FileAdaptiveCalibrationRepository(join(directory, "sessions.json")),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("FileAdaptiveCalibrationRepository", () => {
  it("starts with one public ACT-aligned probe and no answer key", async () => {
    await withRepo(async (repo) => {
      const started = await repo.getOrCreate(null, bank);
      expect(started.payload.currentQuestion).not.toBeNull();
      expect(started.payload.selection?.candidates).toHaveLength(5);
      expect(started.payload.model.shortName).toBe("2PL IRT");
      expect(JSON.stringify(started.payload)).not.toContain("correctChoiceId");
      expect(JSON.stringify(started.payload)).not.toContain(
        "Reviewed rationale",
      );
    });
  });

  it("records a trusted outcome, changes ability, and reveals only submitted feedback", async () => {
    await withRepo(async (repo) => {
      const started = await repo.getOrCreate(null, bank);
      const question = started.payload.currentQuestion;
      expect(question).not.toBeNull();
      const secure = questions.find((item) => item.id === question?.id);
      expect(secure).toBeDefined();
      const answered = await repo.answer(started.sessionId, bank, {
        questionId: question!.id,
        choiceId: secure!.correctChoiceId,
      });
      expect(answered.evidence).toMatchObject({ correct: true });
      expect(answered.payload.responseCount).toBe(1);
      expect(answered.payload.estimate.theta).toBeGreaterThan(0);
      expect(answered.payload.lastFeedback).toMatchObject({
        correct: true,
        correctChoiceId: secure!.correctChoiceId,
      });
      expect(answered.payload.history[0].standardErrorAfter).toBeLessThan(
        answered.payload.history[0].standardErrorBefore,
      );
    });
  });

  it("is idempotent for a retried identical answer", async () => {
    await withRepo(async (repo) => {
      const started = await repo.getOrCreate(null, bank);
      const question = started.payload.currentQuestion!;
      const first = await repo.answer(started.sessionId, bank, {
        questionId: question.id,
        choiceId: question.choices[0].id,
      });
      const retried = await repo.answer(started.sessionId, bank, {
        questionId: question.id,
        choiceId: question.choices[0].id,
      });
      expect(first.evidence).not.toBeNull();
      expect(retried.evidence).toEqual(first.evidence);
      expect(retried.payload.responseCount).toBe(1);

      const conflictingChoice = question.choices.find(
        (choice) => choice.id !== question.choices[0].id,
      )!;
      await expect(
        repo.answer(started.sessionId, bank, {
          questionId: question.id,
          choiceId: conflictingChoice.id,
        }),
      ).rejects.toThrow("already answered");
    });
  });

  it("samples all three core sections in the first three probes", async () => {
    await withRepo(async (repo) => {
      const started = await repo.getOrCreate(null, bank);
      const visited: string[] = [];
      let payload = started.payload;
      for (let index = 0; index < 3; index += 1) {
        const question = payload.currentQuestion!;
        visited.push(question.section);
        const answered = await repo.answer(started.sessionId, bank, {
          questionId: question.id,
          choiceId: question.choices[index % question.choices.length].id,
        });
        payload = answered.payload;
      }
      expect(new Set(visited)).toEqual(new Set(["english", "math", "reading"]));
    });
  });

  it("loads an honestly labeled seven-response representative demo", async () => {
    await withRepo(async (repo) => {
      const seeded = await repo.seedRepresentative(bank);
      expect(seeded.payload.representativeDemo).toBe(true);
      expect(seeded.payload.responseCount).toBe(7);
      expect(seeded.evidence).toHaveLength(7);
      expect(seeded.payload.currentQuestion).not.toBeNull();
      expect(seeded.payload.status).toBe("in_progress");
    });
  });

  it("persists and resumes the exact adaptive state", async () => {
    await withRepo(async (repo) => {
      const started = await repo.getOrCreate(null, bank);
      const question = started.payload.currentQuestion!;
      const answered = await repo.answer(started.sessionId, bank, {
        questionId: question.id,
        choiceId: question.choices[0].id,
      });
      const resumed = await repo.getOrCreate(started.sessionId, bank);
      expect(resumed.payload.estimate).toEqual(answered.payload.estimate);
      expect(resumed.payload.currentQuestion?.id).toBe(
        answered.payload.currentQuestion?.id,
      );
      expect(resumed.payload.history).toEqual(answered.payload.history);
    });
  });
});
