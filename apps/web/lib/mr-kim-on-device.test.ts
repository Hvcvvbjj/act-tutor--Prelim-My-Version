import type { ScoutAnswer } from "@act-tutor/core"
import { describe, expect, it, vi } from "vitest"

import {
  answerWithOnDeviceMrKimAI,
  canUseOnDeviceAI,
  ON_DEVICE_AI_CHECK,
  onDeviceAIAvailability,
} from "./mr-kim-on-device"

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

function localModel(output: string) {
  const destroy = vi.fn()
  return {
    destroy,
    factory: {
      availability: vi.fn().mockResolvedValue("available"),
      create: vi.fn().mockResolvedValue({
        prompt: vi.fn().mockResolvedValue(output),
        destroy,
      }),
    },
  }
}

describe("free on-device Mr. Kim AI", () => {
  it("reports unavailable when the browser has no language model", async () => {
    await expect(onDeviceAIAvailability(undefined)).resolves.toBe("unavailable")
  })

  it("only upgrades reviewed help without an unattempted active question", () => {
    expect(canUseOnDeviceAI(fallback)).toBe(true)
    expect(
      canUseOnDeviceAI({
        ...fallback,
        receipt: {
          ...fallback.receipt,
          questionId: "question-1",
          permissions: ["CAN_HINT", "DIRECT_ANSWER_REQUIRES_ATTEMPT"],
        },
      })
    ).toBe(false)
    expect(
      canUseOnDeviceAI({
        ...fallback,
        receipt: {
          ...fallback.receipt,
          assistanceMode: "timed-test",
        },
      })
    ).toBe(false)
  })

  it("runs a browser model and preserves the server safety receipt", async () => {
    const model = localModel(
      JSON.stringify({
        summary: "A comma cannot hold two sentences together by itself.",
        explanation:
          "If both sides are complete thoughts, use stronger punctuation or add a joining word.",
        example: "The bell rang; class began.",
        nextAction: "Check whether each side can stand alone.",
      })
    )
    const answer = await answerWithOnDeviceMrKimAI({
      question: "Can you say that more simply?",
      answer: fallback,
      languageModel: model.factory,
    })

    expect(answer.summary).toContain("comma")
    expect(answer.explanation).toBe(fallback.explanation)
    expect(answer.example).toBe(fallback.example)
    expect(answer.nextAction).toBe(fallback.nextAction)
    expect(answer.receipt.checks).toContain(ON_DEVICE_AI_CHECK)
    expect(answer.receipt.permissions).toEqual(fallback.receipt.permissions)
    expect(answer.source).toContain("Free on-device Mr. Kim AI")
    expect(model.destroy).toHaveBeenCalledTimes(1)
  })

  it("uses reviewed guidance if local output is malformed", async () => {
    const model = localModel("not json")
    await expect(
      answerWithOnDeviceMrKimAI({
        question: "Help",
        answer: fallback,
        languageModel: model.factory,
      })
    ).resolves.toBe(fallback)
  })
})
