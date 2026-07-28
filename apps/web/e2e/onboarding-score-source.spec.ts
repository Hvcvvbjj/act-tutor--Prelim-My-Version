import { expect, test } from "@playwright/test"

test("goal and schedule setup are keyboard-editable and preview the real commitment", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.getByRole("button", { name: "Build my starting plan" }).click()

  const goal = page.getByRole("spinbutton", { name: "Goal Composite" })
  await expect(goal).toHaveValue("30")
  await goal.fill("27")
  await expect(goal).toHaveValue("27")
  await goal.press("ArrowUp")
  await expect(goal).toHaveValue("28")

  await page.getByRole("button", { name: "Add my starting score" }).click()
  await page.getByRole("radio", { name: "I haven’t taken the ACT" }).check()
  await page.getByRole("button", { name: "Set my schedule" }).click()

  const dateHelp = page.locator("#test-date-help")
  await expect(dateHelp).toContainText("days away")
  await expect(dateHelp).toContainText("suggested date")

  const preview = page.getByTestId("schedule-preview")
  await expect(preview).toContainText("3 study blocks · 90 minutes total")
  await expect(preview).toContainText("You can pick exact weekdays")

  await page.getByRole("button", { name: "5 days" }).click()
  await page.getByRole("button", { name: "45 min" }).click()
  await expect(preview).toContainText("5 study blocks · 225 minutes total")

  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ pageWidth: 390, viewportWidth: 390 })
})

test("entered ACT values become the starting score without a Quick Check gate", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Build my starting plan" }).click()
  await page.getByRole("button", { name: "Add my starting score" }).click()
  await page.getByRole("radio", { name: "I have section scores" }).check()
  await page.getByRole("spinbutton", { name: "Composite ACT score" }).fill("29")
  await page.getByRole("spinbutton", { name: "English ACT score" }).fill("25")
  await page.getByRole("spinbutton", { name: "Math ACT score" }).fill("22")
  await page.getByRole("spinbutton", { name: "Reading ACT score" }).fill("24")
  await page.getByRole("button", { name: "Set my schedule" }).click()
  await page.getByRole("button", { name: "Create my first plan" }).click()

  await expect(
    page.getByRole("heading", { name: "Your starting point is ready." })
  ).toBeVisible()
  await expect(
    page.getByText("Your current planning score is 29.")
  ).toBeAttached()
  await expect(page.getByText("Quick Check complete")).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Find your starting point." })
  ).toHaveCount(0)
})

test("a first-time ACT learner starts the resumable full diagnostic", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Build my starting plan" }).click()
  await page.getByRole("button", { name: "Add my starting score" }).click()
  await page.getByRole("radio", { name: "I haven’t taken the ACT" }).check()

  await expect(
    page.getByText("Your full diagnostic will set the baseline.")
  ).toBeVisible()
  await expect(page.getByText("Skip for now")).toHaveCount(0)
  await page.getByRole("button", { name: "Set my schedule" }).click()
  await page.getByRole("button", { name: "Start my full diagnostic" }).click()

  await expect(
    page.getByRole("heading", { name: "Find your starting point." })
  ).toBeVisible()
  await expect(
    page.getByText(/66 original questions across English, Math, and Reading/)
  ).toBeVisible()
  await expect(
    page.getByText("Your starter plan uses a temporary 18.")
  ).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Find your starting point." })
  ).toBeVisible()
})

