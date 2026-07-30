import type { ScoutAnswer } from "@act-tutor/core"
import { describe, expect, it, vi } from "vitest"

import {
  answerWithMrKimAI,
  isMrKimAIAvailable,
  mrKimSafetyIdentifier,
  redactSensitiveText,
} from "./mr-kim-ai.server"

const fallback: ScoutAnswer = {
  summary: "Use the sentence-boundary rule.",
  explanation: "A comma alone cannot join two complete sentences.",
  example: null,
  technical: "This came from the reviewed lesson.",
  nextAction: "Try the current item.",
  source: "Reviewed lesson sentence-boundaries",
  mode: "grounded",
  receipt: {
    questionId: null,
    skillId: "sentence-boundaries",
    permissions: ["CAN_REPHRASE", "CAN_DEFINE"],
    checks: ["server-session-context", "reviewed-source"],
    delivery: "reviewed-rule",
    assistanceMode: "study",
    intent: "rule",
  },
}

const input = {
  request: {
    question: "Can you explain this more simply?",
    screen: "today",
  },
  fallback,
  groundingFacts: [
    "The lesson rule says a comma alone cannot join two complete sentences.",
  ],
} as const

const completeLongSummary =
  "A comma cannot connect two complete sentences by itself, so first check whether each side can stand alone, then use a period, a semicolon, or a comma with a coordinating conjunction to join the ideas correctly."

const overLimitCompleteSummary =
  `A comma cannot join two complete sentences by itself, ${"and the joining rule remains the same ".repeat(16).trim()}.`

function response(payload: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: vi.fn().mockResolvedValue(payload),
  }
}

