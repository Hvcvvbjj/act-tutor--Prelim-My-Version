import "server-only"

import { join } from "node:path"

import type { DiagnosticSkillResult } from "@act-tutor/core"
import type { JsonDocumentStore } from "@act-tutor/server"
import { pbkdf2 } from "@noble/hashes/pbkdf2"
import { sha256 as sha256Hash } from "@noble/hashes/sha256"
import { cookies } from "next/headers"
import type { NextRequest, NextResponse } from "next/server"

import type {
  AssessmentHistoryEntry,
  PlacementDraft,
  TutorJourney,
} from "@/components/tutor/types"
import {
  DEFAULT_LESSON_REMINDER_PREFERENCES,
  GUEST_VIEWER,
  type AuthViewer,
  type LessonReminderPreferences,
  type PendingTutorSetup,
  type SavedTutorPlan,
} from "@/lib/auth-types"
import { sessionDocumentStore } from "@/lib/session-document-store.server"

export const AUTH_COOKIE = "scout_auth_session"

export const APP_SESSION_COOKIES = {
  learning: "ai_act_learning_session",
  calibration: "ai_act_calibration_session",
  diagnostic: "ai_act_diag_session",
  scout: "ai_act_scout_session",
  studyPlan: "scout_study_plan_session",
  examLab: "scout_exam_lab_session",
} as const

export type LinkedSessionKind = keyof typeof APP_SESSION_COOKIES

type LinkedSessions = Partial<Record<LinkedSessionKind, string>>

interface PasswordRecord {
  algorithm: "pbkdf2-sha256"
  iterations: number
  salt: string
  digest: string
}

interface StoredReminderDelivery {
  status: "claimed" | "sent"
  claimToken: string
  claimedAt: string
  sentAt: string | null
}

interface StoredAccount {
  id: string
  username: string
  normalizedUsername: string
  displayName: string
  password: PasswordRecord
  linkedSessions: LinkedSessions
  savedPlan: SavedTutorPlan | null
  pendingSetup?: PendingTutorSetup | null
  lessonReminders?: LessonReminderPreferences
  reminderDeliveries?: Record<string, StoredReminderDelivery>
  createdAt: string
  updatedAt: string
}

interface StoredAuthSession {
  tokenHash: string
  accountId: string | null
  role: "learner" | "judge"
  username: string
  displayName: string
  createdAt: string
  expiresAt: string
}

interface LoginAttempt {
  failures: number
  windowStartedAt: string
  lockedUntil: string | null
}

interface AuthStoreFile {
  version: 1
  accounts: Record<string, StoredAccount>
  usernames: Record<string, string>
  sessions: Record<string, StoredAuthSession>
  attempts: Record<string, LoginAttempt>
}

interface AuthSuccess {
  viewer: AuthViewer
  token: string
  linkedSessions: LinkedSessions
}

export interface LessonReminderSubscription {
  accountId: string
  displayName: string
  studyPlanSessionId: string | null
  preferences: LessonReminderPreferences
}

export interface LessonReminderDeliveryClaim {
  accountId: string
  deliveryKey: string
  claimToken: string
}

const EMPTY_STORE: AuthStoreFile = {
  version: 1,
  accounts: {},
  usernames: {},
  sessions: {},
  attempts: {},
}

// Cloudflare Workers support up to 100,000 PBKDF2 rounds in native WebCrypto.
// New password records use that fast native path; older 310,000-round records
// remain readable through the portable fallback below.
const PASSWORD_ITERATIONS = 100_000
const LEARNER_SESSION_SECONDS = 60 * 60 * 24 * 30
const JUDGE_SESSION_SECONDS = 60 * 60 * 12
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const ATTEMPT_LIMIT = 5
// A crashed provider request keeps its claim for the rest of the daily cron
// window. This favors not sending a duplicate reminder over an immediate retry.
const REMINDER_CLAIM_TTL_MS = 24 * 60 * 60 * 1000
const MAX_REMINDER_DELIVERY_RECORDS = 256
const REMINDER_DELIVERY_KEY_PATTERN =
  /^reminder:v1:(upcoming|overdue):\d{4}-\d{2}-\d{2}:(email|sms)$/
const queues = new Map<string, Promise<void>>()
const encoder = new TextEncoder()

let cachedStore:
  { path: string; store: ReturnType<typeof sessionDocumentStore> } | undefined

function getAuthStore() {
  const path =
    process.env.SCOUT_AUTH_STORE_PATH ??
    join(process.cwd(), ".data", "auth-accounts.json")
  if (!cachedStore || cachedStore.path !== path) {
    cachedStore = {
      path,
      store: sessionDocumentStore("auth-accounts", path),
    }
  }
  return cachedStore.store
}

export class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

function cloneGuestViewer(): AuthViewer {
  return {
    ...GUEST_VIEWER,
    lessonReminders: { ...GUEST_VIEWER.lessonReminders },
  }
}

function encodeBase64Url(value: Uint8Array) {
  return Buffer.from(value).toString("base64url")
}

function decodeBase64Url(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"))
}

function randomBytes(length: number) {
  const output = new Uint8Array(length)
  globalThis.crypto.getRandomValues(output)
  return output
}

function randomId() {
  return encodeBase64Url(randomBytes(24))
}

async function sha256(value: string) {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    encoder.encode(value)
  )
  return encodeBase64Url(new Uint8Array(digest))
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number
) {
  if (iterations <= 100_000) {
    const saltBuffer = salt.buffer.slice(
      salt.byteOffset,
      salt.byteOffset + salt.byteLength
    ) as ArrayBuffer
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    )
    const bits = await globalThis.crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: saltBuffer,
        iterations,
      },
      key,
      256
    )
    return new Uint8Array(bits)
  }

  // Preserve compatibility with password records created before the Worker
  // limit was accounted for.
  return pbkdf2(sha256Hash, encoder.encode(password), salt, {
    c: iterations,
    dkLen: 32,
  })
}