test("account signup saves and restores an in-progress starting diagnostic", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`
  const username = `baseline-${suffix}`
  const password = "SaveMyBaseline!2026"

  await page.goto("/")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.getByRole("tab", { name: "Create account" }).click()
  const signup = page.getByRole("dialog", {
    name: "Keep your Scout progress.",
  })
  await signup.getByLabel("Your name").fill("Baseline Learner")
  await signup.getByLabel("Username").fill(username)
  await signup.getByLabel("Password").fill(password)
  await signup.getByRole("button", { name: "Create my account" }).click()
  await expect(
    page.getByRole("button", { name: "Baseline Learner" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Build my starting plan" }).click()
  await page.getByRole("button", { name: "Add my starting score" }).click()
  await page.getByRole("radio", { name: "I haven’t taken the ACT" }).check()
  await page.getByRole("button", { name: "Set my schedule" }).click()
  await page.getByRole("button", { name: "Start my full diagnostic" }).click()
  await page.getByRole("button", { name: "Start diagnostic" }).click()
  await page
    .getByRole("radiogroup", { name: "Answer choices for question 1" })
    .locator("label")
    .first()
    .click()
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Next question" }).click()
  await expect(page.getByText("Overall 2/66", { exact: true })).toBeVisible()

  const logout = await page.request.post("/api/auth", {
    data: { action: "logout" },
  })
  expect(logout.ok()).toBeTruthy()
  await page.goto("/")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  const signIn = page.getByRole("dialog", { name: "Welcome back." })
  await signIn.getByLabel("Username").fill(username)
  await signIn.getByLabel("Password").fill(password)
  await signIn.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(
    page.getByRole("heading", { name: "Find your starting point." })
  ).toBeVisible()
  await page.getByRole("button", { name: "Start diagnostic" }).click()
  await expect(page.getByText("Overall 2/66", { exact: true })).toBeVisible()
})

test("account signup from score setup restores the unfinished draft after reload", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`
  const username = `draft-signup-${suffix}`

  await page.goto("/")
  await page.getByRole("button", { name: "Build my starting plan" }).click()
  await page.getByRole("spinbutton", { name: "Goal Composite" }).fill("33")
  await page.getByRole("button", { name: "Add my starting score" }).click()
  await page.getByRole("radio", { name: "I have section scores" }).check()
  await page.getByRole("spinbutton", { name: "Composite ACT score" }).fill("27")

  await page.getByRole("button", { name: "Sign in / save progress" }).click()
  await page.getByRole("tab", { name: "Create account" }).click()
  const signup = page.getByRole("dialog", {
    name: "Keep your Scout progress.",
  })
  await signup.getByLabel("Your name").fill("Draft Signup")
  await signup.getByLabel("Username").fill(username)
  await signup.getByLabel("Password").fill("DraftSignup!2026")
  await signup.getByRole("button", { name: "Create my account" }).click()
  await expect(page.getByRole("button", { name: "Draft Signup" })).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Choose your starting point" })
  ).toBeVisible()
  await expect(
    page.getByRole("spinbutton", { name: "Composite ACT score" })
  ).toHaveValue("27")
  await expect(
    page.getByRole("spinbutton", { name: "English ACT score" })
  ).toHaveValue("")
  await page.getByRole("button", { name: "Back" }).click()
  await expect(
    page.getByRole("spinbutton", { name: "Goal Composite" })
  ).toHaveValue("33")
})

