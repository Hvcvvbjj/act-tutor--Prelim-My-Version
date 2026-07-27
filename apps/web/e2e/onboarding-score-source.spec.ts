import { expect, test } from "@playwright/test"

test("score setup waits for the learner instead of inventing evidence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto("/")
  await page.getByRole("button", { name: "Set up my plan" }).click()
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
      "Scout will not invent scores or treat sample numbers as your information."
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

test("Composite-only setup does not present an empty or invalid score as zero", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/")
  await page.getByRole("button", { name: "Set up my plan" }).click()
  await page.getByRole("button", { name: "Add my starting score" }).click()
  await page.getByRole("radio", { name: "I have section scores" }).check()

  const setupSummary = page.locator("aside").filter({
    hasText: "Your setup so far",
  })
  const startingPoint = setupSummary.locator("div").filter({
    hasText: "Starting point",
  })
  const composite = page.getByRole("spinbutton", {
    name: "Composite ACT score",
  })

  await expect(startingPoint.getByText("Not entered yet")).toBeVisible()
  await page.getByRole("radio", { name: "I only know my Composite" }).check()
  await expect(startingPoint.getByText("Not entered yet")).toBeVisible()
  await composite.fill("37")
  await expect(startingPoint.getByText("Not entered yet")).toBeVisible()
  await composite.fill("24")
  await expect(startingPoint.getByText("24", { exact: true })).toBeVisible()
})

test("learner labels a reported score as official or practice", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Set up my plan" }).click()
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
  await page.getByRole("button", { name: "Set up my plan" }).click()
  await expect(
    page
      .getByRole("group", { name: "Goal score" })
      .getByText("31", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Add my starting score" }).click()

  for (const source of await page.getByRole("radio").all()) {
    await expect(source).not.toBeChecked()
  }
  await expect(page.locator('input[type="number"]')).toHaveCount(0)
  await expect(
    page.getByText(
      "Scout will not invent scores or treat sample numbers as your information."
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