async function hashPassword(password: string): Promise<PasswordRecord> {
  const salt = randomBytes(18)
  const digest = await derivePassword(password, salt, PASSWORD_ITERATIONS)
  return {
    algorithm: "pbkdf2-sha256",
    iterations: PASSWORD_ITERATIONS,
    salt: encodeBase64Url(salt),
    digest: encodeBase64Url(digest),
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  let difference = left.length ^ right.length
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return difference === 0
}

async function verifyPassword(password: string, record: PasswordRecord) {
  if (
    record.algorithm !== "pbkdf2-sha256" ||
    !Number.isInteger(record.iterations) ||
    record.iterations < 100_000 ||
    record.iterations > 1_000_000
  ) {
    return false
  }
  try {
    const expected = decodeBase64Url(record.digest)
    const actual = await derivePassword(
      password,
      decodeBase64Url(record.salt),
      record.iterations
    )
    return constantTimeEqual(actual, expected)
  } catch {
    return false
  }
}

function normalizedUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function parseUsername(value: unknown) {
  const username = typeof value === "string" ? value.trim() : ""
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/.test(username)) {
    throw new AuthRequestError(
      "Use 3–32 letters, numbers, periods, dashes, or underscores.",
      400
    )
  }
  return username
}

function parseDisplayName(value: unknown) {
  const displayName = typeof value === "string" ? value.trim() : ""
  if (displayName.length < 1 || displayName.length > 60) {
    throw new AuthRequestError("Enter a name from 1–60 characters.", 400)
  }
  return displayName
}

function parseEmailAddress(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new AuthRequestError("Enter a valid reminder email address.", 400)
  }
  return email
}

function parsePhoneNumber(value: unknown) {
  const input = typeof value === "string" ? value.trim() : ""
  const phoneNumber = input.replace(/[\s().-]/g, "")
  if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
    throw new AuthRequestError(
      "Enter a phone number with country code, such as +1 312 555 0198.",
      400
    )
  }
  return phoneNumber
}

function parseLessonReminderPreferences(
  value: unknown,
  previous: LessonReminderPreferences | null = null
): LessonReminderPreferences {
  if (value === undefined || value === null) {
    return { ...DEFAULT_LESSON_REMINDER_PREFERENCES }
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new AuthRequestError("The lesson reminder choices are invalid.", 400)
  }
  const input = value as Record<string, unknown>
  if (typeof input.enabled !== "boolean") {
    throw new AuthRequestError("Choose whether to use lesson reminders.", 400)
  }
  const now = new Date().toISOString()
  if (!input.enabled) {
    return {
      ...DEFAULT_LESSON_REMINDER_PREFERENCES,
      updatedAt: now,
    }
  }
  if (
    typeof input.emailEnabled !== "boolean" ||
    typeof input.smsEnabled !== "boolean" ||
    (!input.emailEnabled && !input.smsEnabled)
  ) {
    throw new AuthRequestError(
      "Choose email, text message, or both for lesson reminders.",
      400
    )
  }
  if (
    input.upcomingTiming !== "same-day" &&
    input.upcomingTiming !== "one-day-before" &&
    input.upcomingTiming !== "two-days-before"
  ) {
    throw new AuthRequestError(
      "Choose when upcoming lesson reminders should arrive.",
      400
    )
  }
  if (
    input.overdueTiming !== "same-day" &&
    input.overdueTiming !== "one-day-after" &&
    input.overdueTiming !== "three-days-after"
  ) {
    throw new AuthRequestError(
      "Choose when overdue lesson reminders should arrive.",
      400
    )
  }
  const emailEnabled = input.emailEnabled
  const smsEnabled = input.smsEnabled
  return {
    version: 1,
    enabled: true,
    emailEnabled,
    emailAddress: emailEnabled ? parseEmailAddress(input.emailAddress) : null,
    smsEnabled,
    phoneNumber: smsEnabled ? parsePhoneNumber(input.phoneNumber) : null,
    upcomingTiming: input.upcomingTiming,
    overdueTiming: input.overdueTiming,
    consentedAt:
      previous?.enabled && previous.consentedAt ? previous.consentedAt : now,
    updatedAt: now,
  }
}

function parsePassword(value: unknown, enforceStrength: boolean) {
  const password = typeof value === "string" ? value : ""
  if (password.length > 128) {
    throw new AuthRequestError("Password must be 128 characters or fewer.", 400)
  }
  if (
    enforceStrength &&
    (password.length < 12 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password))
  ) {
    throw new AuthRequestError(
      "Use at least 12 characters with a letter, number, and symbol.",
      400
    )
  }
  if (!password) {
    throw new AuthRequestError("Enter your password.", 400)
  }
  return password
}

function score(value: unknown, label: string) {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 36) {
    throw new AuthRequestError(`${label} must be from 1–36.`, 400)
  }
  return Number(value)
}

function nullableScore(value: unknown, label: string) {
  return value === null ? null : score(value, label)
}

function draftScore(value: unknown, label: string, required: boolean) {
  if (!required && value === 0) return 0
  return score(value, label)
}

function sectionScores(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthRequestError(`${label} is incomplete.`, 400)
  }
  const input = value as Record<string, unknown>
  return {
    english: score(input.english, `${label} English`),
    math: score(input.math, `${label} Math`),
    reading: score(input.reading, `${label} Reading`),
  }
}

function nullableSectionScores(value: unknown, label: string) {
  return value === null ? null : sectionScores(value, label)
}

function diagnosticSkillResults(value: unknown): DiagnosticSkillResult[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new AuthRequestError("The saved skill profile is invalid.", 400)
  }
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AuthRequestError("The saved skill profile is invalid.", 400)
    }
    const result = item as Record<string, unknown>
    if (
      typeof result.skill !== "string" ||
      typeof result.label !== "string" ||
      (result.section !== "english" &&
        result.section !== "math" &&
        result.section !== "reading") ||
      !Number.isInteger(result.correct) ||
      !Number.isInteger(result.total) ||
      Number(result.correct) < 0 ||
      Number(result.total) < 0 ||
      Number(result.correct) > Number(result.total) ||
      typeof result.accuracy !== "number" ||
      !Number.isFinite(result.accuracy) ||
      Number(result.accuracy) < 0 ||
      Number(result.accuracy) > 1 ||
      (result.signal !== "strength" &&
        result.signal !== "developing" &&
        result.signal !== "focus")
    ) {
      throw new AuthRequestError("The saved skill profile is invalid.", 400)
    }
    return {
      skill: result.skill,
      label: result.label,
      section: result.section,
      correct: Number(result.correct),
      total: Number(result.total),
      accuracy: Number(result.accuracy),
      signal: result.signal,
    }
  })
}

