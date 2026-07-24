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

test("mobile welcome keeps both first-run actions in view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto("/")

  const setupAction = page.getByRole("button", { name: "Set up my plan" })
  const demoAction = page.getByRole("button", {
    name: "See one answer change the plan",
  })
  await expect(setupAction).toBeVisible()
  await expect(demoAction).toBeVisible()

  for (const action of [setupAction, demoAction]) {
    const box = await action.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(740)
  }

  await page.addStyleTag({ content: ":root { font-size: 20px !important; }" })
  await expect
    .poll(() =>
      page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ scrollWidth: 320, viewportWidth: 320 })
})

test("Quick Check recovers after its first request fails", async ({
  page,
  request,
}) => {
  await request.delete("/api/calibration")
  let failedInitialLoad = false
  await page.route("**/api/calibration", async (route) => {
    if (route.request().method() === "GET" && !failedInitialLoad) {
      failedInitialLoad = true
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Quick Check is temporarily unavailable.",
        }),
      })
      return
    }
    await route.continue()
  })

  await page.goto("/")
  await page
    .getByRole("button", { name: "See one answer change the plan" })
    .click()

  const quickCheckError = page
    .getByRole("alert")
    .filter({ hasText: "Quick Check unavailable" })
  await expect(quickCheckError).toContainText("Quick Check unavailable")
  await expect(quickCheckError).toContainText(
    "Quick Check is temporarily unavailable."
  )
  await page.getByRole("button", { name: "Try Quick Check again" }).click()

  await expect(page.getByText("Seven sample answers are loaded")).toBeVisible({
    timeout: 20_000,
  })
  await expect(
    page.getByRole("button", { name: "Try Quick Check again" })
  ).toHaveCount(0)
  await request.delete("/api/calibration")
})

test("a guest can open the one-answer demo and see the adaptive proof", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto("/")
  await page
    .getByRole("button", { name: "See one answer change the plan" })
    .click()

  await expect(page.getByText("Seven sample answers are loaded")).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByText("7/12 answered")).toBeVisible()

  const questionPrompt = await page
    .getByRole("heading", { name: /A solution contains water/ })
    .boundingBox()
  const firstChoice = await page
    .getByTestId("quick-check-choice")
    .first()
    .boundingBox()
  const mobileNavigation = await page
    .getByRole("navigation", { name: "Primary study navigation" })
    .boundingBox()
  expect(questionPrompt).not.toBeNull()
  expect(firstChoice).not.toBeNull()
  expect(mobileNavigation).not.toBeNull()
  expect(questionPrompt!.y + questionPrompt!.height).toBeLessThan(
    mobileNavigation!.y
  )
  expect(firstChoice!.y + firstChoice!.height).toBeLessThan(mobileNavigation!.y)

  await page.keyboard.press("b")
  await expect(page.getByRole("radio", { name: "B 12" })).toBeChecked()
  await page.getByRole("button", { name: "Check my answer" }).click()

  await expect(
    page.getByRole("heading", {
      name: "Correct—Scout adjusted your next steps.",
    })
  ).toBeVisible()
  await expect(page.getByText("1 · Question match")).toBeVisible()
  await expect(page.getByText("2 · Ratios and percent estimate")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Sign in / save progress" })
  ).toBeVisible()
})

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

test("mobile Quick Check answer choices keep their full reading width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await openStarterPlan(page)
  await page.getByRole("tab", { name: "Check" }).click()

  const passage = page.getByTestId("quick-check-stimulus")
  const mobilePassage = await passage.evaluate((element) => ({
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
  }))
  expect(mobilePassage.scrollHeight).toBe(mobilePassage.clientHeight)
  expect(mobilePassage.overflowY).toBe("visible")

  const answerChoices = page.getByTestId("quick-check-choice")
  await expect(answerChoices).toHaveCount(4)
  const firstChoice = answerChoices.first()
  await expect(firstChoice).toBeVisible()
  const choiceBox = await firstChoice.boundingBox()
  expect(choiceBox?.width).toBeGreaterThan(270)
  expect(choiceBox?.height).toBeLessThan(180)

  const firstRadio = page.getByRole("radio", {
    name: "A After three weeks, of collecting data Imani transferred the times to a digital map.",
  })
  await page.keyboard.press("a")
  await expect(firstRadio).toBeChecked()
  await expect(
    page.getByRole("button", { name: "Check my answer" })
  ).toBeEnabled()

  await page.setViewportSize({ width: 1024, height: 800 })
  const desktopPassage = await passage.evaluate((element) => ({
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
  }))
  expect(desktopPassage.scrollHeight).toBeGreaterThan(
    desktopPassage.clientHeight
  )
  expect(desktopPassage.overflowY).toBe("auto")
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
  await expect(page.getByRole("button", { name: "Ask Scout" })).toBeVisible()
  await expect(
    primaryNavigation.getByRole("button", { name: "Ask Scout" })
  ).toHaveCount(0)

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

  const moreButton = primaryNavigation.getByRole("button", { name: "More" })
  const moreMenu = page.getByRole("menu", { name: "More destinations" })
  await moreButton.click()
  await expect(moreMenu.getByRole("menuitem")).toHaveCount(3)
  await page.keyboard.press("Escape")
  await expect(moreMenu).toBeHidden()

  await moreButton.click()
  await moreMenu.getByRole("menuitem", { name: "Timed practice" }).click()
  await expect(moreButton).toHaveAttribute("aria-current", "page")

  await moreButton.click()
  await moreMenu.getByRole("menuitem", { name: "Learning settings" }).click()
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

test("a calendar review cannot masquerade as the current lesson", async ({
  page,
}) => {
  await openStarterPlan(page)
  await page.getByRole("tab", { name: "My week" }).click()

  const sentenceReview = page.getByRole("button", {
    name: /Review · \d+m Sentence boundaries review/,
  })
  for (let week = 0; week < 6 && (await sentenceReview.count()) === 0; week++) {
    await page.getByRole("button", { name: "Next study week" }).click()
  }

  await expect(sentenceReview).toBeVisible()
  await sentenceReview.click()
  await expect(
    page.getByRole("button", { name: "Finish your current task first" })
  ).toBeDisabled()
  await expect(
    page.getByRole("button", { name: "Continue this task" })
  ).toHaveCount(0)
})

test("the weekly calendar keeps day cards readable at laptop and phone widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 })
  await openStarterPlan(page)
  await page.getByRole("tab", { name: "My week" }).click()

  const dayCards = page.getByTestId("week-day")
  await expect(dayCards).toHaveCount(7)
  const laptopCards = await dayCards.evaluateAll((cards) =>
    cards.map((card) => {
      const bounds = card.getBoundingClientRect()
      return { width: bounds.width, top: bounds.top }
    })
  )
  expect(Math.min(...laptopCards.map((card) => card.width))).toBeGreaterThan(
    280
  )
  expect(new Set(laptopCards.map((card) => Math.round(card.top))).size).toBe(3)

  await page.setViewportSize({ width: 320, height: 760 })
  const mobileCards = await dayCards.evaluateAll((cards) =>
    cards.map((card) => card.getBoundingClientRect().width)
  )
  expect(Math.min(...mobileCards)).toBeGreaterThan(250)
  const mobileViewport = await page.locator("body").evaluate((body) => ({
    clientWidth: body.clientWidth,
    scrollWidth: body.scrollWidth,
  }))
  expect(mobileViewport.scrollWidth).toBe(mobileViewport.clientWidth)
})

