import type { ScoutAnswer } from "@act-tutor/core"
import { describe, expect, it, vi } from "vitest"

import {
  answerWithFreeCloudMrKimAI,
  beginFreeCloudMrKimConnection,
  FREE_CLOUD_AI_CHECK,
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
