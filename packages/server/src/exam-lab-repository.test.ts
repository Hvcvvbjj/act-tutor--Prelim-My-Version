import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { DiagnosticFormSecure } from "@act-tutor/core";
import { describe, expect, it } from "vitest";

import { FileExamLabRepository } from "./exam-lab-repository";

const questions = [
  ["e1", "english", "boundaries", "a"],
  ["e2", "english", "concision", "b"],
  ["m1", "math", "linear", "a"],
  ["m2", "math", "geometry", "b"],
  ["r1", "reading", "inference", "a"],
  ["r2", "reading", "purpose", "b"],
].map(([id, section, skill, correct]) => ({
  id,
  version: 1,
  section,
  category: "C",
  primarySkill: skill,
  skillLabel: skill,
  difficulty: "medium",
  prompt: `Prompt ${id}`,
  choices: ["a", "b", "c", "d"].map((choice) => ({ id: choice, text: choice })),
  expectedSeconds: 45,
  format: "standalone",
  correctChoiceId: correct,
  rationale: `Reason ${id}`,
  content: {
    status: "published",
    license: "original",
    reviewer: "test",
    reviewedAt: "2026-07-12",
  },
}));
const form = {
  id: "lab",
  version: "1",
  mode: "rapid",
  title: "Lab",
  estimatedMinutes: 10,
  blueprint: [],
  questions,
} as DiagnosticFormSecure;

async function withRepo<T>(run: (repo: FileExamLabRepository) => Promise<T>) {
  const dir = await mkdtemp(join(tmpdir(), "exam-lab-"));
  try {
    return await run(new FileExamLabRepository(join(dir, "lab.json")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("FileExamLabRepository", () => {
  it("starts a public sprint and withholds keys", async () => {
    await withRepo(async (repo) => {
      const started = await repo.start(form, { mode: "sprint" });
      expect(started.payload.questions).toHaveLength(6);
      expect(JSON.stringify(started.payload.questions)).not.toContain(
        "correctChoiceId",
      );
      expect(started.payload.progress.currentSection).toBe("mixed");
    });
  });

  it("enforces extended time in the stored section deadline", async () => {
    await withRepo(async (repo) => {
      const started = await repo.start(form, {
        mode: "sprint",
        timeMultiplier: 1.5,
      });
      const minutes =
        (new Date(started.payload.sectionDeadlineAt).getTime() -
          new Date(started.payload.sectionStartedAt).getTime()) /
        60_000;
      expect(minutes).toBe(22.5);
    });
  });

  it("autosaves answer confidence, time, and flags", async () => {
    await withRepo(async (repo) => {
      const started = await repo.start(form, {
        mode: "section",
        section: "english",
      });
      const saved = await repo.save(started.sessionId, form, {
        currentIndex: 1,
        phase: "questions",
        responses: {
          e1: {
            choiceId: "a",
            confidence: "sure",
            flagged: true,
            elapsedSeconds: 31,
          },
        },
      });
      expect(saved.progress.responses.e1).toMatchObject({
        confidence: "sure",
        flagged: true,
        elapsedSeconds: 31,
      });
    });
  });

  it("advances core sections and finalizes an idempotent report", async () => {
    await withRepo(async (repo) => {
      const started = await repo.start(form, { mode: "core" });
      const math = await repo.advanceSection(started.sessionId, form);
      expect(math.progress.currentSection).toBe("math");
      const reading = await repo.advanceSection(started.sessionId, form);
      expect(reading.progress.currentSection).toBe("reading");
      const review = await repo.advanceSection(started.sessionId, form);
      expect(review.progress.phase).toBe("review");
      const result = await repo.finalize(started.sessionId, form);
      expect(result.result?.total).toBe(6);
      expect(result.result?.unanswered).toBe(6);
      expect((await repo.finalize(started.sessionId, form)).result).toEqual(
        result.result,
      );
    });
  });
});
