import type {
  LearningAnswerRequest,
  LearningSessionPayload,
} from "@act-tutor/core"
import { beforeEach, describe, expect, it } from "vitest"

import {
  consumeCompletedExamForLearningRound,
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
  it("also asks the account service to remove the saved plan", async () => {
    const requests: Array<{
      url: string
      method: string | undefined
      body: string | null
    }> = []
    const request = (async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      requests.push({
        url: String(input),
        method: init?.method,
        body: typeof init?.body === "string" ? init.body : null,
      })
      return new Response(null, { status: 200 })
    }) as typeof fetch

    await deleteRemoteScoutData(request)

    expect(requests).toContainEqual({
      url: "/api/auth",
      method: "POST",
      body: JSON.stringify({ action: "delete_saved_plan" }),
    })
  })

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

describe("completed full-test consumption", () => {
  it("closes the completed exam only after the next learning round is stored", async () => {
    const events: string[] = []
    let persistedExam: { id: string; status: "completed" } | null = {
      id: "full-test-1",
      status: "completed",
    }
    const refreshExam = () => persistedExam
    const request = (async () => {
      events.push("delete-exam")
      persistedExam = null
      return new Response(JSON.stringify({ reset: true }))
    }) as typeof fetch

    const payload = await consumeCompletedExamForLearningRound({
      startRound: async () => {
        events.push("start-round")
        return { roundNumber: 2 }
      },
      persistPlan: async () => {
        events.push("save-plan")
      },
      request,
    })

    expect(payload).toEqual({ roundNumber: 2 })
    expect(events).toEqual(["start-round", "save-plan", "delete-exam"])
    expect(refreshExam()).toBeNull()
  })

  it("keeps an unconsumed completed exam refreshable when the round is rejected", async () => {
    const completedExam = {
      id: "full-test-1",
      status: "completed" as const,
    }
    let persistedExam: typeof completedExam | null = completedExam
    const refreshExam = () => persistedExam
    const request = (async () => {
      persistedExam = null
      return new Response(JSON.stringify({ reset: true }))
    }) as typeof fetch

    await expect(
      consumeCompletedExamForLearningRound({
        startRound: async () => {
          throw new Error("Finish the current lesson round first.")
        },
        persistPlan: async () => undefined,
        request,
      })
    ).rejects.toThrow("Finish the current lesson round first.")

    expect(refreshExam()).toEqual(completedExam)
  })

  it("keeps the completed exam when plan persistence fails", async () => {
    let examDeleted = false

    await expect(
      consumeCompletedExamForLearningRound({
        startRound: async () => ({ roundNumber: 2 }),
        persistPlan: async () => {
          throw new Error("Plan save failed.")
        },
        request: (async () => {
          examDeleted = true
          return new Response(null, { status: 200 })
        }) as typeof fetch,
      })
    ).rejects.toThrow("Plan save failed.")

    expect(examDeleted).toBe(false)
  })

  it("reports cleanup failure and safely retries the idempotent transition", async () => {
    let newRoundsApplied = 0
    let roundAlreadyStored = false
    let cleanupAttempts = 0
    let persistedExam: { id: string } | null = { id: "full-test-1" }
    const startRound = async () => {
      if (!roundAlreadyStored) {
        roundAlreadyStored = true
        newRoundsApplied += 1
      }
      return { roundNumber: 2 }
    }
    const request = (async () => {
      cleanupAttempts += 1
      if (cleanupAttempts === 1) {
        return new Response(null, { status: 503 })
      }
      persistedExam = null
      return new Response(JSON.stringify({ reset: true }), { status: 200 })
    }) as typeof fetch

    await expect(
      consumeCompletedExamForLearningRound({
        startRound,
        persistPlan: async () => undefined,
        request,
      })
    ).rejects.toThrow("result will not be applied twice")
    expect(persistedExam).toEqual({ id: "full-test-1" })

    const payload = await consumeCompletedExamForLearningRound({
      startRound,
      persistPlan: async () => undefined,
      request,
    })

    expect(payload).toEqual({ roundNumber: 2 })
    expect(newRoundsApplied).toBe(1)
    expect(persistedExam).toBeNull()
    expect(cleanupAttempts).toBe(2)
  })
})