function assessmentHistory(value: unknown): AssessmentHistoryEntry[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 64) {
    throw new AuthRequestError("The saved assessment history is invalid.", 400)
  }
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AuthRequestError(
        "The saved assessment history is invalid.",
        400
      )
    }
    const entry = item as Record<string, unknown>
    if (
      typeof entry.id !== "string" ||
      entry.id.length < 4 ||
      entry.id.length > 180 ||
      (entry.kind !== "diagnostic" && entry.kind !== "full-test") ||
      typeof entry.title !== "string" ||
      entry.title.length < 2 ||
      entry.title.length > 120 ||
      typeof entry.completedAt !== "string" ||
      Number.isNaN(Date.parse(entry.completedAt)) ||
      !Number.isInteger(entry.correct) ||
      !Number.isInteger(entry.total) ||
      Number(entry.correct) < 0 ||
      Number(entry.total) < 1 ||
      Number(entry.correct) > Number(entry.total) ||
      !Array.isArray(entry.mistakes) ||
      entry.mistakes.length > 80
    ) {
      throw new AuthRequestError(
        "The saved assessment history is invalid.",
        400
      )
    }
    const mistakes = entry.mistakes.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new AuthRequestError(
          "A saved assessment mistake is invalid.",
          400
        )
      }
      const mistake = item as Record<string, unknown>
      const textFields = [
        ["id", 180],
        ["questionId", 180],
        ["skill", 120],
        ["skillLabel", 160],
        ["prompt", 4_000],
        ["selectedChoiceText", 2_000],
        ["correctChoiceText", 2_000],
        ["rationale", 6_000],
      ] as const
      if (
        (mistake.section !== "english" &&
          mistake.section !== "math" &&
          mistake.section !== "reading") ||
        textFields.some(
          ([field, max]) =>
            typeof mistake[field] !== "string" ||
            String(mistake[field]).length < 1 ||
            String(mistake[field]).length > max
        )
      ) {
        throw new AuthRequestError(
          "A saved assessment mistake is invalid.",
          400
        )
      }
      return {
        id: String(mistake.id),
        questionId: String(mistake.questionId),
        section: mistake.section as "english" | "math" | "reading",
        skill: String(mistake.skill),
        skillLabel: String(mistake.skillLabel),
        prompt: String(mistake.prompt),
        selectedChoiceText: String(mistake.selectedChoiceText),
        correctChoiceText: String(mistake.correctChoiceText),
        rationale: String(mistake.rationale),
      }
    })
    return {
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      completedAt: entry.completedAt,
      correct: Number(entry.correct),
      total: Number(entry.total),
      compositeScore: score(entry.compositeScore, "Assessment Composite"),
      sectionScores: sectionScores(
        entry.sectionScores,
        "Assessment section scores"
      ),
      mistakes,
    }
  })
}

function defaultTutorJourney(): TutorJourney {
  return {
    version: 1 as const,
    tourVersion: 1 as const,
    onboardingCompleted: true,
    lessonEntryChoice: null,
    officialScoreHistory: [],
    pendingOfficialScores: [],
    baselineOfficialComposite: null,
    checkInSnoozedUntil: null,
    doneForNow: false,
  }
}

function parseTutorJourney(value: unknown): TutorJourney {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthRequestError("The saved learning journey is invalid.", 400)
  }
  const journey = value as Record<string, unknown>
  if (
    journey.version !== 1 ||
    journey.tourVersion !== 1 ||
    typeof journey.onboardingCompleted !== "boolean" ||
    (journey.lessonEntryChoice !== null &&
      journey.lessonEntryChoice !== "explain-types" &&
      journey.lessonEntryChoice !== "start-lessons") ||
    !Array.isArray(journey.officialScoreHistory) ||
    (journey.pendingOfficialScores !== undefined &&
      !Array.isArray(journey.pendingOfficialScores)) ||
    (journey.baselineOfficialComposite !== undefined &&
      journey.baselineOfficialComposite !== null &&
      (!Number.isInteger(journey.baselineOfficialComposite) ||
        Number(journey.baselineOfficialComposite) < 1 ||
        Number(journey.baselineOfficialComposite) > 36)) ||
    (journey.checkInSnoozedUntil !== null &&
      (typeof journey.checkInSnoozedUntil !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(journey.checkInSnoozedUntil))) ||
    typeof journey.doneForNow !== "boolean"
  ) {
    throw new AuthRequestError("The saved learning journey is invalid.", 400)
  }
  const officialScoreHistory = journey.officialScoreHistory.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AuthRequestError("The saved score history is invalid.", 400)
    }
    const entry = item as Record<string, unknown>
    if (
      typeof entry.id !== "string" ||
      entry.id.length < 4 ||
      typeof entry.testDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.testDate) ||
      typeof entry.recordedAt !== "string" ||
      Number.isNaN(Date.parse(entry.recordedAt))
    ) {
      throw new AuthRequestError("The saved score history is invalid.", 400)
    }
    return {
      id: entry.id,
      testDate: entry.testDate,
      recordedAt: entry.recordedAt,
      composite: score(entry.composite, "Official Composite"),
      sections: nullableSectionScores(entry.sections, "Official scores"),
    }
  })
  const pendingOfficialScores = (
    (journey.pendingOfficialScores as unknown[] | undefined) ?? []
  ).map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AuthRequestError("The pending score check-in is invalid.", 400)
    }
    const entry = item as Record<string, unknown>
    if (
      typeof entry.testDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.testDate) ||
      typeof entry.recordedAt !== "string" ||
      Number.isNaN(Date.parse(entry.recordedAt)) ||
      typeof entry.nextPromptOn !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.nextPromptOn)
    ) {
      throw new AuthRequestError("The pending score check-in is invalid.", 400)
    }
    return {
      testDate: entry.testDate,
      recordedAt: entry.recordedAt,
      nextPromptOn: entry.nextPromptOn,
    }
  })
  return {
    version: 1 as const,
    tourVersion: 1 as const,
    onboardingCompleted: journey.onboardingCompleted,
    lessonEntryChoice: journey.lessonEntryChoice,
    officialScoreHistory,
    pendingOfficialScores,
    baselineOfficialComposite:
      journey.baselineOfficialComposite === undefined ||
      journey.baselineOfficialComposite === null
        ? null
        : Number(journey.baselineOfficialComposite),
    checkInSnoozedUntil: journey.checkInSnoozedUntil,
    doneForNow: journey.doneForNow,
  }
}

