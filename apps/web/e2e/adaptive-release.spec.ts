import { expect, test } from "@playwright/test"

interface CalibrationQuestion {
  id: string
  choices: ReadonlyArray<{ id: string }>
}

interface CalibrationPayload {
  status: "in_progress" | "complete"
  responseCount: number
  currentQuestion: CalibrationQuestion | null
}

async function openStarterPlan(page: import("@playwright/test").Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Set up my plan" }).click()
  await page.getByRole("button", { name: "Add my starting score" }).click()
  await page.getByRole("radio", { name: "I haven’t taken the ACT" }).check()
  await page.getByRole("radio", { name: /Skip for now/ }).check()
  await page.getByRole("button", { name: "Set my schedule" }).click()
  await page.getByRole("button", { name: "Create my starter plan" }).click()
  await expect(
    page.getByText("Your starter plan uses a temporary 18.")
  ).toBeVisible()
}

test("Quick Check atomically replaces the temporary server lesson and Today mission", async ({
  request,
}) => {
  await request.delete("/api/learning")
  await request.delete("/api/calibration")

  const startedResponse = await request.post("/api/learning", {
    data: {
      action: "start",
      skill: "sentence-boundaries",
      diagnosticSkillResults: [],
      goalScore: 30,
      currentScore: 18,
      daysUntilTest: 36,
      minutesPerSession: 30,
      studyDaysPerWeek: 5,
      preferredSection: "balanced",
    },
  })
  expect(startedResponse.ok()).toBeTruthy()
  const started = await startedResponse.json()

  let calibration = (await (
    await request.get("/api/calibration")
  ).json()) as CalibrationPayload
  while (calibration.status === "in_progress") {
    const question = calibration.currentQuestion
    expect(question).not.toBeNull()
    const response = await request.post("/api/calibration", {
      data: {
        action: "answer",
        questionId: question?.id,
        choiceId: question?.choices[0]?.id,
        confidence: "sure",
      },
    })
    expect(response.ok()).toBeTruthy()
    calibration = (await response.json()) as CalibrationPayload
  }

  expect(calibration.responseCount).toBeGreaterThanOrEqual(8)
  const rebaseResponse = await request.post("/api/learning", {
    data: {
      action: "rebase_after_calibration",
      goalScore: 30,
      daysUntilTest: 36,
      minutesPerSession: 30,
      studyDaysPerWeek: 5,
      preferredSection: "balanced",
      currentScore: 36,
    },
  })
  expect(rebaseResponse.ok()).toBeTruthy()
  const rebased = await rebaseResponse.json()

  expect(rebased.learning.todaySkill).not.toBe(started.todaySkill)
  expect(rebased.learning.lesson.skill).toBe(rebased.learning.todaySkill)
  expect(
    rebased.learning.questions.every(
      (question: { skill: string }) =>
        question.skill === rebased.learning.todaySkill
    )
  ).toBeTruthy()
  expect(rebased.learning.futureTask.reason).toContain(
    "Quick Check replaced the temporary baseline"
  )
  expect(rebased.baseline.skillResults.length).toBeGreaterThan(0)
  expect(rebased.baseline.composite).not.toBe(36)

  const persistedResponse = await request.get("/api/learning")
  expect(persistedResponse.ok()).toBeTruthy()
  const persisted = await persistedResponse.json()
  expect(persisted.todaySkill).toBe(rebased.learning.todaySkill)
  expect(persisted.lesson.skill).toBe(rebased.learning.todaySkill)
})

test("mobile onboarding actions stay within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto("/")
  await page.getByRole("button", { name: "Set up my plan" }).click()
  await page.getByRole("button", { name: "Add my starting score" }).click()
  await page.getByRole("radio", { name: "I haven’t taken the ACT" }).check()
  await page.getByRole("button", { name: "Set my schedule" }).click()

  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await expect
      .poll(() =>
        page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        }))
      )
      .toEqual({ scrollWidth: width, viewportWidth: width })
  }
})

