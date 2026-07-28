"use client"

import type { ScoutAnswer, ScoutMessage } from "@act-tutor/core"

export const ON_DEVICE_AI_CHECK = "chrome-on-device-ai"

type Availability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable"

interface LanguageModelSession {
  prompt(
    input: string,
    options?: {
      responseConstraint?: Record<string, unknown>
    }
  ): Promise<string>
  destroy?: () => void
}

interface LanguageModelFactory {
  availability(options: {
    expectedInputs: ReadonlyArray<{
      type: "text"
      languages: readonly ["en"]
    }>
    expectedOutputs: ReadonlyArray<{
      type: "text"
      languages: readonly ["en"]
    }>
  }): Promise<Availability>
  create(options: {
    expectedInputs: ReadonlyArray<{
      type: "text"
      languages: readonly ["en"]
    }>
    expectedOutputs: ReadonlyArray<{
      type: "text"
      languages: readonly ["en"]
    }>
    initialPrompts: ReadonlyArray<{
      role: "system"
      content: string
    }>
    monitor?: (monitor: {
      addEventListener(
        name: "downloadprogress",
        listener: (event: { loaded: number }) => void
      ): void
    }) => void
  }): Promise<LanguageModelSession>
}

declare global {
  interface Window {
    LanguageModel?: LanguageModelFactory
  }
}

const ENGLISH_TEXT_OPTIONS = {
  expectedInputs: [{ type: "text", languages: ["en"] }] as const,
  expectedOutputs: [{ type: "text", languages: ["en"] }] as const,
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "explanation", "example", "nextAction"],
  properties: {
    summary: { type: "string" },
    explanation: { type: "string" },
    example: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    nextAction: { type: "string" },
  },
} as const

const ON_DEVICE_INSTRUCTIONS = `
You are Mr. Kim, Scout ACT's calm, concise tutor. The server has already made a
reviewed answer. Rewrite that answer so it directly answers the learner in
plain English. Use only facts in the reviewed answer. Do not solve a new
question, choose an answer, add a rule, invent a score, or weaken any boundary.
Keep the summary to one sentence, the explanation to at most three short
sentences, the example optional, and the next action to one sentence. Return
only JSON that matches the requested fields.
`.trim()

let preparedSession: Promise<LanguageModelSession> | null = null

function clipped(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength)
}

function parseAnswer(value: string) {
  const unfenced = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
  let parsed: unknown
  try {
    parsed = JSON.parse(unfenced)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
  const record = parsed as Record<string, unknown>
  if (
    typeof record.summary !== "string" ||
    typeof record.explanation !== "string" ||
    (record.example !== null && typeof record.example !== "string") ||
    typeof record.nextAction !== "string"
  ) {
    return null
  }
  const summary = clipped(record.summary, 180)
  const explanation = clipped(record.explanation, 600)
  const example =
    typeof record.example === "string"
      ? clipped(record.example, 360) || null
      : null
  const nextAction = clipped(record.nextAction, 180)
  return summary && explanation && nextAction
    ? { summary, explanation, example, nextAction }
    : null
}

export function canUseOnDeviceAI(answer: ScoutAnswer) {
  if (answer.mode !== "grounded") return false
  if (answer.receipt.assistanceMode === "timed-test") return false
  if (
    answer.source.startsWith("Grounding check:") ||
    answer.source.startsWith("Capability boundary:")
  ) {
    return false
  }
  return (
    answer.receipt.questionId === null ||
    answer.receipt.permissions.includes("CAN_EXPLAIN_AFTER_ATTEMPT")
  )
}

export async function onDeviceAIAvailability(
  languageModel: LanguageModelFactory | undefined =
    typeof window === "undefined" ? undefined : window.LanguageModel
) {
  if (!languageModel) return "unavailable" as const
  try {
    return await languageModel.availability(ENGLISH_TEXT_OPTIONS)
  } catch {
    return "unavailable" as const
  }
}

export function prepareOnDeviceMrKimAI(input: {
  languageModel?: LanguageModelFactory
  onDownloadProgress?: (progress: number) => void
} = {}) {
  const languageModel =
    input.languageModel ??
    (typeof window === "undefined" ? undefined : window.LanguageModel)
  if (!languageModel) return Promise.resolve(false)
  if (!preparedSession) {
    preparedSession = languageModel.create({
      ...ENGLISH_TEXT_OPTIONS,
      initialPrompts: [
        {
          role: "system",
          content: ON_DEVICE_INSTRUCTIONS,
        },
      ],
      monitor: input.onDownloadProgress
        ? (monitor) => {
            monitor.addEventListener("downloadprogress", (event) => {
              input.onDownloadProgress?.(
                Math.max(0, Math.min(1, event.loaded))
              )
            })
          }
        : undefined,
    })
  }
  return preparedSession.then(
    () => true,
    () => {
      preparedSession = null
      return false
    }
  )
}

export async function answerWithOnDeviceMrKimAI(input: {
  question: string
  answer: ScoutAnswer
  history?: ReadonlyArray<ScoutMessage>
  languageModel?: LanguageModelFactory
  onDownloadProgress?: (progress: number) => void
}) {
  if (!canUseOnDeviceAI(input.answer)) return input.answer
  const languageModel =
    input.languageModel ??
    (typeof window === "undefined" ? undefined : window.LanguageModel)
  if (!languageModel) return input.answer
  const availability = await onDeviceAIAvailability(languageModel)
  if (availability === "unavailable") return input.answer

  let session: LanguageModelSession | null = null
  try {
    if (!input.languageModel && preparedSession) {
      session = await preparedSession
      preparedSession = null
    } else {
      session = await languageModel.create({
        ...ENGLISH_TEXT_OPTIONS,
        initialPrompts: [
          {
            role: "system",
            content: ON_DEVICE_INSTRUCTIONS,
          },
        ],
        monitor: input.onDownloadProgress
          ? (monitor) => {
              monitor.addEventListener("downloadprogress", (event) => {
                input.onDownloadProgress?.(
                  Math.max(0, Math.min(1, event.loaded))
                )
              })
            }
          : undefined,
      })
    }
    const recentConversation = (input.history ?? []).slice(-3).map((message) => ({
      learner: message.question.slice(0, 240),
      mrKim: {
        summary: message.answer.summary.slice(0, 180),
        explanation: message.answer.explanation.slice(0, 360),
      },
    }))
    const generated = parseAnswer(
      await session.prompt(
        JSON.stringify({
          learnerQuestion: input.question.slice(0, 500),
          reviewedAnswer: {
            summary: input.answer.summary,
            explanation: input.answer.explanation,
            example: input.answer.example,
            nextAction: input.answer.nextAction,
          },
          recentConversation,
        }),
        { responseConstraint: RESPONSE_SCHEMA }
      )
    )
    if (!generated) return input.answer
    return {
      ...input.answer,
      ...generated,
      source: `Free on-device Mr. Kim AI grounded in ${input.answer.source}`,
      receipt: {
        ...input.answer.receipt,
        checks: [...input.answer.receipt.checks, ON_DEVICE_AI_CHECK],
      },
    }
  } catch {
    return input.answer
  } finally {
    session?.destroy?.()
  }
}