function parseDraft(
  value: unknown,
  options: { allowIncompleteScoreSetup?: boolean } = {}
): PlacementDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthRequestError("The plan setup is incomplete.", 400)
  }
  const draft = value as Record<string, unknown>
  const allowIncompleteScoreSetup = options.allowIncompleteScoreSetup === true
  if (
    draft.priorScoreChoice !== "scores" &&
    draft.priorScoreChoice !== "composite_only" &&
    draft.priorScoreChoice !== "never" &&
    (!allowIncompleteScoreSetup || draft.priorScoreChoice !== "undecided")
  ) {
    throw new AuthRequestError("The starting-score choice is invalid.", 400)
  }
  if (
    draft.startingCheckChoice !== "take" &&
    draft.startingCheckChoice !== "skip"
  ) {
    throw new AuthRequestError("The starting-check choice is invalid.", 400)
  }
  if (
    (draft.scoreSource !== undefined &&
      draft.scoreSource !== "official" &&
      draft.scoreSource !== "practice") ||
    typeof draft.testDate !== "string" ||
    (!/^\d{4}-\d{2}-\d{2}$/.test(draft.testDate) &&
      (!allowIncompleteScoreSetup || draft.testDate !== "")) ||
    !Number.isInteger(draft.studyDaysPerWeek) ||
    Number(draft.studyDaysPerWeek) < 1 ||
    Number(draft.studyDaysPerWeek) > 7 ||
    !Number.isInteger(draft.minutesPerSession) ||
    Number(draft.minutesPerSession) < 15 ||
    Number(draft.minutesPerSession) > 180 ||
    (draft.preferredSection !== "balanced" &&
      draft.preferredSection !== "english" &&
      draft.preferredSection !== "math" &&
      draft.preferredSection !== "reading") ||
    typeof draft.scienceEnabled !== "boolean"
  ) {
    throw new AuthRequestError("The plan setup is invalid.", 400)
  }
  return {
    goal: score(draft.goal, "Goal"),
    priorScoreChoice: draft.priorScoreChoice,
    scoreSource:
      draft.scoreSource === "official" ? "official" : ("practice" as const),
    startingCheckChoice: draft.startingCheckChoice,
    composite: draftScore(
      draft.composite,
      "Composite",
      !allowIncompleteScoreSetup && draft.priorScoreChoice !== "never"
    ),
    english: draftScore(
      draft.english,
      "English",
      !allowIncompleteScoreSetup && draft.priorScoreChoice === "scores"
    ),
    math: draftScore(
      draft.math,
      "Math",
      !allowIncompleteScoreSetup && draft.priorScoreChoice === "scores"
    ),
    reading: draftScore(
      draft.reading,
      "Reading",
      !allowIncompleteScoreSetup && draft.priorScoreChoice === "scores"
    ),
    scienceEnabled: draft.scienceEnabled,
    science: draftScore(
      draft.science,
      "Science",
      !allowIncompleteScoreSetup && draft.scienceEnabled
    ),
    testDate: draft.testDate,
    studyDaysPerWeek: Number(draft.studyDaysPerWeek),
    minutesPerSession: Number(draft.minutesPerSession),
    preferredSection: draft.preferredSection,
  }
}

export function parseSavedTutorPlan(value: unknown): SavedTutorPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthRequestError("The saved plan is incomplete.", 400)
  }
  const input = value as Record<string, unknown>
  if (input.version !== 1 && input.version !== 2) {
    throw new AuthRequestError("The saved plan version is not supported.", 400)
  }
  const evidence =
    input.evidence &&
    typeof input.evidence === "object" &&
    !Array.isArray(input.evidence)
      ? (input.evidence as Record<string, unknown>)
      : null
  if (
    !evidence ||
    (evidence.source !== "not_taken" &&
      evidence.source !== "composite_only" &&
      evidence.source !== "section_scores" &&
      evidence.source !== "starter_diagnostic" &&
      evidence.source !== "rapid_diagnostic" &&
      evidence.source !== "full_test") ||
    (evidence.confidence !== "none" &&
      evidence.confidence !== "low" &&
      evidence.confidence !== "medium") ||
    (evidence.compositeDifference !== null &&
      !Number.isFinite(evidence.compositeDifference))
  ) {
    throw new AuthRequestError("The saved score evidence is invalid.", 400)
  }
  const planningBaseline = nullableSectionScores(
    evidence.planningBaseline,
    "Planning baseline"
  )
  if (!planningBaseline) {
    throw new AuthRequestError("The saved plan needs a starting point.", 400)
  }
  const profileSource = input.profileSource
  if (
    profileSource !== undefined &&
    profileSource !== "quick-check" &&
    profileSource !== "diagnostic" &&
    profileSource !== "full-test"
  ) {
    throw new AuthRequestError(
      "The saved skill-profile source is invalid.",
      400
    )
  }
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    draft: parseDraft(input.draft),
    evidence: {
      source: evidence.source,
      reportedComposite: nullableScore(
        evidence.reportedComposite,
        "Reported Composite"
      ),
      calculatedComposite: nullableScore(
        evidence.calculatedComposite,
        "Calculated Composite"
      ),
      reportedSections: nullableSectionScores(
        evidence.reportedSections,
        "Reported scores"
      ),
      planningBaseline,
      science: nullableScore(evidence.science, "Science"),
      confidence: evidence.confidence,
      compositeDifference:
        evidence.compositeDifference === null
          ? null
          : Number(evidence.compositeDifference),
    },
    currentComposite: score(input.currentComposite, "Current Composite"),
    profileSkillResults:
      input.version === 2
        ? diagnosticSkillResults(input.profileSkillResults)
        : [],
    ...(typeof profileSource === "string" ? { profileSource } : {}),
    assessmentHistory:
      input.version === 2 ? assessmentHistory(input.assessmentHistory) : [],
    journey:
      input.version === 2
        ? parseTutorJourney(input.journey)
        : defaultTutorJourney(),
    adaptiveBaselineRequired: input.adaptiveBaselineRequired === true,
    baselineSkipped: input.baselineSkipped === true,
  }
}

