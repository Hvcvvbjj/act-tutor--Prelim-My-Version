"use client"

import type { ScoutAnswer, ScoutMessage } from "@act-tutor/core"

import { generatedMrKimSummaryIsUsable } from "@/lib/mr-kim-generated-summary"
import { canUseOnDeviceAI } from "@/lib/mr-kim-on-device"

export const FREE_CLOUD_AI_CHECK = "puter-user-cloud-ai"

type PuterChatResponse =
  | string
  | {
      message?: {
        content?:
          | string
          | ReadonlyArray<{
              text?: string
              type?: string
            }>
      }
    }

interface PuterClient {
  auth: {
    isSignedIn(): boolean
    signIn(options?: { attempt_temp_user_creation?: boolean }): Promise<unknown>
  }
  ai: {
    chat(
      messages: ReadonlyArray<{
        role: "system" | "user"
        content: string
      }>,
      options: {
        model: string
        stream: false
      }
    ): Promise<PuterChatResponse>
  }
}

const PUTER_MODEL = "gpt-5.4-nano"

type PuterWindow = {
  puter?: PuterClient
}

type PuterModuleLoader = () => Promise<{
  default?: PuterClient
  puter?: PuterClient
}>

const FREE_CLOUD_INSTRUCTIONS = `
You are Mr. Kim, AlexACT's calm and concise AI tutor. The app has already made
a reviewed answer whose teaching facts and next action are already verified.
Write only one short summary sentence that directly answers the learner in
plain English. Use only facts in the reviewed answer. Do not solve a new
question, choose an answer, invent a rule, example, or score, or weaken any
safety boundary. Explain the rule instead of repeating answer-ledger labels
such as "you chose" or "correct answer." Return only a JSON object with one
string field named "summary".
`.trim()

let bundledPuterPromise: Promise<PuterClient | null> | null = null

function clipped(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength)
}

function responseText(response: PuterChatResponse) {
  if (typeof response === "string") return response
  const content = response.message?.content
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return null
  const joined = content
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
  return joined || null
}

function parseSummary(response: PuterChatResponse) {
  const raw = responseText(response)
  if (!raw) return null
  const unfenced = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
  let parsed: unknown
  try {
    parsed = JSON.parse(unfenced)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null
  }
  const record = parsed as Record<string, unknown>
  if (typeof record.summary !== "string") return null
  return clipped(record.summary, 180) || null
}

function runtimePuterWindow(): PuterWindow | undefined {
  return typeof window === "undefined"
    ? undefined
    : (window as unknown as PuterWindow)
}

const loadBundledPuter: PuterModuleLoader = async () => {
  const puterModule = await import("@heyputer/puter.js")
  return {
    default: puterModule.default as unknown as PuterClient,
    puter: puterModule.puter as unknown as PuterClient,
  }
}

export function preloadFreeCloudMrKimAI(
  windowObject: PuterWindow | undefined = runtimePuterWindow(),
  loader: PuterModuleLoader = loadBundledPuter
) {
  if (windowObject?.puter) {
    return Promise.resolve(true)
  }
  if (!windowObject) return Promise.resolve(false)
  bundledPuterPromise ??= loader()
    .then((module) => module.puter ?? module.default ?? null)
    .catch(() => {
      bundledPuterPromise = null
      return null
    })
  return bundledPuterPromise.then((puter) => {
    if (!puter) return false
    windowObject.puter = puter
    return true
  })
}

export function beginFreeCloudMrKimConnection(
  puter: PuterClient | undefined = runtimePuterWindow()?.puter
) {
  if (!puter) return null
  if (puter.auth.isSignedIn()) return Promise.resolve(true)
  return puter.auth
    .signIn({ attempt_temp_user_creation: true })
    .then(() => puter.auth.isSignedIn())
    .catch(() => false)
}

export async function answerWithFreeCloudMrKimAI(input: {
  question: string
  answer: ScoutAnswer
  history?: ReadonlyArray<ScoutMessage>
  puter?: PuterClient
}) {
  if (!canUseOnDeviceAI(input.answer)) return input.answer
  const puter = input.puter ?? runtimePuterWindow()?.puter
  if (!puter || !puter.auth.isSignedIn()) return input.answer

  const recentConversation = (input.history ?? []).slice(-3).map((message) => ({
    learner: message.question.slice(0, 240),
    mrKim: {
      summary: message.answer.summary.slice(0, 180),
      explanation: message.answer.explanation.slice(0, 360),
    },
  }))

  try {
    const response = await puter.ai.chat(
      [
        { role: "system", content: FREE_CLOUD_INSTRUCTIONS },
        {
          role: "user",
          content: JSON.stringify({
            learnerQuestion: input.question.slice(0, 500),
            reviewedAnswer: {
              summary: input.answer.summary,
              explanation: input.answer.explanation,
              example: input.answer.example,
              nextAction: input.answer.nextAction,
            },
            recentConversation,
          }),
        },
      ],
      { model: PUTER_MODEL, stream: false }
    )
    const generatedSummary = parseSummary(response)
    if (
      !generatedSummary ||
      !generatedMrKimSummaryIsUsable(generatedSummary, input.answer)
    ) {
      return input.answer
    }
    return {
      ...input.answer,
      summary: generatedSummary,
      source: `Free cloud Mr. Kim AI grounded in ${input.answer.source}`,
      receipt: {
        ...input.answer.receipt,
        checks: [...input.answer.receipt.checks, FREE_CLOUD_AI_CHECK],
      },
    }
  } catch {
    return input.answer
  }
}
