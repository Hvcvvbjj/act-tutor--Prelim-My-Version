import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { NextRequest } from "next/server"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { POST as calibrationPost } from "../calibration/route"
import { POST } from "./route"

let directory = ""
let authStorePath = ""

function authRequest(
  body: Record<string, unknown>,
  cookie = "",
  origin = "http://localhost"
) {
  return new NextRequest("http://localhost/api/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

const savedPlan = {
  version: 1,
  savedAt: "2000-01-01T00:00:00.000Z",
  draft: {
    goal: 30,
    priorScoreChoice: "never",
    startingCheckChoice: "skip",
    composite: 24,
    english: 24,
    math: 24,
    reading: 24,
    scienceEnabled: false,
    science: 24,
    testDate: "2026-09-12",
    studyDaysPerWeek: 3,
    minutesPerSession: 30,
    preferredSection: "balanced",
  },
  evidence: {
    source: "not_taken",
    reportedComposite: null,
    calculatedComposite: null,
    reportedSections: null,
    planningBaseline: { english: 18, math: 18, reading: 18 },
    science: null,
    confidence: "none",
    compositeDifference: null,
  },
  currentComposite: 18,
  adaptiveBaselineRequired: false,
  baselineSkipped: true,
}

describe.sequential("optional learner and judge accounts", () => {
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "scout-auth-test-"))
    authStorePath = join(directory, "accounts.json")
    process.env.SCOUT_AUTH_STORE_PATH = authStorePath
    process.env.SCOUT_JUDGE_USERNAME = "scout-judge-test"
    process.env.SCOUT_JUDGE_PASSWORD_HASH =
      "pbkdf2-sha256:310000:A28OWvHb6t7LhElS4iF4UA3M:NwpwGKJc86nkDDWOLhzYmFkdGuQv33OAt8zEYJQiHD4"
  })

  afterAll(async () => {
    delete process.env.SCOUT_AUTH_STORE_PATH
    delete process.env.SCOUT_JUDGE_USERNAME
    delete process.env.SCOUT_JUDGE_PASSWORD_HASH
    await rm(directory, { recursive: true, force: true })
  })

  it("creates a real learner account without storing the readable password", async () => {
    const response = await POST(
      authRequest(
        {
          action: "signup",
          username: "learner-one",
          displayName: "Learner One",
          password: "StudyStrong!2026",
          savedPlan,
        },
        "ai_act_learning_session=learning-session-one"
      )
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      viewer: {
        authenticated: true,
        role: "learner",
        username: "learner-one",
        displayName: "Learner One",
        technicalDetails: false,
        savedPlan: {
          currentComposite: 18,
          baselineSkipped: true,
        },
      },
    })
    expect(response.cookies.get("scout_auth_session")?.value).toBeTruthy()

    const stored = await readFile(authStorePath, "utf8")
    expect(stored).not.toContain("StudyStrong!2026")
    expect(stored).toContain("pbkdf2-sha256")
  })

  it("restores linked progress after a learner signs out and back in", async () => {
    const firstLogin = await POST(
      authRequest({
        action: "login",
        username: "learner-one",
        password: "StudyStrong!2026",
      })
    )
    const token = firstLogin.cookies.get("scout_auth_session")?.value
    expect(token).toBeTruthy()

    const logout = await POST(
      authRequest(
        { action: "logout" },
        `scout_auth_session=${token}; ai_act_learning_session=learning-session-two`
      )
    )
    expect(logout.status).toBe(200)

    const restored = await POST(
      authRequest({
        action: "login",
        username: "learner-one",
        password: "StudyStrong!2026",
      })
    )
    expect(restored.status).toBe(200)
    expect(restored.cookies.get("ai_act_learning_session")?.value).toBe(
      "learning-session-two"
    )
    await expect(restored.json()).resolves.toMatchObject({
      viewer: {
        role: "learner",
        technicalDetails: false,
        savedPlan: { baselineSkipped: true },
      },
    })
  })

  it("keeps login failures generic and blocks cross-site account posts", async () => {
    const invalid = await POST(
      authRequest({
        action: "login",
        username: "learner-one",
        password: "WrongPassword!2026",
      })
    )
    expect(invalid.status).toBe(401)
    await expect(invalid.json()).resolves.toEqual({
      error: "Username or password is incorrect.",
    })

    const crossSite = await POST(
      authRequest(
        {
          action: "login",
          username: "learner-one",
          password: "StudyStrong!2026",
        },
        "",
        "https://attacker.example"
      )
    )
    expect(crossSite.status).toBe(403)
  })

  it("accepts the browser-visible host when Next reconstructs an internal URL", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: "127.0.0.1:3000",
          Origin: "http://127.0.0.1:3000",
          "Sec-Fetch-Site": "same-origin",
        },
        body: JSON.stringify({ action: "probe" }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Unknown account action.",
    })
  })

  it("reveals technical access only after the server verifies the judge login", async () => {
    const response = await POST(
      authRequest({
        action: "login",
        username: "scout-judge-test",
        password: "JudgePassword!2026",
      })
    )
    expect(response.status).toBe(200)
    expect(response.cookies.get("scout_auth_session")?.value).toBeTruthy()
    await expect(response.json()).resolves.toMatchObject({
      viewer: {
        authenticated: true,
        role: "judge",
        username: "scout-judge-test",
        technicalDetails: true,
        savedPlan: null,
      },
    })
  })

  it("rejects the representative demo endpoint for a guest", async () => {
    const response = await calibrationPost(
      new NextRequest("http://localhost/api/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_demo" }),
      })
    )
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: "Judge access is required for this demo control.",
    })
  })
})