export function parsePendingTutorSetup(value: unknown): PendingTutorSetup {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthRequestError("The saved setup is incomplete.", 400)
  }
  const input = value as Record<string, unknown>
  if (input.version !== 1 || input.diagnosticPurpose !== "baseline") {
    throw new AuthRequestError("The saved setup version is not supported.", 400)
  }
  const resumeSurface =
    input.resumeSurface === undefined || input.resumeSurface === "diagnostic"
      ? "diagnostic"
      : input.resumeSurface === "onboarding"
        ? "onboarding"
        : null
  const onboardingStep =
    input.onboardingStep === 1 ||
    input.onboardingStep === 2 ||
    input.onboardingStep === 3
      ? input.onboardingStep
      : resumeSurface === "diagnostic"
        ? 3
        : null
  if (!resumeSurface || !onboardingStep) {
    throw new AuthRequestError("The saved setup destination is invalid.", 400)
  }
  const draft = parseDraft(input.draft, {
    allowIncompleteScoreSetup: resumeSurface === "onboarding",
  })
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    draft: {
      ...draft,
      startingCheckChoice:
        resumeSurface === "diagnostic" ? "take" : draft.startingCheckChoice,
    },
    diagnosticPurpose: "baseline",
    resumeSurface,
    onboardingStep,
  }
}

function validateStore(value: unknown): AuthStoreFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Unsupported account store format.")
  }
  const store = value as Partial<AuthStoreFile>
  if (
    store.version !== 1 ||
    !store.accounts ||
    !store.usernames ||
    !store.sessions ||
    !store.attempts
  ) {
    throw new Error("Unsupported account store format.")
  }
  return store as AuthStoreFile
}

async function readStore(store: JsonDocumentStore) {
  const value = await store.read()
  return value === null ? structuredClone(EMPTY_STORE) : validateStore(value)
}

async function transact<T>(
  store: JsonDocumentStore,
  operation: (value: AuthStoreFile) => Promise<T> | T
) {
  const previous = queues.get(store.key) ?? Promise.resolve()
  let release: () => void = () => {}
  const current = new Promise<void>((resolve) => {
    release = resolve
  })
  const tail = previous.then(() => current)
  queues.set(store.key, tail)
  await previous
  try {
    const coordinatedStore = store as JsonDocumentStore & {
      runExclusive?: <Result>(
        coordinatedOperation: () => Promise<Result>
      ) => Promise<Result>
    }
    const execute = async () => operation(await readStore(store))
    return coordinatedStore.runExclusive
      ? await coordinatedStore.runExclusive(execute)
      : await execute()
  } finally {
    release()
    if (queues.get(store.key) === tail) queues.delete(store.key)
  }
}

function removeExpired(store: AuthStoreFile, now: number) {
  for (const [tokenHash, session] of Object.entries(store.sessions)) {
    if (Date.parse(session.expiresAt) <= now) delete store.sessions[tokenHash]
  }
  for (const [username, attempt] of Object.entries(store.attempts)) {
    const lockEnded =
      attempt.lockedUntil === null || Date.parse(attempt.lockedUntil) <= now
    if (
      lockEnded &&
      now - Date.parse(attempt.windowStartedAt) > ATTEMPT_WINDOW_MS
    ) {
      delete store.attempts[username]
    }
  }
}

function viewerFor(
  session: StoredAuthSession,
  account: StoredAccount | null
): AuthViewer {
  return {
    authenticated: true,
    role: session.role,
    username: session.username,
    displayName: session.displayName,
    technicalDetails: session.role === "judge",
    savedPlan: account?.savedPlan ?? null,
    pendingSetup: account?.pendingSetup ?? null,
    lessonReminders: account?.lessonReminders
      ? { ...account.lessonReminders }
      : { ...DEFAULT_LESSON_REMINDER_PREFERENCES },
  }
}

function linkedSessionsFromRequest(request: NextRequest): LinkedSessions {
  const output: LinkedSessions = {}
  for (const [kind, cookieName] of Object.entries(APP_SESSION_COOKIES) as Array<
    [LinkedSessionKind, string]
  >) {
    const sessionId = request.cookies.get(cookieName)?.value
    if (sessionId) output[kind] = sessionId
  }
  return output
}

function developerCredentials() {
  const usingDeveloperAliases = Boolean(
    process.env.SCOUT_DEV_USERNAME ||
    process.env.SCOUT_DEV_PASSWORD ||
    process.env.SCOUT_DEV_PASSWORD_HASH
  )
  const username =
    (usingDeveloperAliases
      ? process.env.SCOUT_DEV_USERNAME
      : process.env.SCOUT_JUDGE_USERNAME
    )?.trim() ?? ""
  const password =
    (usingDeveloperAliases
      ? process.env.SCOUT_DEV_PASSWORD
      : process.env.SCOUT_JUDGE_PASSWORD) ?? ""
  const passwordHash =
    (usingDeveloperAliases
      ? process.env.SCOUT_DEV_PASSWORD_HASH
      : process.env.SCOUT_JUDGE_PASSWORD_HASH
    )?.trim() ?? ""
  return {
    username,
    normalizedUsername: normalizedUsername(username),
    password,
    passwordHash,
    configured:
      Boolean(username) &&
      (Boolean(passwordHash) ||
        (process.env.NODE_ENV !== "production" && Boolean(password))),
  }
}

function parsePasswordRecord(value: string): PasswordRecord | null {
  const separator = value.includes(":") ? ":" : "$"
  const parts = value.split(separator)
  if (parts.length !== 4) return null
  const [algorithm, iterations, salt, digest] = parts
  if (
    algorithm !== "pbkdf2-sha256" ||
    !iterations ||
    !salt ||
    !digest ||
    !Number.isInteger(Number(iterations))
  ) {
    return null
  }
  return {
    algorithm,
    iterations: Number(iterations),
    salt,
    digest,
  }
}

async function developerPasswordMatches(password: string) {
  const developer = developerCredentials()
  if (!developer.configured) return false
  if (developer.passwordHash) {
    const record = parsePasswordRecord(developer.passwordHash)
    return record ? verifyPassword(password, record) : false
  }
  return constantTimeEqual(
    encoder.encode(password),
    encoder.encode(developer.password)
  )
}

function registerFailure(store: AuthStoreFile, username: string, now: number) {
  const existing = store.attempts[username]
  const withinWindow =
    existing && now - Date.parse(existing.windowStartedAt) <= ATTEMPT_WINDOW_MS
  const failures = withinWindow ? existing.failures + 1 : 1
  store.attempts[username] = {
    failures,
    windowStartedAt: withinWindow
      ? existing.windowStartedAt
      : new Date(now).toISOString(),
    lockedUntil:
      failures >= ATTEMPT_LIMIT
        ? new Date(now + ATTEMPT_WINDOW_MS).toISOString()
        : null,
  }
}

