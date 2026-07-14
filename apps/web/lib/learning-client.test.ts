import type {
  LearningAnswerRequest,
  LearningSessionPayload,
} from "@act-tutor/core"
import { beforeEach, describe, expect, it } from "vitest"

import {
  deleteRemoteScoutData,
  flushOfflineAnswerQueue,
  LearningHttpError,
  OFFLINE_QUARANTINE_KEY,
  OFFLINE_QUEUE_KEY,
  readOfflineQueue,
} from "./learning-client"

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

function answer(sequence: number): LearningAnswerRequest {
  return {
    action: "answer",
    questionId: `question-${sequence}`,
    choiceId: "A",
    confidence: "sure",
    selfCorrected: false,
    responseSeconds: 12,
    command: {
      schemaVersion: 2,
      idempotencyKey: `answer-command-${sequence}`,
      learnerSessionId: "learner-session",
      bankVersion: "bank-v1",
      questionVersion: 1,
      sequence,
      answerRevision: 1,
      issuedAt: `2026-07-14T12:00:0${sequence}.000Z`,
    },
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: new MemoryStorage() },
  })
})

describe("offline learning commands", () => {
  it("quarantines an unsupported legacy command instead of replaying it", () => {
    window.localStorage.setItem(
      OFFLINE_QUEUE_KEY,
      JSON.stringify([{ action: "answer", questionId: "legacy" }])
    )

    expect(readOfflineQueue()).toEqual([])
    const held = JSON.parse(
      window.localStorage.getItem(OFFLINE_QUARANTINE_KEY) ?? "[]"
    ) as unknown[]
    expect(held).toHaveLength(1)
  })

  it("replays in sequence and quarantines a server-rejected command", async () => {
    window.localStorage.setItem(
      OFFLINE_QUEUE_KEY,
      JSON.stringify([answer(1), answer(0)])
    )
    const seen: number[] = []
    const result = await flushOfflineAnswerQueue(async (request) => {
      seen.push(request.command.sequence)
      if (request.command.sequence === 1) {
        throw new LearningHttpError("Saved answer arrived out of order.", 400)
      }
      return {} as LearningSessionPayload
    })

    expect(seen).toEqual([0, 1])
    expect(result).toMatchObject({ applied: 1, quarantined: 1 })
    expect(readOfflineQueue()).toEqual([])
  })

  it("keeps transient server failures and later commands queued", async () => {
    window.localStorage.setItem(
      OFFLINE_QUEUE_KEY,
      JSON.stringify([answer(0), answer(1), answer(2)])
    )
    const seen: number[] = []
    const result = await flushOfflineAnswerQueue(async (request) => {
      seen.push(request.command.sequence)
      if (request.command.sequence === 1) {
        throw new LearningHttpError("Server is temporarily busy.", 503)
      }
      return {} as LearningSessionPayload
    })

    expect(seen).toEqual([0, 1])
    expect(result).toMatchObject({
      applied: 1,
      quarantined: 0,
      stoppedTransient: true,
    })
    expect(readOfflineQueue().map((item) => item.command.sequence)).toEqual([
      1, 2,
    ])
    expect(
      JSON.parse(window.localStorage.getItem(OFFLINE_QUARANTINE_KEY) ?? "[]")
    ).toEqual([])
  })
})

describe("remote deletion confirmation", () => {
  it("rejects the whole deletion when one service does not confirm", async () => {
    const request = (async (input: string | URL | Request) =>
      new Response(null, {
        status: String(input).includes("exam-lab") ? 503 : 200,
      })) as typeof fetch

    await expect(deleteRemoteScoutData(request)).rejects.toThrow(
      "/api/exam-lab did not confirm removal"
    )
  })
})
