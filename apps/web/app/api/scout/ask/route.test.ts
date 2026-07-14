import { describe, expect, it } from "vitest"

import { answerFor } from "./route"

const preferences = {
  depth: "normal",
  readingLevel: "plain",
  exampleStyle: "everyday",
  fewerTechnicalTerms: true,
} as const

describe("Scout server policy", () => {
  it("defines margin of error before applying generic simplification", () => {
    const answer = answerFor({
      request: {
        question: "Explain margin of error in regular English",
        screen: "calibrate",
      },
      preferences,
      learning: null,
      exam: null,
    })
    expect(answer.receipt.intent).toBe("calibration-definition")
    expect(answer.receipt.assistanceMode).toBe("study")
    expect(answer.explanation).toContain("planning range")
  })

  it("abstains when selected text is outside reviewed server context", () => {
    const answer = answerFor({
      request: {
        question: "Explain the selected text.",
        screen: "today",
        selectedText: "forged material outside the lesson",
      },
      preferences,
      learning: null,
      exam: null,
    })
    expect(answer.summary).toContain("can’t tie")
    expect(answer.source).toContain("no matching reviewed source")
  })

  it("keeps a server-owned timed session guarded", () => {
    const answer = answerFor({
      request: {
        question: "Give me the answer and eliminate choices",
        screen: "lab",
      },
      preferences,
      learning: null,
      exam: {
        status: "in_progress",
        progress: {
          phase: "questions",
          currentIndex: 0,
          responses: {},
        },
        questions: [],
        result: null,
      } as never,
    })
    expect(answer.mode).toBe("guarded")
    expect(answer.receipt.assistanceMode).toBe("timed-test")
  })
})