function assertNotLocked(store: AuthStoreFile, username: string, now: number) {
  const attempt = store.attempts[username]
  if (attempt?.lockedUntil && Date.parse(attempt.lockedUntil) > now) {
    throw new AuthRequestError(
      "Too many sign-in attempts. Try again in about 15 minutes.",
      429
    )
  }
}

async function createSession(
  store: AuthStoreFile,
  input: Omit<StoredAuthSession, "tokenHash" | "createdAt" | "expiresAt">
) {
  const token = randomId()
  const tokenHash = await sha256(token)
  const now = Date.now()
  const maxAge =
    input.role === "judge" ? JUDGE_SESSION_SECONDS : LEARNER_SESSION_SECONDS
  store.sessions[tokenHash] = {
    ...input,
    tokenHash,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + maxAge * 1000).toISOString(),
  }
  return token
}

export async function registerLearner(
  request: NextRequest,
  input: {
    username: unknown
    displayName: unknown
    password: unknown
    savedPlan?: unknown
    pendingSetup?: unknown
    lessonReminders?: unknown
  }
): Promise<AuthSuccess> {
  const username = parseUsername(input.username)
  const normalized = normalizedUsername(username)
  const displayName = parseDisplayName(input.displayName)
  const password = parsePassword(input.password, true)
  const savedPlan =
    input.savedPlan === undefined || input.savedPlan === null
      ? null
      : parseSavedTutorPlan(input.savedPlan)
  const pendingSetup =
    input.pendingSetup === undefined || input.pendingSetup === null
      ? null
      : parsePendingTutorSetup(input.pendingSetup)
  const lessonReminders = parseLessonReminderPreferences(input.lessonReminders)
  if (savedPlan && pendingSetup) {
    throw new AuthRequestError(
      "Save either a completed plan or a pending diagnostic setup.",
      400
    )
  }
  const linkedSessions = linkedSessionsFromRequest(request)
  const developer = developerCredentials()
  const documentStore = getAuthStore()
  const currentStore = await readStore(documentStore)
  if (
    currentStore.usernames[normalized] ||
    (developer.username && normalized === developer.normalizedUsername)
  ) {
    throw new AuthRequestError(
      "That username is already in use. Try another.",
      409
    )
  }
  const passwordRecord = await hashPassword(password)

  return transact(documentStore, async (store) => {
    removeExpired(store, Date.now())
    if (
      store.usernames[normalized] ||
      (developer.username && normalized === developer.normalizedUsername)
    ) {
      throw new AuthRequestError(
        "That username is already in use. Try another.",
        409
      )
    }
    const now = new Date().toISOString()
    const id = randomId()
    const account: StoredAccount = {
      id,
      username,
      normalizedUsername: normalized,
      displayName,
      password: passwordRecord,
      linkedSessions,
      savedPlan,
      pendingSetup,
      lessonReminders,
      createdAt: now,
      updatedAt: now,
    }
    store.accounts[id] = account
    store.usernames[normalized] = id
    const token = await createSession(store, {
      accountId: id,
      role: "learner",
      username,
      displayName,
    })
    await documentStore.write(store)
    return {
      token,
      linkedSessions,
      viewer: viewerFor(store.sessions[await sha256(token)], account),
    }
  })
}

export async function signIn(
  input: {
    username: unknown
    password: unknown
    pendingSetup?: unknown
  },
  request: NextRequest
): Promise<AuthSuccess> {
  const username = parseUsername(input.username)
  const normalized = normalizedUsername(username)
  const password = parsePassword(input.password, false)
  const developer = developerCredentials()

  const documentStore = getAuthStore()
  return transact(documentStore, async (store) => {
    const now = Date.now()
    removeExpired(store, now)
    assertNotLocked(store, normalized, now)

    if (
      developer.configured &&
      normalized === developer.normalizedUsername &&
      (await developerPasswordMatches(password))
    ) {
      delete store.attempts[normalized]
      const token = await createSession(store, {
        accountId: null,
        role: "judge",
        username: developer.username,
        displayName: "AlexACT developer",
      })
      await documentStore.write(store)
      return {
        token,
        linkedSessions: {},
        viewer: {
          authenticated: true,
          role: "judge",
          username: developer.username,
          displayName: "AlexACT developer",
          technicalDetails: true,
          savedPlan: null,
          pendingSetup: null,
          lessonReminders: { ...DEFAULT_LESSON_REMINDER_PREFERENCES },
        },
      }
    }

    const accountId = store.usernames[normalized]
    const account = accountId ? store.accounts[accountId] : undefined
    const valid =
      account !== undefined &&
      (await verifyPassword(password, account.password))
    if (!valid || !account) {
      registerFailure(store, normalized, now)
      await documentStore.write(store)
      throw new AuthRequestError("Username or password is incorrect.", 401)
    }

    delete store.attempts[normalized]
    if (
      !account.savedPlan &&
      !account.pendingSetup &&
      input.pendingSetup !== undefined &&
      input.pendingSetup !== null
    ) {
      account.pendingSetup = parsePendingTutorSetup(input.pendingSetup)
      account.updatedAt = new Date(now).toISOString()
    }
    const currentSessions = linkedSessionsFromRequest(request)
    if (
      Object.keys(account.linkedSessions).length === 0 &&
      Object.keys(currentSessions).length > 0
    ) {
      account.linkedSessions = currentSessions
      account.updatedAt = new Date(now).toISOString()
    }
    const token = await createSession(store, {
      accountId: account.id,
      role: "learner",
      username: account.username,
      displayName: account.displayName,
    })
    await documentStore.write(store)
    return {
      token,
      linkedSessions: account.linkedSessions,
      viewer: viewerFor(store.sessions[await sha256(token)], account),
    }
  })
}

export async function viewerForToken(token: string | undefined) {
  if (!token) return cloneGuestViewer()
  const tokenHash = await sha256(token)
  const documentStore = getAuthStore()
  return transact(documentStore, async (store) => {
    const now = Date.now()
    removeExpired(store, now)
    const session = store.sessions[tokenHash]
    if (!session) {
      await documentStore.write(store)
      return cloneGuestViewer()
    }
    const account = session.accountId
      ? (store.accounts[session.accountId] ?? null)
      : null
    if (session.role === "learner" && !account) {
      delete store.sessions[tokenHash]
      await documentStore.write(store)
      return cloneGuestViewer()
    }
    return viewerFor(session, account)
  })
}

