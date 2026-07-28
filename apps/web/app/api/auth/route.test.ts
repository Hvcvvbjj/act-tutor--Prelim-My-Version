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
    composite: 0,
    english: 0,
    math: 0,
    reading: 0,
    scienceEnabled: false,
    science: 0,
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

const pendingSetup = {
  version: 1,
  savedAt: "2000-01-01T00:00:00.000Z",
  draft: {
    ...savedPlan.draft,
    startingCheckChoice: "take",
  },
  diagnosticPurpose: "baseline",
}

const reportedScorePendingSetup = {
  ...pendingSetup,
  draft: {
    ...pendingSetup.draft,
    priorScoreChoice: "composite_only",
    composite: 27,
  },
  resumeSurface: "diagnostic",
  onboardingStep: 3,
}

const pendingOnboardingSetup = {
  version: 1,
  savedAt: "2000-01-01T00:00:00.000Z",
  draft: {
    ...savedPlan.draft,
    goal: 33,
    priorScoreChoice: "scores",
    composite: 27,
    english: 0,
    math: 0,
    reading: 0,
  },
  diagnosticPurpose: "baseline",
  resumeSurface: "onboarding",
  onboardingStep: 2,
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
    const parsedStore = JSON.parse(stored) as {
      accounts: Record<string, { password: { iterations: number } }>
    }
    expect(Object.values(parsedStore.accounts)[0]?.password.iterations).toBe(
      310_000
    )
  })

  it("persists pending score follow-ups and the onboarding official baseline", async () => {
    const response = await POST(
      authRequest({
        action: "signup",
        username: "learner-pending",
        displayName: "Pending Learner",
        password: "StudyPending!2026",
        savedPlan: {
          ...savedPlan,
          version: 2,
          profileSkillResults: [],
          journey: {
            version: 1,
            tourVersion: 1,
            onboardingCompleted: true,
            lessonEntryChoice: "start-lessons",
            officialScoreHistory: [],
            pendingOfficialScores: [
              {
                testDate: "2026-07-18",
                recordedAt: "2026-07-26T12:00:00.000Z",
                nextPromptOn: "2026-08-02",
              },
            ],
            baselineOfficialComposite: 24,
            checkInSnoozedUntil: null,
            doneForNow: false,
          },
        },
      })
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      viewer: {
        savedPlan: {
          journey: {
            pendingOfficialScores: [
              {
                testDate: "2026-07-18",
                nextPromptOn: "2026-08-02",
              },
            ],
            baselineOfficialComposite: 24,
          },
        },
      },
    })
  })

  it("stores an incomplete onboarding draft during account signup", async () => {
    const signup = await POST(
      authRequest({
        action: "signup",
        username: "learner-onboarding-signup",
        displayName: "Signup Resume",
        password: "SignupResume!2026",
        pendingSetup: pendingOnboardingSetup,
      })
    )

    expect(signup.status).toBe(201)
    await expect(signup.json()).resolves.toMatchObject({
      viewer: {
        savedPlan: null,
        pendingSetup: {
          resumeSurface: "onboarding",
          onboardingStep: 2,
          draft: {
            goal: 33,
            priorScoreChoice: "scores",
            composite: 27,
            english: 0,
          },
        },
      },
    })

    const login = await POST(
      authRequest({
        action: "login",
        username: "learner-onboarding-signup",
        password: "SignupResume!2026",
      })
    )
    await expect(login.json()).resolves.toMatchObject({
      viewer: {
        pendingSetup: {
          resumeSurface: "onboarding",
          onboardingStep: 2,
          draft: { goal: 33, composite: 27 },
        },
      },
    })
  })

  it("attaches a local onboarding draft when an empty account signs in", async () => {
    const signup = await POST(
      authRequest({
        action: "signup",
        username: "learner-onboarding-login",
        displayName: "Login Resume",
        password: "LoginResume!2026",
      })
    )
    expect(signup.status).toBe(201)

    const login = await POST(
      authRequest({
        action: "login",
        username: "learner-onboarding-login",
        password: "LoginResume!2026",
        pendingSetup: pendingOnboardingSetup,
      })
    )
    expect(login.status).toBe(200)
    await expect(login.json()).resolves.toMatchObject({
      viewer: {
        savedPlan: null,
        pendingSetup: {
          resumeSurface: "onboarding",
          onboardingStep: 2,
          draft: { goal: 33, composite: 27 },
        },
      },
    })

    const preserved = await POST(
      authRequest({
        action: "login",
        username: "learner-onboarding-login",
        password: "LoginResume!2026",
        pendingSetup: {
          ...pendingOnboardingSetup,
          draft: { ...pendingOnboardingSetup.draft, goal: 35 },
        },
      })
    )
    await expect(preserved.json()).resolves.toMatchObject({
      viewer: {
        pendingSetup: {
          draft: { goal: 33 },
        },
      },
    })
  })

  it("saves and restores a pending full-diagnostic setup without inventing a score", async () => {
    const signup = await POST(
      authRequest({
        action: "signup",
        username: "learner-diagnostic",
        displayName: "Diagnostic Learner",
        password: "DiagnosticPlan!2026",
      })
    )
    const token = signup.cookies.get("scout_auth_session")?.value
    expect(token).toBeTruthy()

    const saved = await POST(
      authRequest(
        {
          action: "save_setup",
          pendingSetup,
        },
        `scout_auth_session=${token}; ai_act_diag_session=diagnostic-session-one`
      )
    )
    expect(saved.status).toBe(200)
    await expect(saved.json()).resolves.toMatchObject({
      viewer: {
        savedPlan: null,
        pendingSetup: {
          version: 1,
          diagnosticPurpose: "baseline",
          draft: {
            priorScoreChoice: "never",
            startingCheckChoice: "take",
          },
        },
      },
    })

    const login = await POST(
      authRequest({
        action: "login",
        username: "learner-diagnostic",
        password: "DiagnosticPlan!2026",
      })
    )
    await expect(login.json()).resolves.toMatchObject({
      viewer: {
        savedPlan: null,
        pendingSetup: {
          diagnosticPurpose: "baseline",
          draft: { priorScoreChoice: "never" },
        },
      },
    })
    expect(login.cookies.get("ai_act_diag_session")?.value).toBe(
      "diagnostic-session-one"
    )

    const loginToken = login.cookies.get("scout_auth_session")?.value
    expect(loginToken).toBeTruthy()
    const completed = await POST(
      authRequest(
        { action: "save_plan", savedPlan },
        `scout_auth_session=${loginToken}`
      )
    )
    await expect(completed.json()).resolves.toMatchObject({
      viewer: {
        savedPlan: { currentComposite: 18 },
        pendingSetup: null,
      },
    })

    const editedToDiagnostic = await POST(
      authRequest(
        { action: "save_setup", pendingSetup },
        `scout_auth_session=${loginToken}`
      )
    )
    await expect(editedToDiagnostic.json()).resolves.toMatchObject({
      viewer: {
        savedPlan: { currentComposite: 18 },
        pendingSetup: { diagnosticPurpose: "baseline" },
      },
    })

    const diagnosticCompleted = await POST(
      authRequest(
        { action: "save_plan", savedPlan },
        `scout_auth_session=${loginToken}`
      )
    )
    await expect(diagnosticCompleted.json()).resolves.toMatchObject({
      viewer: {
        savedPlan: { currentComposite: 18 },
        pendingSetup: null,
      },
    })
  })

  it("keeps a reported starting score while the full diagnostic is pending", async () => {
    const signup = await POST(
      authRequest({
        action: "signup",
        username: "learner-reported-diagnostic",
        displayName: "Reported Score Learner",
        password: "ReportedDiagnostic!2026",
        pendingSetup: reportedScorePendingSetup,
      })
    )

    expect(signup.status).toBe(201)
    await expect(signup.json()).resolves.toMatchObject({
      viewer: {
        savedPlan: null,
        pendingSetup: {
          resumeSurface: "diagnostic",
          onboardingStep: 3,
          draft: {
            priorScoreChoice: "composite_only",
            composite: 27,
            startingCheckChoice: "take",
          },
        },
      },
    })

    const login = await POST(
      authRequest({
        action: "login",
        username: "learner-reported-diagnostic",
        password: "ReportedDiagnostic!2026",
      })
    )
    await expect(login.json()).resolves.toMatchObject({
      viewer: {
        pendingSetup: {
          resumeSurface: "diagnostic",
          draft: {
            priorScoreChoice: "composite_only",
            composite: 27,
          },
        },
      },
    })
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

  it("permanently removes the authenticated learner's saved plan", async () => {
    const signup = await POST(
      authRequest({
        action: "signup",
        username: "learner-delete-plan",
        displayName: "Delete Plan Learner",
        password: "DeleteMyPlan!2026",
        savedPlan,
      })
    )
    const token = signup.cookies.get("scout_auth_session")?.value
    expect(token).toBeTruthy()

    const deleted = await POST(
      authRequest(
        { action: "delete_saved_plan" },
        `scout_auth_session=${token}`
      )
    )
    expect(deleted.status).toBe(200)
    await expect(deleted.json()).resolves.toMatchObject({
      viewer: {
        authenticated: true,
        role: "learner",
        username: "learner-delete-plan",
        savedPlan: null,
      },
    })

    const restored = await POST(
      authRequest({
        action: "login",
        username: "learner-delete-plan",
        password: "DeleteMyPlan!2026",
      })
    )
    await expect(restored.json()).resolves.toMatchObject({
      viewer: {
        username: "learner-delete-plan",
        savedPlan: null,
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

  it("allows the labeled one-answer preview without an account", async () => {
    const response = await calibrationPost(
      new NextRequest("http://localhost/api/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_preview" }),
      })
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      representativeDemo: true,
      responseCount: 7,
      status: "in_progress",
    })
  })
})
