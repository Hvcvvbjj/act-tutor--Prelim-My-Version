import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ScoutMessage } from "@act-tutor/core";
import { describe, expect, it } from "vitest";

import { FileScoutSessionRepository } from "./scout-session-repository";

async function withRepo<T>(
  run: (repo: FileScoutSessionRepository) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "scout-session-"));
  try {
    return await run(
      new FileScoutSessionRepository(join(directory, "sessions.json")),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const message: ScoutMessage = {
  id: "message-1",
  askedAt: "2026-07-14T12:00:00.000Z",
  question: "Why is this mission next?",
  answer: {
    summary: "Sentence boundaries is next.",
    explanation: "It has the strongest scored weakness signal.",
    example: null,
    technical: "Server-derived study context",
    nextAction: "Continue the mission.",
    source: "Server learning recommendation",
    mode: "grounded",
    receipt: {
      questionId: null,
      skillId: "sentence-boundaries",
      permissions: ["CAN_DEFINE"],
      checks: ["server-session-context"],
      delivery: "reviewed-rule",
      assistanceMode: "study",
      intent: "plan-reason",
    },
  },
};

describe("FileScoutSessionRepository", () => {
  it("persists preferences and conversation on the server", async () => {
    await withRepo(async (repo) => {
      const started = await repo.getOrCreate(null);
      await repo.updatePreferences(started.sessionId, {
        depth: "detailed",
        readingLevel: "plain",
        exampleStyle: "sports",
        fewerTechnicalTerms: true,
      });
      await repo.appendMessage(started.sessionId, message);

      const restored = await repo.getOrCreate(started.sessionId);
      expect(restored.state.preferences).toMatchObject({
        depth: "detailed",
        readingLevel: "plain",
        exampleStyle: "sports",
      });
      expect(restored.state.messages).toEqual([message]);
    });
  });

  it("isolates sessions and removes only the requested conversation", async () => {
    await withRepo(async (repo) => {
      const first = await repo.getOrCreate(null);
      const second = await repo.getOrCreate(null);
      await repo.appendMessage(first.sessionId, message);
      await repo.reset(first.sessionId);

      const recreated = await repo.getOrCreate(first.sessionId);
      const untouched = await repo.getOrCreate(second.sessionId);
      expect(recreated.sessionId).not.toBe(first.sessionId);
      expect(recreated.state.messages).toEqual([]);
      expect(untouched.sessionId).toBe(second.sessionId);
    });
  });

  it("does not let stale preference hydration overwrite a newer choice", async () => {
    await withRepo(async (repo) => {
      const started = await repo.getOrCreate(null);
      await repo.updatePreferences(
        started.sessionId,
        {
          depth: "detailed",
          readingLevel: "advanced",
          exampleStyle: "gaming",
          fewerTechnicalTerms: false,
        },
        "2099-01-01T00:00:00.000Z",
      );
      const state = await repo.updatePreferences(
        started.sessionId,
        {
          depth: "quick",
          readingLevel: "plain",
          exampleStyle: "school",
          fewerTechnicalTerms: true,
        },
        "2000-01-01T00:00:00.000Z",
      );

      expect(state.preferences.depth).toBe("detailed");
      expect(state.preferencesUpdatedAt).toBe("2099-01-01T00:00:00.000Z");
    });
  });
});