test("incomplete timed practice does not count blank questions as completed-answer misses", async ({
  page,
}) => {
  await openStarterPlan(page)
  await page.request.delete("/api/exam-lab")

  const startedResponse = await page.request.post("/api/exam-lab", {
    data: {
      action: "start",
      mode: "sprint",
      section: "english",
      timeMultiplier: 1,
    },
  })
  expect(startedResponse.ok()).toBeTruthy()
  const started = (await startedResponse.json()) as {
    session: {
      questions: ReadonlyArray<{
        id: string
        choices: ReadonlyArray<{ id: string }>
      }>
    }
  }
  const firstQuestion = started.session.questions[0]
  if (!firstQuestion) throw new Error("Timed practice returned no questions.")

  const saveResponse = await page.request.patch("/api/exam-lab", {
    data: {
      responses: {
        [firstQuestion.id]: {
          choiceId: firstQuestion.choices[0].id,
          confidence: "sure",
          flagged: false,
          elapsedSeconds: 20,
        },
      },
      currentIndex: 0,
      phase: "questions",
    },
  })
  expect(saveResponse.ok()).toBeTruthy()
  expect(
    (
      await page.request.post("/api/exam-lab", {
        data: { action: "review" },
      })
    ).ok()
  ).toBeTruthy()
  const finalizedResponse = await page.request.post("/api/exam-lab", {
    data: { action: "finalize" },
  })
  expect(finalizedResponse.ok()).toBeTruthy()
  const finalized = (await finalizedResponse.json()) as {
    session: {
      result: {
        correct: number
        total: number
        unanswered: number
        review: ReadonlyArray<{
          section: "english" | "math" | "reading"
          selectedChoiceId: string | null
        }>
      }
    }
  }
  const result = finalized.session.result
  expect(result.total).toBeGreaterThan(1)
  expect(result.unanswered).toBe(result.total - 1)

  await page.getByRole("button", { name: "More" }).click()
  await page.getByRole("menuitem", { name: "Timed practice" }).click()

  const accuracy = page.getByTestId("timed-practice-answer-accuracy")
  await expect(accuracy).toContainText("Completed answers correct")
  await expect(accuracy).toContainText(`${result.correct} of 1`)
  await expect(accuracy).toContainText(`${result.unanswered} unanswered`)
  await expect(accuracy).not.toContainText("%")

  const answeredSection = result.review.find(
    (answer) => answer.selectedChoiceId !== null
  )?.section
  if (!answeredSection)
    throw new Error("Timed practice did not preserve the completed answer.")
  await expect(
    page.getByTestId(`timed-practice-section-${answeredSection}`)
  ).toContainText(`${result.correct}/1 completed answer`)
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
  await page.getByRole("menuitem", { name: "Learning data" }).click()
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
  await page
    .getByRole("button", { name: "See one answer change the plan" })
    .click()
  await expect(page.getByText("Seven sample answers are loaded")).toBeVisible({
    timeout: 20_000,
  })
  await expect(
    page.getByText("How Scout chose this question", { exact: false })
  ).toBeVisible()

  await page.getByRole("button", { name: "More" }).click()
  await page.getByRole("menuitem", { name: "Learning data" }).click()
  await expect(
    page.getByRole("button", { name: "Technical details" })
  ).toBeVisible()
})
