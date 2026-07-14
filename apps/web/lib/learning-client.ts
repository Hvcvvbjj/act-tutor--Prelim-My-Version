import type {
  LearningActionRequest,
  LearningAnswerRequest,
  LearningSessionPayload,
  QuarantinedLearningCommand,
} from "@act-tutor/core"

export const OFFLINE_QUEUE_KEY = "scout-offline-answer-queue-v2"
export const OFFLINE_QUARANTINE_KEY = "scout-offline-answer-quarantine-v2"
const OFFLINE_LESSON_KEY = "scout-offline-learning-session-v1"

function isLearningAnswerRequest(
  value: unknown
): value is LearningAnswerRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const request = value as Partial<LearningAnswerRequest>
  return (
    request.action === "answer" &&
    typeof request.questionId === "string" &&
    typeof request.choiceId === "string" &&
    request.command?.schemaVersion === 2 &&
    typeof request.command.idempotencyKey === "string" &&
    typeof request.command.learnerSessionId === "string" &&
    typeof request.command.bankVersion === "string" &&
    Number.isInteger(request.command.questionVersion) &&
    Number.isInteger(request.command.sequence) &&
    request.command.answerRevision === 1
  )
}

function readQuarantine() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(OFFLINE_QUARANTINE_KEY) ?? "[]"
    ) as unknown
    return Array.isArray(parsed) ? (parsed as QuarantinedLearningCommand[]) : []
  } catch {
    return []
  }
}

export function quarantineOfflineAnswer(request: unknown, reason: string) {
  const quarantined = readQuarantine()
  quarantined.push({
    request,
    reason,
    quarantinedAt: new Date().toISOString(),
  })
  window.localStorage.setItem(
    OFFLINE_QUARANTINE_KEY,
    JSON.stringify(quarantined.slice(-50))
  )
}

export function readOfflineQueue(): LearningAnswerRequest[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(OFFLINE_QUEUE_KEY) ?? "[]"
    ) as unknown
    if (!Array.isArray(parsed)) return []
    const valid = parsed.filter(isLearningAnswerRequest)
    for (const invalid of parsed.filter(
      (item) => !isLearningAnswerRequest(item)
    )) {
      quarantineOfflineAnswer(
        invalid,
        "Unsupported or malformed offline command"
      )
    }
    if (valid.length !== parsed.length) {
      window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(valid))
    }
    return valid
  } catch {
    return []
  }
}

export function readCachedLearningSession() {
  try {
    return JSON.parse(
      window.localStorage.getItem(OFFLINE_LESSON_KEY) ?? "null"
    ) as LearningSessionPayload | null
  } catch {
    return null
  }
}

function queueOfflineAnswer(body: LearningAnswerRequest) {
  const current = readOfflineQueue()
  if (
    !current.some(
      (item) => item.command.idempotencyKey === body.command.idempotencyKey
    )
  ) {
    current.push(body)
    window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(current))
  }
}

export class LearningHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

function isTransientStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

export async function learningRequest(body: LearningActionRequest) {
  let response: Response
  try {
    response = await fetch("/api/learning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (isLearningAnswerRequest(body) && typeof window !== "undefined") {
      queueOfflineAnswer(body)
      throw new Error(
        "You are offline. This answer is saved on this device and will be scored when the connection returns."
      )
    }
    throw error
  }
  const payload = (await response.json().catch(() => ({
    error: `Learning request failed with status ${response.status}.`,
  }))) as LearningSessionPayload | { error: string }
  if (!response.ok || "error" in payload) {
    if (
      isLearningAnswerRequest(body) &&
      typeof window !== "undefined" &&
      isTransientStatus(response.status)
    ) {
      queueOfflineAnswer(body)
    }
    throw new LearningHttpError(
      "error" in payload ? payload.error : "Learning request failed.",
      response.status
    )
  }
  return payload
}

export async function loadLearningSession() {
  const response = await fetch("/api/learning", { cache: "no-store" })
  const payload = (await response.json()) as
    LearningSessionPayload | { error: string }
  if (!response.ok || "error" in payload) {
    throw new Error(
      "error" in payload ? payload.error : "Learning session refresh failed."
    )
  }
  return payload
}

export function cacheLearningSession(learning: LearningSessionPayload) {
  window.localStorage.setItem(OFFLINE_LESSON_KEY, JSON.stringify(learning))
}

export async function flushOfflineAnswerQueue(
  send: (
    request: LearningAnswerRequest
  ) => Promise<LearningSessionPayload> = learningRequest
) {
  const queued = readOfflineQueue().sort(
    (left, right) =>
      left.command.sequence - right.command.sequence ||
      left.command.issuedAt.localeCompare(right.command.issuedAt)
  )
  let applied = 0
  let quarantined = 0
  let lastQuarantineReason: string | null = null
  let lastTransientReason: string | null = null
  let remaining = [...queued]
  for (const command of queued) {
    try {
      await send(command)
      applied += 1
    } catch (error) {
      if (!(error instanceof LearningHttpError)) {
        return {
          applied,
          quarantined,
          lastQuarantineReason,
          lastTransientReason,
          stoppedOffline: true,
          stoppedTransient: false,
        }
      }
      if (isTransientStatus(error.status)) {
        lastTransientReason = error.message
        return {
          applied,
          quarantined,
          lastQuarantineReason,
          lastTransientReason,
          stoppedOffline: false,
          stoppedTransient: true,
        }
      }
      quarantineOfflineAnswer(command, error.message)
      quarantined += 1
      lastQuarantineReason = error.message
    }
    remaining = remaining.filter(
      (item) => item.command.idempotencyKey !== command.command.idempotencyKey
    )
    window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining))
  }
  return {
    applied,
    quarantined,
    lastQuarantineReason,
    lastTransientReason,
    stoppedOffline: false,
    stoppedTransient: false,
  }
}

export const REMOTE_SCOUT_DATA_ENDPOINTS = [
  "/api/learning",
  "/api/calibration",
  "/api/diagnostic",
  "/api/exam-lab",
  "/api/study-plan",
  "/api/scout/ask",
] as const

export async function deleteRemoteScoutData(
  request: typeof fetch = fetch
): Promise<void> {
  const responses = await Promise.all(
    REMOTE_SCOUT_DATA_ENDPOINTS.map(async (url) => ({
      url,
      response: await request(url, { method: "DELETE" }),
    }))
  )
  const failed = responses.filter(({ response }) => !response.ok)
  if (failed.length) {
    throw new Error(
      `Deletion stopped because ${failed.map(({ url }) => url).join(", ")} did not confirm removal. No local data was cleared.`
    )
  }
}