describe("Mr. Kim AI adapter", () => {
  it("recognizes hosted and free local model configurations", () => {
    expect(
      isMrKimAIAvailable({ NODE_ENV: "test", OPENAI_API_KEY: "hosted-key" })
    ).toBe(true)
    expect(
      isMrKimAIAvailable({
        NODE_ENV: "test",
        AI_TUTOR_BASE_URL: "http://127.0.0.1:11434/v1",
        AI_TUTOR_MODEL: "qwen3:4b",
      })
    ).toBe(true)
    expect(
      isMrKimAIAvailable({
        NODE_ENV: "test",
        AI_TUTOR_BASE_URL: "http://127.0.0.1:11434/v1",
      })
    ).toBe(false)
  })

  it("uses the reviewed fallback without a server API key", async () => {
    const fetchImpl = vi.fn()
    const answer = await answerWithMrKimAI(input, {
      apiKey: null,
      fetchImpl,
    })

    expect(answer).toBe(fallback)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("never calls a model for timed or guarded direct-answer help", async () => {
    const fetchImpl = vi.fn()
    const timed = {
      ...fallback,
      mode: "guarded",
      receipt: {
        ...fallback.receipt,
        assistanceMode: "timed-test",
        permissions: ["TEST_MODE", "INTERFACE_HELP_ONLY"],
      },
    } as const satisfies ScoutAnswer
    const preAttempt = {
      ...fallback,
      mode: "guarded",
      receipt: {
        ...fallback.receipt,
        questionId: "practice-1",
        permissions: ["CAN_HINT", "DIRECT_ANSWER_REQUIRES_ATTEMPT"] as const,
      },
    } satisfies ScoutAnswer

    expect(
      await answerWithMrKimAI(
        { ...input, fallback: timed },
        { apiKey: "test-key", fetchImpl }
      )
    ).toBe(timed)
    expect(
      await answerWithMrKimAI(
        { ...input, fallback: preAttempt },
        { apiKey: "test-key", fetchImpl }
      )
    ).toBe(preAttempt)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("uses the model for a safe pre-attempt hint without sending question content", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        output_text: JSON.stringify({
          summary:
            "Start by checking whether both sides are complete thoughts.",
          explanation:
            "That tells you whether the comma is trying to join two sentences by itself.",
          example: null,
          nextAction: "Check each side before comparing the choices.",
        }),
      })
    )
    const answer = await answerWithMrKimAI(
      {
        ...input,
        fallback: {
          ...fallback,
          receipt: {
            ...fallback.receipt,
            questionId: "practice-1",
            intent: "hint",
            permissions: [
              "CAN_REPHRASE",
              "CAN_DEFINE",
              "CAN_HINT",
              "DIRECT_ANSWER_REQUIRES_ATTEMPT",
            ],
          },
        },
      },
      { apiKey: "test-key", fetchImpl }
    )

    expect(answer.receipt.checks).toContain("openai-responses-api")
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String(fetchImpl.mock.calls[0]?.[1]?.body)).not.toContain(
      "Which choice"
    )
  })

  it("parses a structured Responses API answer and preserves receipts", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  summary: "A comma cannot hold two sentences together.",
                  explanation:
                    "If both sides can stand alone, use a period, semicolon, or a comma with a joining word.",
                  example: "The bell rang; class began.",
                  nextAction: "Check whether each side can stand alone.",
                }),
              },
            ],
          },
        ],
      })
    )

    const answer = await answerWithMrKimAI(input, {
      apiKey: "test-key",
      model: "test-model",
      safetyIdentifier: "scout_test_identifier",
      fetchImpl,
    })

    expect(answer.summary).toBe("A comma cannot hold two sentences together.")
    expect(answer.explanation).toBe(
      "If both sides can stand alone, use a period, semicolon, or a comma with a joining word."
    )
    expect(answer.example).toBe("The bell rang; class began.")
    expect(answer.nextAction).toBe("Check whether each side can stand alone.")
    expect(answer.technical).toBe(fallback.technical)
    expect(answer.source).toContain("Mr. Kim AI grounded in")
    expect(answer.receipt).toMatchObject({
      assistanceMode: "study",
      delivery: "reviewed-rule",
    })
    expect(answer.receipt.checks).toContain("openai-responses-api")

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.openai.com/v1/responses")
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body).toMatchObject({
      model: "test-model",
      store: false,
      reasoning: { effort: "low" },
      safety_identifier: "scout_test_identifier",
      text: { verbosity: "low" },
    })
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-key",
    })
  })

  it("uses a free OpenAI-compatible local model without an API key", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Check whether both sides are full sentences.",
                explanation:
                  "A comma cannot join two complete sentences by itself.",
                example: "The bell rang; class began.",
                nextAction: "Check each side before choosing punctuation.",
              }),
            },
          },
        ],
      })
    )

    const answer = await answerWithMrKimAI(input, {
      apiKey: null,
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "qwen3:4b",
      fetchImpl,
    })

    expect(answer.receipt.checks).toContain("openai-compatible-chat")
    expect(answer.source).toContain("Mr. Kim free AI")
    expect(answer.summary).toBe("Check whether both sides are full sentences.")
    expect(answer.explanation).toBe(fallback.explanation)
    expect(answer.example).toBe(fallback.example)
    expect(answer.nextAction).toBe(fallback.nextAction)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://127.0.0.1:11434/v1/chat/completions")
    expect(init.headers).not.toMatchObject({ Authorization: expect.anything() })
  })

  it("uses only a small compatible model's summary and preserves every reviewed teaching field", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        choices: [
          {
            message: {
              content: JSON.stringify({
                structured: {
                  summary:
                    "A comma cannot hold two complete sentences together.",
                  explanation: "Generated detail that must not replace review.",
                  example: "Generated example that must not replace review.",
                  nextAction: "Generated action that must not replace review.",
                },
              }),
            },
          },
        ],
      })
    )

    const answer = await answerWithMrKimAI(input, {
      apiKey: null,
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "small-local-model",
      fetchImpl,
    })

    expect(answer.summary).toContain("comma")
    expect(answer.explanation).toBe(fallback.explanation)
    expect(answer.example).toBe(fallback.example)
    expect(answer.nextAction).toBe(fallback.nextAction)
    expect(answer.receipt.checks).toContain("openai-compatible-chat")
  })

  it("keeps a complete compatible-model summary without clipping it", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: completeLongSummary,
              }),
            },
          },
        ],
      })
    )

    const answer = await answerWithMrKimAI(input, {
      apiKey: null,
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "small-local-model",
      fetchImpl,
    })

    expect(completeLongSummary.length).toBeGreaterThan(180)
    expect(answer.summary).toBe(completeLongSummary)
    expect(answer.receipt.checks).toContain("openai-compatible-chat")
  })

  it("keeps reviewed guidance when a compatible-model summary exceeds 600 characters", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: overLimitCompleteSummary,
              }),
            },
          },
        ],
      })
    )

    expect(overLimitCompleteSummary.length).toBeGreaterThan(600)
    await expect(
      answerWithMrKimAI(input, {
        apiKey: null,
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "small-local-model",
        fetchImpl,
      })
    ).resolves.toBe(fallback)
  })

  it("keeps reviewed guidance when a local model splices answer-ledger labels", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary:
                  "A semicolon correctly joins the You chose… while the correct answer",
              }),
            },
          },
        ],
      })
    )

    await expect(
      answerWithMrKimAI(input, {
        apiKey: null,
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "small-local-model",
        fetchImpl,
      })
    ).resolves.toBe(fallback)
  })

  it("redacts contact details before model delivery", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        output_text: JSON.stringify({
          summary: "Keep the question focused on the lesson.",
          explanation: "Personal contact details are not needed.",
          example: null,
          nextAction: "Ask about the sentence rule.",
        }),
      })
    )
    await answerWithMrKimAI(
      {
        ...input,
        request: {
          ...input.request,
          question:
            "Email me at student@example.com or call 312-555-0198 about this.",
        },
      },
      { apiKey: "test-key", fetchImpl }
    )

    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit
    const body = String(init.body)
    expect(body).not.toContain("student@example.com")
    expect(body).not.toContain("312-555-0198")
    expect(body).toContain("[email omitted]")
    expect(body).toContain("[phone omitted]")
    expect(redactSensitiveText("student@example.com")).toBe("[email omitted]")
  })

  it("falls back on provider errors and malformed model output", async () => {
    const providerFailure = vi.fn().mockResolvedValue(response({}, false))
    const malformed = vi
      .fn()
      .mockResolvedValue(response({ output_text: "not json" }))

    await expect(
      answerWithMrKimAI(input, {
        apiKey: "test-key",
        fetchImpl: providerFailure,
      })
    ).resolves.toBe(fallback)
    await expect(
      answerWithMrKimAI(input, {
        apiKey: "test-key",
        fetchImpl: malformed,
      })
    ).resolves.toBe(fallback)
  })

  it("bounds generated requests per session without blocking reviewed help", async () => {
    const generatedHistory = Array.from({ length: 6 }, (_, index) => ({
      id: `message-${index}`,
      askedAt: `2026-07-28T12:00:0${index}.000Z`,
      screen: "today" as const,
      question: "Help",
      answer: {
        ...fallback,
        receipt: {
          ...fallback.receipt,
          checks: [...fallback.receipt.checks, "openai-responses-api"],
        },
      },
    }))
    const fetchImpl = vi.fn()

    await expect(
      answerWithMrKimAI(
        { ...input, history: generatedHistory },
        {
          apiKey: "test-key",
          now: () => Date.parse("2026-07-28T12:00:30.000Z"),
          fetchImpl,
        }
      )
    ).resolves.toBe(fallback)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("creates a stable privacy-preserving safety identifier", async () => {
    const first = await mrKimSafetyIdentifier("session-one")
    const second = await mrKimSafetyIdentifier("session-one")
    const different = await mrKimSafetyIdentifier("session-two")

    expect(first).toBe(second)
    expect(first).not.toBe(different)
    expect(first).toMatch(/^scout_[a-f0-9]{32}$/)
    expect(first).not.toContain("session-one")
  })
})