test("signing into an empty account from setup attaches the local draft", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`
  const username = `draft-login-${suffix}`
  const password = "DraftLogin!2026"

  await page.goto("/")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.getByRole("tab", { name: "Create account" }).click()
  const signup = page.getByRole("dialog", {
    name: "Keep your Scout progress.",
  })
  await signup.getByLabel("Your name").fill("Draft Login")
  await signup.getByLabel("Username").fill(username)
  await signup.getByLabel("Password").fill(password)
  await signup.getByRole("button", { name: "Create my account" }).click()
  const logout = await page.request.post("/api/auth", {
    data: { action: "logout" },
  })
  expect(logout.ok()).toBeTruthy()

  await page.goto("/")
  await page.getByRole("button", { name: "Build my starting plan" }).click()
  await page.getByRole("spinbutton", { name: "Goal Composite" }).fill("34")
  await page.getByRole("button", { name: "Add my starting score" }).click()
  await page.getByRole("radio", { name: "I only know my Composite" }).check()
  await page.getByRole("spinbutton", { name: "Composite ACT score" }).fill("26")

  await page.getByRole("button", { name: "Sign in / save progress" }).click()
  const signIn = page.getByRole("dialog", { name: "Welcome back." })
  await signIn.getByLabel("Username").fill(username)
  await signIn.getByLabel("Password").fill(password)
  await signIn.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("button", { name: "Draft Login" })).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Choose your starting point" })
  ).toBeVisible()
  await expect(
    page.getByRole("spinbutton", { name: "Composite ACT score" })
  ).toHaveValue("26")
  await page.getByRole("button", { name: "Back" }).click()
  await expect(
    page.getByRole("spinbutton", { name: "Goal Composite" })
  ).toHaveValue("34")
})

test("score setup waits for the learner instead of inventing evidence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto("/")
  await page.getByRole("button", { name: "Build my starting plan" }).click()
  await page.getByRole("button", { name: "Add my starting score" }).click()

  await expect(
    page.getByRole("heading", { name: "Choose your starting point" })
  ).toBeVisible()
  const scoreSources = page.getByRole("radio")
  await expect(scoreSources).toHaveCount(3)
  for (const source of await scoreSources.all()) {
    await expect(source).not.toBeChecked()
  }
  await expect(page.locator('input[type="number"]')).toHaveCount(0)
  await expect(
    page.getByText(
      "Choose one to continue. Scout will not invent a score for you."
    )
  ).toBeVisible()

  await page.getByRole("button", { name: "Set my schedule" }).click()
  await expect(
    page.getByRole("alert").filter({ hasText: "Choose what you know" })
  ).toHaveText("Choose what you know about your current ACT scores.")
  await expect(scoreSources.first()).toBeFocused()

  await page.getByRole("radio", { name: "I have section scores" }).check()
  const composite = page.getByRole("spinbutton", {
    name: "Composite ACT score",
  })
  const english = page.getByRole("spinbutton", { name: "English ACT score" })
  const math = page.getByRole("spinbutton", { name: "Math ACT score" })
  const reading = page.getByRole("spinbutton", { name: "Reading ACT score" })
  for (const score of [composite, english, math, reading]) {
    await expect(score).toHaveValue("")
  }

  await composite.fill("24")
  await english.fill("26")
  await math.fill("20")
  await reading.fill("25")
  await page.getByRole("button", { name: "Set my schedule" }).click()
  await expect(
    page.getByRole("heading", { name: "Make a schedule you can keep" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Back" }).click()
  await expect(composite).toHaveValue("24")
  await expect(english).toHaveValue("26")
  await expect(math).toHaveValue("20")
  await expect(reading).toHaveValue("25")

  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ pageWidth: 320, viewportWidth: 320 })
})

test("Composite-only setup stays focused on the score entry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/")
  await page.getByRole("button", { name: "Build my starting plan" }).click()
  await page.getByRole("button", { name: "Add my starting score" }).click()
  await page.getByRole("radio", { name: "I have section scores" }).check()

  const composite = page.getByRole("spinbutton", {
    name: "Composite ACT score",
  })

  await expect(page.getByText("Your setup so far")).toHaveCount(0)
  await expect(composite).toHaveValue("")
  await page.getByRole("radio", { name: "I only know my Composite" }).check()
  await expect(composite).toHaveValue("")
  await composite.fill("37")
  await expect(composite).toHaveValue("37")
  await page.getByRole("button", { name: "Set my schedule" }).click()
  await expect(
    page.getByRole("alert").filter({
      hasText: "Composite score must be a whole number from 1 to 36.",
    })
  ).toBeVisible()
  await composite.fill("24")
  await expect(composite).toHaveValue("24")
})

test("learner labels a reported score as official or practice", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Build my starting plan" }).click()
  await page.getByRole("button", { name: "Add my starting score" }).click()
  await page.getByRole("radio", { name: "I only know my Composite" }).check()

  const practice = page.getByRole("radio", {
    name: /Practice test or estimate/,
  })
  const official = page.getByRole("radio", {
    name: /Official ACT result/,
  })

  await expect(practice).toBeChecked()
  await official.check()
  await expect(official).toBeChecked()
  await expect(practice).not.toBeChecked()
})

test("legacy prefilled defaults do not return as learner evidence", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "ai-act-tutor-placement-v3",
      JSON.stringify({
        version: 3,
        draft: {
          goal: 31,
          priorScoreChoice: "scores",
          startingCheckChoice: "take",
          composite: 24,
          english: 26,
          math: 20,
          reading: 25,
          scienceEnabled: false,
          science: 24,
          testDate: "2026-08-30",
          studyDaysPerWeek: 3,
          minutesPerSession: 30,
          preferredSection: "balanced",
        },
      })
    )
  })

  await page.goto("/")
  await page.getByRole("button", { name: "Build my starting plan" }).click()
  await expect(
    page.getByRole("spinbutton", { name: "Goal Composite" })
  ).toHaveValue("31")
  await page.getByRole("button", { name: "Add my starting score" }).click()

  for (const source of await page.getByRole("radio").all()) {
    await expect(source).not.toBeChecked()
  }
  await expect(page.locator('input[type="number"]')).toHaveCount(0)
  await expect(
    page.getByText(
      "Choose one to continue. Scout will not invent a score for you."
    )
  ).toBeVisible()
})

test("a full diagnostic keeps its identity after orientation reloads", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const draft = {
      goal: 30,
      priorScoreChoice: "never",
      scoreSource: "practice",
      startingCheckChoice: "take",
      composite: 0,
      english: 0,
      math: 0,
      reading: 0,
      scienceEnabled: false,
      science: 0,
      testDate: "2026-10-10",
      studyDaysPerWeek: 3,
      minutesPerSession: 30,
      preferredSection: "balanced",
    }
    const guestPlan = {
      version: 2,
      savedAt: "2026-07-26T12:00:00.000Z",
      draft,
      evidence: {
        source: "rapid_diagnostic",
        reportedComposite: null,
        calculatedComposite: 24,
        reportedSections: null,
        planningBaseline: { english: 23, math: 24, reading: 25 },
        science: null,
        confidence: "low",
        compositeDifference: null,
      },
      currentComposite: 24,
      profileSkillResults: [
        {
          skill: "sentence-boundaries",
          label: "Sentence boundaries",
          section: "english",
          correct: 3,
          total: 4,
          accuracy: 0.75,
          signal: "developing",
        },
      ],
      profileSource: "diagnostic",
      journey: {
        version: 1,
        tourVersion: 1,
        onboardingCompleted: false,
        lessonEntryChoice: null,
        officialScoreHistory: [],
        pendingOfficialScores: [],
        baselineOfficialComposite: null,
        checkInSnoozedUntil: null,
        doneForNow: false,
      },
      adaptiveBaselineRequired: false,
      baselineSkipped: false,
    }
    window.localStorage.setItem(
      "ai-act-tutor-placement-v3",
      JSON.stringify({
        version: 6,
        draft,
        guestPlan,
        viewerRole: "guest",
        resumeSurface: null,
        diagnosticPurpose: null,
      })
    )
  })

  await page.goto("/")
  await expect(page.getByText("Diagnostic complete")).toBeVisible()
  await page.reload()
  await expect(page.getByText("Diagnostic complete")).toBeVisible()
  await expect(page.getByText("Quick Check complete")).toHaveCount(0)
})
