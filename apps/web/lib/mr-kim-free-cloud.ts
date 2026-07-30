"use client"

import type { ScoutAnswer, ScoutMessage } from "@act-tutor/core"

import {
  generatedMrKimSummaryIsUsable,
  MAX_GENERATED_MR_KIM_SUMMARY_LENGTH,
  normalizeGeneratedMrKimSummary,
} from "@/lib/mr-kim-generated-summary"
import { canUseOnDeviceAI } from "@/lib/mr-kim-on-device"

export const FREE_CLOUD_AI_CHECK = "puter-user-cloud-ai"
export const FREE_CLOUD_AI_SCRIPT = "/vendor/puter-v2.5.4.js"

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
const PUTER_SCRIPT_ID = "alexact-free-ai"
const PUTER_LOAD_TIMEOUT_MS = 8_000
const PUTER_ANSWER_TIMEOUT_MS = 45_000

type PuterWindow = {
  puter?: PuterClient
  setTimeout(handler: () => void, timeout: number): number
  clearTimeout(timeout: number): void
}

const FREE_CLOUD_INSTRUCTIONS = `
You are Mr. Kim, AlexACT's calm and concise AI tutor. The app has already made
a reviewed answer whose teaching facts and next action are already verified.
Write one to four short sentences that directly answer the learner in plain
English. Use the reviewed answer as the source of truth. You may create a brief
example only when the learner asks for one and it illustrates the reviewed
rule. Do not solve a new or unanswered test question, choose an answer, invent
a score, or weaken any safety boundary. Explain the rule instead of repeating
answer-ledger labels such as "you chose" or "correct answer." Stay under
${MAX_GENERATED_MR_KIM_SUMMARY_LENGTH} characters. Return only a JSON object
with one string field named "summary".
`.trim()

let scriptPromise: Promise<boolean> | null = null

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
  return normalizeGeneratedMrKimSummary(record.summary)
}

function runtimePuterWindow(): PuterWindow | undefined {
  return typeof window === "undefined"
    ? undefined
    : (window as unknown as PuterWindow)
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Optional AI timed out.")),
          timeoutMs
        )
      }),
    ])
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
  }
}

export function preloadFreeCloudMrKimAI(
  documentObject: Document | undefined = typeof document === "undefined"
    ? undefined
    : document,
  windowObject: PuterWindow | undefined = runtimePuterWindow()
) {
  if (windowObject?.puter) {
    return Promise.resolve(true)
  }
  if (!documentObject || !windowObject) return Promise.resolve(false)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<boolean>((resolve) => {
    let existing = documentObject.getElementById(
      PUTER_SCRIPT_ID
    ) as HTMLScriptElement | null
    if (existing?.dataset.alexactLoadState === "failed") {
      existing.remove()
      existing = null
    }
    const script = existing ?? documentObject.createElement("script")
    let settled = false
    let timeout = 0
    const finish = (loaded: boolean) => {
      if (settled) return
      settled = true
      windowObject.clearTimeout(timeout)
      const ready = loaded && Boolean(windowObject.puter)
      script.dataset.alexactLoadState = ready ? "loaded" : "failed"
      if (!ready) {
        script.remove()
        scriptPromise = null
      }
      resolve(ready)
    }
    timeout = windowObject.setTimeout(
      () => finish(false),
      PUTER_LOAD_TIMEOUT_MS
    )
    script.addEventListener("load", () => finish(true), { once: true })
    script.addEventListener("error", () => finish(false), { once: true })
    if (!existing) {
      script.id = PUTER_SCRIPT_ID
      script.src = FREE_CLOUD_AI_SCRIPT
      script.async = true
      script.referrerPolicy = "same-origin"
      documentObject.head.append(script)
    }
  })
  return scriptPromise
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
  timeoutMs?: number
}) {
  if (!canUseOnDeviceAI(input.answer)) return input.answer
  const puter = input.puter ?? runtimePuterWindow()?.puter
  if (!puter) return input.answer

  const recentConversation = (input.history ?? []).slice(-3).map((message) => ({
    learner: message.question.slice(0, 240),
    mrKim: {
      summary: message.answer.summary.slice(0, 180),
      explanation: message.answer.explanation.slice(0, 360),
    },
  }))

  try {
    const response = await withTimeout(
      puter.ai.chat(
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
      ),
      input.timeoutMs ?? PUTER_ANSWER_TIMEOUT_MS
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