test("mobile study navigation fits and Scout behaves as a focus-trapped bottom sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await openStarterPlan(page)
  const primaryNavigation = page.getByRole("navigation", {
    name: "Primary study navigation",
  })
  await expect(primaryNavigation.getByRole("tab")).toHaveCount(4)
  await expect(
    primaryNavigation.getByRole("tab", { name: "Check" })
  ).toBeVisible()
  await expect(
    primaryNavigation.getByRole("button", { name: "Ask Scout" })
  ).toBeVisible()

  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await expect
      .poll(() =>
        page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        }))
      )
      .toEqual({ scrollWidth: width, viewportWidth: width })
  }

  await page.setViewportSize({ width: 700, height: 800 })
  await expect(page.getByRole("button", { name: "Ask Scout" })).toHaveCount(1)
  await page.setViewportSize({ width: 390, height: 844 })

  const launcher = page.getByRole("button", { name: "Ask Scout" }).first()
  await launcher.click()
  const dialog = page.getByRole("dialog", { name: "Ask Scout" })
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box?.width).toBe(390)
  expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(844)

  await dialog
    .getByLabel("Your question")
    .fill("What does margin of error mean in regular English?")
  await dialog.getByRole("button", { name: "Ask Scout", exact: true }).click()
  await expect(dialog).toContainText(/not ACT score points/i)
  await expect(dialog.getByText("How this answer was made")).toHaveCount(0)

  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab")
    expect(
      await dialog.evaluate((node) => node.contains(document.activeElement))
    ).toBeTruthy()
  }

  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(launcher).toBeFocused()

  await primaryNavigation.getByRole("button", { name: "More" }).click()
  await page.getByRole("button", { name: "Learning settings" }).click()
  const settings = page.getByRole("dialog", { name: "Learning settings" })
  await expect(settings).toBeVisible()
  await expect(
    settings.getByRole("switch", {
      name: "Reduced motion Stops nonessential movement.",
      exact: true,
    })
  ).toBeVisible()
  await expect(
    settings.getByRole("switch", {
      name: "Use fewer technical terms Keeps explanations focused on direct, learner-facing language.",
      exact: true,
    })
  ).toBeVisible()
  await settings
    .getByRole("button", { name: "Close learning settings" })
    .click()
  await expect(settings).toBeHidden()
})

test("a guest plan survives a refresh on the same device", async ({ page }) => {
  await openStarterPlan(page)
  await page.reload()

  await expect(
    page.getByText("Your starter plan uses a temporary 18.")
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Sign in / save progress" })
  ).toBeVisible()
})

test("a learner can save the skipped-check plan and restore it after sign-in", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`
  const username = `learner-${suffix}`
  const password = "SaveMyPlan!2026"

  await openStarterPlan(page)
  await page.getByRole("button", { name: "Sign in / save progress" }).click()
  const account = page.getByRole("dialog", {
    name: "Welcome back.",
  })
  await account.getByRole("tab", { name: "Create account" }).click()
  const createAccount = page.getByRole("dialog", {
    name: "Keep your Scout progress.",
  })
  await createAccount.getByLabel("Your name").fill("E2E Learner")
  await createAccount.getByLabel("Username").fill(username)
  await createAccount.getByLabel("Password").fill(password)
  await createAccount
    .getByRole("button", { name: "Create account and save this plan" })
    .click()

  await expect(page.getByRole("button", { name: "E2E Learner" })).toBeVisible({
    timeout: 15_000,
  })
  await page.reload()
  await expect(
    page.getByText("Your starter plan uses a temporary 18.")
  ).toBeVisible()

  await page.getByRole("button", { name: "More" }).click()
  await page.getByRole("button", { name: "Learning data" }).click()
  await expect(
    page.getByRole("button", { name: "Technical details" })
  ).toHaveCount(0)

  await page.getByRole("button", { name: "E2E Learner" }).click()
  const savedAccount = page.getByRole("dialog", {
    name: "Your progress is saved.",
  })
  await savedAccount.getByRole("button", { name: "Sign out" }).click()
  await expect(
    page.getByRole("button", { name: "Sign in / save progress" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Sign in / save progress" }).click()
  const signIn = page.getByRole("dialog", { name: "Welcome back." })
  await signIn.getByLabel("Username").fill(username)
  await signIn.getByLabel("Password").fill(password)
  await signIn.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(
    page.getByText("Your starter plan uses a temporary 18.")
  ).toBeVisible({ timeout: 15_000 })
})

test("the server-verified judge account reveals the technical review layer", async ({
  page,
}) => {
  const judgeUsername = process.env.SCOUT_JUDGE_USERNAME
  const judgePassword = process.env.SCOUT_E2E_JUDGE_PASSWORD
  expect(
    judgeUsername,
    "Set SCOUT_JUDGE_USERNAME for the judge flow."
  ).toBeTruthy()
  expect(
    judgePassword,
    "Set SCOUT_E2E_JUDGE_PASSWORD for the judge flow."
  ).toBeTruthy()

  await page.goto("/")
  await page.getByRole("button", { name: "Sign in / save progress" }).click()
  const signIn = page.getByRole("dialog", { name: "Welcome back." })
  await signIn.getByLabel("Username").fill(judgeUsername!)
  await signIn.getByLabel("Password").fill(judgePassword!)
  await signIn.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(page.getByRole("button", { name: "Judge view" })).toBeVisible()
  await page.getByRole("button", { name: "Open the judge demo" }).click()
  await expect(page.getByText("Seven sample answers are loaded")).toBeVisible()
  await expect(
    page.getByText("How Scout chose this question", { exact: false })
  ).toBeVisible()

  await page.getByRole("button", { name: "More" }).click()
  await page.getByRole("button", { name: "Learning data" }).click()
  await expect(
    page.getByRole("button", { name: "Technical details" })
  ).toBeVisible()
})
