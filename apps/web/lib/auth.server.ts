import "server-only"

import { join } from "node:path"

import type { JsonDocumentStore } from "@act-tutor/server"
import { cookies } from "next/headers"
import type { NextRequest, NextResponse } from "next/server"

import type { PlacementDraft } from "@/components/tutor/types"
import {
  GUEST_VIEWER,
  type AuthViewer,
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

interface StoredAccount {
  id: string
  username: string
  normalizedUsername: string
  displayName: string
  password: PasswordRecord
  linkedSessions: LinkedSessions
  savedPlan: SavedTutorPlan | null
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

const EMPTY_STORE: AuthStoreFile = {
  version: 1,
  accounts: {},
  usernames: {},
  sessions: {},
  attempts: {},
}

const PASSWORD_ITERATIONS = 310_000
const LEARNER_SESSION_SECONDS = 60 * 60 * 24 * 30
const JUDGE_SESSION_SECONDS = 60 * 60 * 12
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const ATTEMPT_LIMIT = 5
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
  return { ...GUEST_VIEWER }
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

function parseDraft(value: unknown): PlacementDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthRequestError("The plan setup is incomplete.", 400)
  }
  const draft = value as Record<string, unknown>
  if (
    draft.priorScoreChoice !== "scores" &&
    draft.priorScoreChoice !== "composite_only" &&
    draft.priorScoreChoice !== "never"
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
    typeof draft.testDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.testDate) ||
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
    startingCheckChoice: draft.startingCheckChoice,
    composite: score(draft.composite, "Composite"),
    english: score(draft.english, "English"),
    math: score(draft.math, "Math"),
    reading: score(draft.reading, "Reading"),
    scienceEnabled: draft.scienceEnabled,
    science: score(draft.science, "Science"),
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
      evidence.source !== "rapid_diagnostic") ||
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
  return {
    version: 1,
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
    adaptiveBaselineRequired: input.adaptiveBaselineRequired === true,
    baselineSkipped: input.baselineSkipped === true,
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
    return await operation(await readStore(store))
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

function judgeCredentials() {
  const username = process.env.SCOUT_JUDGE_USERNAME?.trim() ?? ""
  const password = process.env.SCOUT_JUDGE_PASSWORD ?? ""
  const passwordHash = process.env.SCOUT_JUDGE_PASSWORD_HASH?.trim() ?? ""
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

async function judgePasswordMatches(password: string) {
  const judge = judgeCredentials()
  if (!judge.configured) return false
  if (judge.passwordHash) {
    const record = parsePasswordRecord(judge.passwordHash)
    return record ? verifyPassword(password, record) : false
  }
  return constantTimeEqual(
    encoder.encode(password),
    encoder.encode(judge.password)
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
  const linkedSessions = linkedSessionsFromRequest(request)
  const judge = judgeCredentials()
  const passwordRecord = await hashPassword(password)

  const documentStore = getAuthStore()
  return transact(documentStore, async (store) => {
    removeExpired(store, Date.now())
    if (
      store.usernames[normalized] ||
      (judge.username && normalized === judge.normalizedUsername)
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
  input: { username: unknown; password: unknown },
  request: NextRequest
): Promise<AuthSuccess> {
  const username = parseUsername(input.username)
  const normalized = normalizedUsername(username)
  const password = parsePassword(input.password, false)
  const judge = judgeCredentials()

  const documentStore = getAuthStore()
  return transact(documentStore, async (store) => {
    const now = Date.now()
    removeExpired(store, now)
    assertNotLocked(store, normalized, now)

    if (
      judge.configured &&
      normalized === judge.normalizedUsername &&
      (await judgePasswordMatches(password))
    ) {
      delete store.attempts[normalized]
      const token = await createSession(store, {
        accountId: null,
        role: "judge",
        username: judge.username,
        displayName: "Hackathon judges",
      })
      await documentStore.write(store)
      return {
        token,
        linkedSessions: {},
        viewer: {
          authenticated: true,
          role: "judge",
          username: judge.username,
          displayName: "Hackathon judges",
          technicalDetails: true,
          savedPlan: null,
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
    account.linkedSessions = {
      ...account.linkedSessions,
      ...linkedSessionsFromRequest(request),
    }
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
      "Judge access is required for this demo control.",
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