export async function viewerForRequest(request: NextRequest) {
  return viewerForToken(request.cookies.get(AUTH_COOKIE)?.value)
}

export async function currentAuthViewer() {
  const cookieStore = await cookies()
  return viewerForToken(cookieStore.get(AUTH_COOKIE)?.value)
}

export async function saveAccountPlan(
  request: NextRequest,
  value: unknown
): Promise<AuthViewer> {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) throw new AuthRequestError("Sign in to save this plan.", 401)
  const tokenHash = await sha256(token)
  const savedPlan = parseSavedTutorPlan(value)
  const documentStore = getAuthStore()
  return transact(documentStore, async (store) => {
    removeExpired(store, Date.now())
    const session = store.sessions[tokenHash]
    const account =
      session?.role === "learner" && session.accountId
        ? store.accounts[session.accountId]
        : undefined
    if (!session || !account) {
      throw new AuthRequestError("Sign in to save this plan.", 401)
    }
    account.savedPlan = savedPlan
    account.pendingSetup = null
    account.linkedSessions = {
      ...account.linkedSessions,
      ...linkedSessionsFromRequest(request),
    }
    account.updatedAt = new Date().toISOString()
    await documentStore.write(store)
    return viewerFor(session, account)
  })
}

export async function savePendingTutorSetup(
  request: NextRequest,
  value: unknown
): Promise<AuthViewer> {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) throw new AuthRequestError("Sign in to save this setup.", 401)
  const tokenHash = await sha256(token)
  const pendingSetup = parsePendingTutorSetup(value)
  const documentStore = getAuthStore()
  return transact(documentStore, async (store) => {
    removeExpired(store, Date.now())
    const session = store.sessions[tokenHash]
    const account =
      session?.role === "learner" && session.accountId
        ? store.accounts[session.accountId]
        : undefined
    if (!session || !account) {
      throw new AuthRequestError("Sign in to save this setup.", 401)
    }
    account.pendingSetup = pendingSetup
    account.linkedSessions = {
      ...account.linkedSessions,
      ...linkedSessionsFromRequest(request),
    }
    account.updatedAt = new Date().toISOString()
    await documentStore.write(store)
    return viewerFor(session, account)
  })
}

export async function saveLessonReminderPreferences(
  request: NextRequest,
  value: unknown
): Promise<AuthViewer> {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) {
    throw new AuthRequestError(
      "Sign in to change lesson reminder preferences.",
      401
    )
  }
  const tokenHash = await sha256(token)
  const documentStore = getAuthStore()
  return transact(documentStore, async (store) => {
    removeExpired(store, Date.now())
    const session = store.sessions[tokenHash]
    const account =
      session?.role === "learner" && session.accountId
        ? store.accounts[session.accountId]
        : undefined
    if (!session || !account) {
      throw new AuthRequestError(
        "Sign in to change lesson reminder preferences.",
        401
      )
    }
    account.lessonReminders = parseLessonReminderPreferences(
      value,
      account.lessonReminders ?? null
    )
    if (!account.lessonReminders.enabled) {
      account.reminderDeliveries = {}
    }
    account.updatedAt = new Date().toISOString()
    await documentStore.write(store)
    return viewerFor(session, account)
  })
}

function parsedReminderDeliveryKey(deliveryKey: string) {
  const match = REMINDER_DELIVERY_KEY_PATTERN.exec(deliveryKey)
  if (!match) {
    throw new AuthRequestError("The reminder delivery key is invalid.", 400)
  }
  return {
    kind: match[1] as "upcoming" | "overdue",
    channel: match[2] as "email" | "sms",
  }
}

function prunedReminderDeliveries(
  deliveries: Record<string, StoredReminderDelivery>,
  reserve: number
) {
  return Object.fromEntries(
    Object.entries(deliveries)
      .toSorted(([, left], [, right]) =>
        (right.sentAt ?? right.claimedAt).localeCompare(
          left.sentAt ?? left.claimedAt
        )
      )
      .slice(0, Math.max(0, MAX_REMINDER_DELIVERY_RECORDS - reserve))
  )
}

export async function listLessonReminderSubscriptions(): Promise<
  LessonReminderSubscription[]
> {
  const documentStore = getAuthStore()
  return transact(documentStore, (store) =>
    Object.values(store.accounts)
      .filter((account) => account.lessonReminders?.enabled === true)
      .map((account) => ({
        accountId: account.id,
        displayName: account.displayName,
        studyPlanSessionId: account.linkedSessions.studyPlan ?? null,
        preferences: {
          ...(account.lessonReminders ?? DEFAULT_LESSON_REMINDER_PREFERENCES),
        },
      }))
      .toSorted((left, right) => left.accountId.localeCompare(right.accountId))
  )
}

export async function claimLessonReminderDelivery(
  accountId: string,
  deliveryKey: string,
  now = new Date().toISOString()
): Promise<LessonReminderDeliveryClaim | null> {
  const { channel } = parsedReminderDeliveryKey(deliveryKey)
  const nowMs = Date.parse(now)
  if (!accountId || Number.isNaN(nowMs)) {
    throw new AuthRequestError("The reminder delivery claim is invalid.", 400)
  }
  const documentStore = getAuthStore()
  return transact(documentStore, async (store) => {
    const account = store.accounts[accountId]
    const preferences = account?.lessonReminders
    const channelEnabled =
      channel === "email"
        ? preferences?.emailEnabled === true
        : preferences?.smsEnabled === true
    if (!account || !preferences?.enabled || !channelEnabled) return null

    const existing = account.reminderDeliveries?.[deliveryKey]
    if (existing?.status === "sent") return null
    if (
      existing?.status === "claimed" &&
      nowMs - Date.parse(existing.claimedAt) < REMINDER_CLAIM_TTL_MS
    ) {
      return null
    }

    const claimToken = randomId()
    account.reminderDeliveries = {
      ...prunedReminderDeliveries(account.reminderDeliveries ?? {}, 1),
      [deliveryKey]: {
        status: "claimed",
        claimToken,
        claimedAt: now,
        sentAt: null,
      },
    }
    account.updatedAt = now
    await documentStore.write(store)
    return { accountId, deliveryKey, claimToken }
  })
}

