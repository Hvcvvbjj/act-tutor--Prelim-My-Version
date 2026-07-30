import type { ScoutAnswer } from "@act-tutor/core"
import { describe, expect, it, vi } from "vitest"

import {
  answerWithFreeCloudMrKimAI,
  beginFreeCloudMrKimConnection,
  FREE_CLOUD_AI_CHECK,
  FREE_CLOUD_AI_SCRIPT,
} from "./mr-kim-free-cloud"

const fallback: ScoutAnswer = {
  summary: "Use the sentence-boundary rule.",
  explanation: "A comma alone cannot join two complete sentences.",
  example: "The bell rang; class began.",
  technical: "Reviewed lesson guidance.",
  nextAction: "Try the next item.",
  source: "Reviewed lesson sentence-boundaries",
  mode: "grounded",
  receipt: {
    questionId: null,
    skillId: "sentence-boundaries",
    permissions: ["CAN_REPHRASE", "CAN_DEFINE"],
    checks: ["reviewed-source"],
    delivery: "reviewed-rule",
    assistanceMode: "study",
    intent: "rule",
  },
}

const completeLongSummary =
  "A comma cannot connect two complete sentences by itself, so first check whether each side can stand alone, then use a period, a semicolon, or a comma with a coordinating conjunction to join the ideas correctly."

const overLimitCompleteSummary =
  `A comma cannot join two complete sentences by itself, ${"and the joining rule remains the same ".repeat(16).trim()}.`

const numberedExampleSummary =
  "Comma splice: The bell rang, class began. 1. Use a semicolon: The bell rang; class began. 2. Use a period: The bell rang. Class began."

function client(input?: { signedIn?: boolean; output?: unknown }) {
  let signedIn = input?.signedIn ?? true
  const signIn = vi.fn().mockImplementation(async () => {
    signedIn = true
  })
  const chat = vi.fn().mockResolvedValue(
    input?.output ?? {
      message: {
        content: JSON.stringify({
          summary: "A comma cannot hold two sentences together by itself.",
          explanation:
            "If both sides are complete thoughts, use stronger punctuation or add a joining word.",
          example: "The bell rang; class began.",
          nextAction: "Check whether each side can stand alone.",
        }),
      },
    }
  )
  return {
    auth: {
      isSignedIn: () => signedIn,
      signIn,
    },
    ai: { chat },
    signIn,
    chat,
  }
}

describe("free cloud Mr. Kim AI", () => {
  it("serves the official AI client from AlexACT itself", () => {
    expect(FREE_CLOUD_AI_SCRIPT).toBe("/vendor/puter-v2.5.4.js")
    expect(FREE_CLOUD_AI_SCRIPT).not.toMatch(/^https?:/)
  })

  it("starts a temporary-user connection from the learner action", async () => {
    const puter = client({ signedIn: false })
    await expect(beginFreeCloudMrKimConnection(puter)).resolves.toBe(true)
    expect(puter.signIn).toHaveBeenCalledWith({
      attempt_temp_user_creation: true,
    })
  })

  it("upgrades reviewed guidance with a real model response", async () => {
    const puter = client()
    const answer = await answerWithFreeCloudMrKimAI({
      question: "Can you explain that more simply?",
      answer: fallback,
      puter,
    })

    expect(answer.summary).toContain("comma")
    expect(answer.explanation).toBe(fallback.explanation)
    expect(answer.example).toBe(fallback.example)
    expect(answer.nextAction).toBe(fallback.nextAction)
    expect(answer.receipt.checks).toContain(FREE_CLOUD_AI_CHECK)
    expect(answer.receipt.permissions).toEqual(fallback.receipt.permissions)
    expect(answer.source).toContain("Free cloud Mr. Kim AI")
    expect(puter.chat).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(puter.chat.mock.calls[0])).toContain(
      "multiple ways to apply a rule"
    )
  })

  it("keeps a complete generated summary between 181 and 600 characters without truncating it", async () => {
    const puter = client({
      output: {
        message: {
          content: JSON.stringify({ summary: completeLongSummary }),
        },
      },
    })
    const answer = await answerWithFreeCloudMrKimAI({
      question: "Can you explain that in more detail?",
      answer: fallback,
      puter,
    })

    expect(completeLongSummary.length).toBeGreaterThan(180)
    expect(completeLongSummary.length).toBeLessThanOrEqual(600)
    expect(answer.summary).toBe(completeLongSummary)
    expect(answer.receipt.checks).toContain(FREE_CLOUD_AI_CHECK)
  })

  it("accepts numbered examples without mistaking list markers for score claims", async () => {
    const puter = client({
      output: {
        message: {
          content: JSON.stringify({ summary: numberedExampleSummary }),
        },
      },
    })
    const answer = await answerWithFreeCloudMrKimAI({
      question: "Show me a comma splice and fix it two ways.",
      answer: fallback,
      puter,
    })

    expect(answer.summary).toBe(numberedExampleSummary)
    expect(answer.receipt.checks).toContain(FREE_CLOUD_AI_CHECK)
  })

  it("keeps reviewed guidance when a generated summary exceeds 600 characters", async () => {
    const puter = client({
      output: {
        message: {
          content: JSON.stringify({ summary: overLimitCompleteSummary }),
        },
      },
    })

    expect(overLimitCompleteSummary.length).toBeGreaterThan(600)
    await expect(
      answerWithFreeCloudMrKimAI({
        question: "Can you explain that in more detail?",
        answer: fallback,
        puter,
      })
    ).resolves.toBe(fallback)
  })

  it("lets Puter AI start its automatic auth flow for an unsigned learner", async () => {
    const puter = client({ signedIn: false })
    const answer = await answerWithFreeCloudMrKimAI({
      question: "Can you explain that more simply?",
      answer: fallback,
      puter,
    })

    expect(puter.chat).toHaveBeenCalledTimes(1)
    expect(puter.signIn).not.toHaveBeenCalled()
    expect(answer.receipt.checks).toContain(FREE_CLOUD_AI_CHECK)
  })

  it("keeps reviewed guidance when the model output is malformed", async () => {
    const puter = client({ output: "not json" })
    await expect(
      answerWithFreeCloudMrKimAI({
        question: "Help",
        answer: fallback,
        puter,
      })
    ).resolves.toBe(fallback)
  })

  it("keeps reviewed guidance when optional cloud AI stalls", async () => {
    const puter = client()
    puter.ai.chat = vi.fn(() => new Promise(() => {}))

    await expect(
      answerWithFreeCloudMrKimAI({
        question: "Help",
        answer: fallback,
        puter,
        timeoutMs: 1,
      })
    ).resolves.toBe(fallback)
  })

  it("rejects a garbled rewrite instead of replacing the reviewed rationale", async () => {
    const puter = client({
      output: {
        message: {
          content: JSON.stringify({
            summary:
              "A semicolon correctly joins the You chose… while the correct answer",
          }),
        },
      },
    })
    await expect(
      answerWithFreeCloudMrKimAI({
        question: "Explain my mistake.",
        answer: fallback,
        puter,
      })
    ).resolves.toBe(fallback)
  })

  it("does not send guarded timed-test help to the cloud model", async () => {
    const puter = client()
    const guarded = {
      ...fallback,
      mode: "guarded",
      receipt: {
        ...fallback.receipt,
        assistanceMode: "timed-test",
      },
    } as const satisfies ScoutAnswer
    await expect(
      answerWithFreeCloudMrKimAI({
        question: "What is the answer?",
        answer: guarded,
        puter,
      })
    ).resolves.toBe(guarded)
    expect(puter.chat).not.toHaveBeenCalled()
  })
})
