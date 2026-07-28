import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { DiagnosticFormSecure } from "@act-tutor/core";
import { afterEach, describe, expect, it, vi } from "vitest";

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

async function withRepo<T>(
  run: (repo: FileExamLabRepository, filePath: string) => Promise<T>,
) {
  const dir = await mkdtemp(join(tmpdir(), "exam-lab-"));
  const filePath = join(dir, "lab.json");
  try {
    return await run(new FileExamLabRepository(filePath), filePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

afterEach(() => {
  vi.useRealTimers();
});

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

  it("atomically replaces the previous run when starting over", async () => {
    await withRepo(async (repo) => {
      const original = await repo.start(form, { mode: "sprint" });
      const replacement = await repo.start(
        form,
        { mode: "core" },
        original.sessionId,
      );

      expect(replacement.sessionId).not.toBe(original.sessionId);
      expect(replacement.payload.mode).toBe("core");
      await expect(repo.get(original.sessionId, form)).rejects.toThrow(
        "not found",
      );
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

  it("autosaves neutral confidence and advances without inventing a report", async () => {
    await withRepo(async (repo) => {
      const started = await repo.start(form, {
        mode: "section",
        section: "english",
      });
      const saved = await repo.save(started.sessionId, form, {
        currentIndex: 0,
        phase: "questions",
        responses: {
          e1: {
            choiceId: "a",
            confidence: "unreported",
            flagged: false,
            elapsedSeconds: 31,
          },
        },
      });

      expect(saved.progress.responses.e1?.confidence).toBe("unreported");
      const review = await repo.advanceSection(started.sessionId, form);
      expect(review.progress.phase).toBe("review");
      const completed = await repo.finalize(started.sessionId, form);
      expect(completed.result?.review[0]?.confidence).toBeNull();
      expect(
        completed.result?.confidence.every((summary) => summary.total === 0),
      ).toBe(true);
    });
  });

  it("rejects answer mutations at the section deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-07-26T12:00:00.000Z");
    await withRepo(async (repo) => {
      const started = await repo.start(form, {
        mode: "section",
        section: "english",
      });
      const original = {
        choiceId: "a",
        confidence: "sure" as const,
        flagged: false,
        elapsedSeconds: 30,
      };
      await repo.save(started.sessionId, form, {
        currentIndex: 0,
        phase: "questions",
        responses: { e1: original },
      });

      vi.setSystemTime(started.payload.sectionDeadlineAt);

      await expect(
        repo.save(started.sessionId, form, {
          currentIndex: 0,
          phase: "questions",
          responses: {
            e1: { ...original, choiceId: "b" },
          },
        }),
      ).rejects.toThrow("Time is up");
      await expect(
        repo.save(started.sessionId, form, {
          currentIndex: 1,
          phase: "questions",
          responses: {
            e1: original,
            e2: {
              choiceId: "b",
              confidence: "unsure",
              flagged: false,
              elapsedSeconds: 1,
            },
          },
        }),
      ).rejects.toThrow("Time is up");

      const navigationOnly = await repo.save(started.sessionId, form, {
        currentIndex: 1,
        phase: "questions",
        responses: {
          e1: { ...original, elapsedSeconds: 45 },
        },
      });
      expect(navigationOnly.progress.currentIndex).toBe(1);
      expect(navigationOnly.progress.responses.e1).toMatchObject({
        choiceId: "a",
        confidence: "sure",
        flagged: false,
        elapsedSeconds: 45,
      });
    });
  });

  it("scores blanks as wrong without exposing their answer keys", async () => {
    await withRepo(async (repo) => {
      const started = await repo.start(form, { mode: "core" });
      const math = await repo.advanceSection(started.sessionId, form);
      expect(math.progress.currentSection).toBe("math");
      const reading = await repo.advanceSection(started.sessionId, form);
      expect(reading.progress.currentSection).toBe("reading");
      const review = await repo.advanceSection(started.sessionId, form);
      expect(review.progress.phase).toBe("review");
      const result = await repo.finalize(started.sessionId, form);
      expect(result.result?.unanswered).toBe(6);
      expect(result.result?.review).toEqual([]);
      expect(JSON.stringify(result.result)).not.toContain("Reason e1");
    });
  });

  it("sanitizes unanswered review keys from legacy completed sessions", async () => {
    await withRepo(async (repo, filePath) => {
      const started = await repo.start(form, { mode: "core" });
      await repo.advanceSection(started.sessionId, form);
      await repo.advanceSection(started.sessionId, form);
      await repo.advanceSection(started.sessionId, form);
      await repo.finalize(started.sessionId, form);

      const stored = JSON.parse(await readFile(filePath, "utf8")) as {
        sessions: Record<
          string,
          {
            result: {
              review: unknown[];
            };
          }
        >;
      };
      stored.sessions[started.sessionId].result.review = [
        {
          questionId: "e1",
          section: "english",
          skill: "boundaries",
          skillLabel: "boundaries",
          selectedChoiceId: null,
          correctChoiceId: "a",
          correct: false,
          rationale: "Reason e1",
          confidence: null,
          flagged: false,
          elapsedSeconds: 0,
          expectedSeconds: 45,
        },
      ];
      await writeFile(filePath, `${JSON.stringify(stored, null, 2)}\n`);

      const resumed = new FileExamLabRepository(filePath);
      const loaded = await resumed.get(started.sessionId, form);
      expect(loaded.result?.review).toEqual([]);
      expect(JSON.stringify(loaded.result)).not.toContain("Reason e1");
      const idempotent = await resumed.finalize(started.sessionId, form);
      expect(idempotent.result?.review).toEqual([]);
      expect(JSON.stringify(idempotent.result)).not.toContain("Reason e1");
    });
  });

  it("finalizes a complete core report idempotently", async () => {
    await withRepo(async (repo) => {
      const started = await repo.start(form, { mode: "core" });
      const responses = Object.fromEntries(
        questions.map((question) => [
          question.id,
          {
            choiceId: question.correctChoiceId,
            confidence: "sure" as const,
            flagged: false,
            elapsedSeconds: 30,
          },
        ]),
      );
      await repo.save(started.sessionId, form, {
        currentIndex: 0,
        phase: "questions",
        responses,
      });
      await repo.advanceSection(started.sessionId, form);
      await repo.advanceSection(started.sessionId, form);
      await repo.advanceSection(started.sessionId, form);
      const result = await repo.finalize(started.sessionId, form);
      expect(result.result?.total).toBe(6);
      expect(result.result?.unanswered).toBe(0);
      expect((await repo.finalize(started.sessionId, form)).result).toEqual(
        result.result,
      );
    });
  });
});