export async function completeLessonReminderDelivery(
  claim: LessonReminderDeliveryClaim,
  sentAt = new Date().toISOString()
) {
  parsedReminderDeliveryKey(claim.deliveryKey)
  if (
    !claim.accountId ||
    !claim.claimToken ||
    Number.isNaN(Date.parse(sentAt))
  ) {
    throw new AuthRequestError("The reminder delivery receipt is invalid.", 400)
  }
  const documentStore = getAuthStore()
  return transact(documentStore, async (store) => {
    const account = store.accounts[claim.accountId]
    const existing = account?.reminderDeliveries?.[claim.deliveryKey]
    if (
      !account ||
      existing?.status !== "claimed" ||
      existing.claimToken !== claim.claimToken
    ) {
      return false
    }
    account.reminderDeliveries = {
      ...account.reminderDeliveries,
      [claim.deliveryKey]: {
        ...existing,
        status: "sent",
        sentAt,
      },
    }
    account.updatedAt = sentAt
    await documentStore.write(store)
    return true
  })
}

export async function releaseLessonReminderDelivery(
  claim: LessonReminderDeliveryClaim
) {
  parsedReminderDeliveryKey(claim.deliveryKey)
  if (!claim.accountId || !claim.claimToken) {
    throw new AuthRequestError("The reminder delivery claim is invalid.", 400)
  }
  const documentStore = getAuthStore()
  return transact(documentStore, async (store) => {
    const account = store.accounts[claim.accountId]
    const existing = account?.reminderDeliveries?.[claim.deliveryKey]
    if (
      !account ||
      existing?.status !== "claimed" ||
      existing.claimToken !== claim.claimToken
    ) {
      return false
    }
    delete account.reminderDeliveries?.[claim.deliveryKey]
    account.updatedAt = new Date().toISOString()
    await documentStore.write(store)
    return true
  })
}

export async function deleteAccountSavedPlan(
  request: NextRequest
): Promise<AuthViewer> {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return cloneGuestViewer()
  const tokenHash = await sha256(token)
  const documentStore = getAuthStore()
  return transact(documentStore, async (store) => {
    removeExpired(store, Date.now())
    const session = store.sessions[tokenHash]
    if (!session) {
      throw new AuthRequestError(
        "Sign in again before deleting your saved plan.",
        401
      )
    }
    if (session.role !== "learner" || !session.accountId) {
      return viewerFor(session, null)
    }
    const account = store.accounts[session.accountId]
    if (!account) {
      throw new AuthRequestError(
        "Sign in again before deleting your saved plan.",
        401
      )
    }
    account.savedPlan = null
    account.pendingSetup = null
    account.updatedAt = new Date().toISOString()
    await documentStore.write(store)
    return viewerFor(session, account)
  })
}

export async function syncLinkedSession(
  request: NextRequest,
  kind: LinkedSessionKind,
  sessionId: string | null
) {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return
  const tokenHash = await sha256(token)
  const documentStore = getAuthStore()
  await transact(documentStore, async (store) => {
    removeExpired(store, Date.now())
    const session = store.sessions[tokenHash]
    const account =
      session?.role === "learner" && session.accountId
        ? store.accounts[session.accountId]
        : undefined
    if (!account) return
    if (sessionId) account.linkedSessions[kind] = sessionId
    else delete account.linkedSessions[kind]
    account.updatedAt = new Date().toISOString()
    await documentStore.write(store)
  })
}

export async function signOut(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return
  const tokenHash = await sha256(token)
  const documentStore = getAuthStore()
  await transact(documentStore, async (store) => {
    removeExpired(store, Date.now())
    const session = store.sessions[tokenHash]
    const account =
      session?.role === "learner" && session.accountId
        ? store.accounts[session.accountId]
        : undefined
    if (account) {
      account.linkedSessions = {
        ...account.linkedSessions,
        ...linkedSessionsFromRequest(request),
      }
      account.updatedAt = new Date().toISOString()
    }
    delete store.sessions[tokenHash]
    await documentStore.write(store)
  })
}

export async function requireJudge(request: NextRequest) {
  const viewer = await viewerForRequest(request)
  if (viewer.role !== "judge") {
    throw new AuthRequestError(
      "Developer mode is required for this demo control.",
      403
    )
  }
  return viewer
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
    priority: "high" as const,
  }
}

export function setAuthCookie(
  response: NextResponse,
  token: string,
  role: "learner" | "judge"
) {
  response.cookies.set(
    AUTH_COOKIE,
    token,
    cookieOptions(
      role === "judge" ? JUDGE_SESSION_SECONDS : LEARNER_SESSION_SECONDS
    )
  )
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.delete(AUTH_COOKIE)
  for (const cookieName of Object.values(APP_SESSION_COOKIES)) {
    response.cookies.delete(cookieName)
  }
}

export function applyLinkedSessionCookies(
  response: NextResponse,
  sessions: LinkedSessions
) {
  for (const cookieName of Object.values(APP_SESSION_COOKIES)) {
    response.cookies.delete(cookieName)
  }
  for (const [kind, sessionId] of Object.entries(sessions) as Array<
    [LinkedSessionKind, string]
  >) {
    response.cookies.set(
      APP_SESSION_COOKIES[kind],
      sessionId,
      cookieOptions(60 * 60 * 24 * 90)
    )
  }
}

export function assertSameOriginJson(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new AuthRequestError("Send this request as JSON.", 415)
  }
  const origin = request.headers.get("origin")
  if (origin) {
    const requestUrl = new URL(request.url)
    const forwardedHost = request.headers
      .get("x-forwarded-host")
      ?.split(",", 1)[0]
      ?.trim()
    const host = forwardedHost || request.headers.get("host")
    const forwardedProtocol = request.headers
      .get("x-forwarded-proto")
      ?.split(",", 1)[0]
      ?.trim()
      .replace(/:$/, "")
    const protocol = forwardedProtocol || requestUrl.protocol.replace(/:$/, "")
    const allowedOrigins = new Set([requestUrl.origin])

    if (host && (protocol === "http" || protocol === "https")) {
      allowedOrigins.add(`${protocol}://${host}`)
    }

    if (!allowedOrigins.has(origin)) {
      throw new AuthRequestError(
        "Cross-site account requests are blocked.",
        403
      )
    }
  }
  const fetchSite = request.headers.get("sec-fetch-site")
  if (fetchSite === "cross-site") {
    throw new AuthRequestError("Cross-site account requests are blocked.", 403)
  }
}
