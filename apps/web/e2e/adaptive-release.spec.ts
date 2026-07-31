import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test"
import { ACT_PRACTICE_QUESTIONS } from "@act-tutor/content"

import { openReportedScorePlan } from "./helpers"

interface CalibrationQuestion {
  id: string
  choices: ReadonlyArray<{ id: string }>
}

interface CalibrationPayload {
  status: "in_progress" | "complete"
  responseCount: number
  currentQuestion: CalibrationQuestion | null
}

async function completeRoundZeroDiagnostic(request: APIRequestContext) {
  const response = await request.post("/api/diagnostic", {
    data: { action: "start_new_if_completed" },
  })
  expect(response.ok()).toBeTruthy()
  const session = (await response.json()) as {
    form: {
      id: string
      version: string
      questions: ReadonlyArray<{
        id: string
        choices: ReadonlyArray<{ id: string }>
      }>
    }
  }
  const completed = await request.post("/api/diagnostic", {
    data: {
      formId: session.form.id,
      formVersion: session.form.version,
      answers: session.form.questions.map((question) => ({
        questionId: question.id,
        choiceId: question.choices[0]!.id,
      })),
    },
  })
  expect(completed.ok()).toBeTruthy()
}

async function openStarterPlan(page: Page) {
  await openReportedScorePlan(page)
}

async function openFullDiagnostic(page: Page) {
  await openStarterPlan(page)
  const diagnosticResponse = await page.request.post("/api/diagnostic", {
    data: { action: "start_new_if_completed" },
  })
  expect(diagnosticResponse.ok()).toBeTruthy()
  await page.evaluate(() => {
    const key = "ai-act-tutor-placement-v3"
    const stored = window.localStorage.getItem(key)
    if (!stored) throw new Error("Guest plan was not saved locally.")
    const parsed = JSON.parse(stored) as Record<string, unknown>
    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...parsed,
        version: 6,
        resumeSurface: "diagnostic",
        diagnosticPurpose: "baseline",
      })
    )
  })
  await page.reload()
  await page.getByRole("button", { name: "Start diagnostic" }).click()
}

test("mobile welcome keeps the real-baseline action in view and removes the one-answer demo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto("/")

  const setupAction = page.getByRole("button", {
    name: "Build my starting plan",
  })
  await expect(setupAction).toBeVisible()
  await expect(
    page.getByRole("button", { name: "See one answer change the plan" })
  ).toHaveCount(0)

  const box = await setupAction.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(740)

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

test("a learner without a score starts the full 66-question diagnostic", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Build my starting plan" }).click()
  await page.getByRole("button", { name: "Add my starting score" }).click()
  await page.getByRole("radio", { name: "I haven’t taken the ACT" }).check()
  await expect(page.getByText("Skip for now")).toHaveCount(0)
  await page.getByRole("button", { name: "Set my schedule" }).click()
  await page
    .getByRole("button", { name: "Continue to full diagnostic" })
    .click()

  await expect(
    page.getByRole("heading", { name: "Find your starting point." })
  ).toBeVisible()
  await expect(
    page.getByText(/66 original questions across English, Math, and Reading/)
  ).toBeVisible()
  await expect(
    page.getByText("Your starter plan uses a temporary 18.")
  ).toHaveCount(0)
})

test("an optional Quick Check preserves the current foundation lesson while refreshing skill evidence", async ({
  request,
}) => {
  await request.delete("/api/learning")
  await request.delete("/api/calibration")
  await completeRoundZeroDiagnostic(request)

  const startedResponse = await request.post("/api/learning", {
    data: {
      action: "start",
      skill: "sentence-boundaries",
      diagnosticSkillResults: [],
      goalScore: 30,
      currentScore: 24,
      daysUntilTest: 36,
      minutesPerSession: 30,
      studyDaysPerWeek: 5,
      preferredSection: "balanced",
    },
  })
  expect(startedResponse.ok()).toBeTruthy()
  const started = await startedResponse.json()
  expect(started.learningTwin.evidence.diagnostic).toBe(66)
  expect(
    started.learningTwin.skills.every(
      (skill: { priorSource: string }) => skill.priorSource === "diagnostic"
    )
  ).toBe(true)

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
  const beforeRebaseResponse = await request.get("/api/learning")
  expect(beforeRebaseResponse.ok()).toBeTruthy()
  const beforeRebase = await beforeRebaseResponse.json()
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

  expect(rebased.learning.learningTwin).toEqual(beforeRebase.learningTwin)
  expect(rebased.learning.decisionHistory).toEqual(beforeRebase.decisionHistory)
  expect(rebased.learning.todaySkill).toBe(started.todaySkill)
  expect(rebased.learning.mode).toBe("foundation")
  expect(rebased.learning.lesson.skill).toBe(rebased.learning.todaySkill)
  expect(
    rebased.learning.questions.every(
      (question: { skill: string }) =>
        question.skill === rebased.learning.todaySkill
    )
  ).toBeTruthy()
  expect(rebased.learning.futureTask.reason).toContain(
    "Your scored baseline is ready."
  )
  expect(rebased.learning.futureTask.reason).toContain(
    "Round 1 still covers every question type"
  )
  expect(rebased.learning.futureTask.reason).not.toContain("temporary")
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
  await page.getByRole("button", { name: "Build my starting plan" }).click()
  const setupProgress = page.getByRole("navigation", {
    name: "Setup progress",
  })
  const goalStep = setupProgress.getByText("1. Goal", { exact: true })
  const scoreStep = setupProgress.getByText("2. Scores", { exact: true })
  const scheduleStep = setupProgress.getByText("3. Schedule", { exact: true })
  const goalHeading = page.getByRole("heading", {
    name: "Choose your ACT goal",
  })
  await expect(goalHeading).toBeFocused()
  await expect(goalStep).toBeVisible()
  await expect(goalStep.locator("..")).toHaveAttribute("aria-current", "step")
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

  await page.getByRole("button", { name: "Add my starting score" }).click()
  const scoreHeading = page.getByRole("heading", {
    name: "Choose your starting point",
  })
  await expect(scoreHeading).toBeFocused()
  await expect(scoreStep).toBeVisible()
  await expect(scoreStep.locator("..")).toHaveAttribute("aria-current", "step")
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

  await page.getByRole("radio", { name: "I haven’t taken the ACT" }).check()
  await page.getByRole("button", { name: "Set my schedule" }).click()
  const scheduleHeading = page.getByRole("heading", {
    name: "Make a schedule you can keep",
  })
  await expect(scheduleHeading).toBeFocused()
  await expect(scheduleStep).toBeVisible()
  await expect(scheduleStep.locator("..")).toHaveAttribute(
    "aria-current",
    "step"
  )
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

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

  await page.getByRole("button", { name: "Back" }).click()
  await expect(scoreHeading).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

  await page.getByRole("button", { name: "Back" }).click()
  await expect(goalHeading).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

  await page.setViewportSize({ width: 320, height: 844 })
  await page.addStyleTag({ content: ":root { font-size: 20px !important; }" })
  await expect
    .poll(() =>
      page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ scrollWidth: 320, viewportWidth: 320 })
  for (const controlName of ["Decrease goal score", "Increase goal score"]) {
    const controlBounds = await page
      .getByRole("button", { name: controlName })
      .boundingBox()
    expect(controlBounds).not.toBeNull()
    expect(controlBounds!.x).toBeGreaterThanOrEqual(0)
    expect(controlBounds!.x + controlBounds!.width).toBeLessThanOrEqual(320)
  }
  await expect
    .poll(() =>
      page
        .getByRole("button", { name: "Add my starting score" })
        .evaluate((button) => button.scrollWidth <= button.clientWidth)
    )
    .toBe(true)
})

test("mobile study navigation fits and Mr. Kim behaves as a focus-trapped bottom sheet", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 320, height: 760 })
  await openStarterPlan(page)
  const primaryNavigation = page.getByRole("navigation", {
    name: "Primary study navigation",
  })
  await expect(primaryNavigation.getByRole("tab")).toHaveCount(4)
  await expect(
    primaryNavigation.getByRole("tab", { name: "Lessons" })
  ).toBeVisible()
  await expect(
    primaryNavigation.getByRole("tab", { name: "Badges" })
  ).toBeVisible()
  await expect(
    primaryNavigation.getByRole("button", { name: "Practice" })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Ask Mr. Kim" })).toBeVisible()
  await expect(
    primaryNavigation.getByRole("button", { name: "Ask Mr. Kim" })
  ).toHaveCount(0)
  await expect(
    primaryNavigation.getByRole("button", { name: "More" })
  ).toHaveCount(0)

  const inactiveNavigationStyles = await primaryNavigation
    .getByRole("tab")
    .evaluateAll((tabs) => {
      function channel(value: number) {
        const normalized = value / 255
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4
      }
      function luminance(color: string) {
        const values = color.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? []
        return (
          0.2126 * channel(values[0] ?? 0) +
          0.7152 * channel(values[1] ?? 0) +
          0.0722 * channel(values[2] ?? 0)
        )
      }
      function contrast(foreground: string, background: string) {
        const lighter = Math.max(luminance(foreground), luminance(background))
        const darker = Math.min(luminance(foreground), luminance(background))
        return (lighter + 0.05) / (darker + 0.05)
      }

      return tabs
        .filter((tab) => tab.getAttribute("aria-selected") === "false")
        .map((tab) => {
          const styles = getComputedStyle(tab)
          return {
            contrast: contrast(
              styles.color,
              getComputedStyle(document.body).backgroundColor
            ),
            fontSize: Number.parseFloat(styles.fontSize),
          }
        })
    })
  expect(inactiveNavigationStyles.length).toBeGreaterThan(0)
  for (const styles of inactiveNavigationStyles) {
    expect(styles.contrast).toBeGreaterThanOrEqual(4.5)
    expect(styles.fontSize).toBeGreaterThanOrEqual(12)
  }

  const lessons = page.getByTestId("lessons-command-center")
  await expect(lessons).toBeVisible()
  await expect(
    lessons.getByRole("heading", {
      name: "Lessons",
    })
  ).toBeVisible()
  await expect(
    lessons.getByRole("complementary").getByText("Up next", { exact: true })
  ).toBeVisible()
  await expect(lessons.getByText("More ways to study")).toHaveCount(0)
  await expect(page.getByText("Why AlexACT picked this")).toHaveCount(0)
  await expect(page.getByText("Later today")).toHaveCount(0)

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

  await page.setViewportSize({ width: 320, height: 760 })
  const brand = page.getByText("AlexACT", { exact: true }).first()
  await expect(brand).toBeVisible()
  const brandStyle = await brand.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    whiteSpace: getComputedStyle(element).whiteSpace,
  }))
  expect(brandStyle.height).toBeLessThanOrEqual(18)
  expect(brandStyle.whiteSpace).toBe("nowrap")

  await primaryNavigation.getByRole("tab", { name: "Progress" }).click()
  await expect(
    page.getByRole("heading", {
      name: "Your 12 skills",
    })
  ).toBeVisible({ timeout: 20_000 })
  await expect
    .poll(() =>
      page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ scrollWidth: 320, viewportWidth: 320 })

  await page.getByRole("button", { name: /Ratios and percent/ }).click()
  const selectedSkillHeading = page.locator("#selected-skill-title")
  const selectedSkillDetail = page.locator("#selected-skill-detail")
  await expect(selectedSkillHeading).toHaveText("Ratios and percent")
  await expect(selectedSkillHeading).toBeFocused()
  await expect(
    selectedSkillDetail.getByRole("heading", {
      name: /^(Why AlexACT prioritizes this|Current adaptive priority)$/,
    })
  ).toBeVisible()
  await expect(selectedSkillDetail).toContainText(
    /highest (adaptive|evidence-based practice) priority/
  )
  const selectedSkillBounds = await selectedSkillHeading.boundingBox()
  const progressNavigationBounds = await primaryNavigation.boundingBox()
  expect(selectedSkillBounds).not.toBeNull()
  expect(progressNavigationBounds).not.toBeNull()
  expect(selectedSkillBounds!.y).toBeGreaterThanOrEqual(0)
  expect(selectedSkillBounds!.y + selectedSkillBounds!.height).toBeLessThan(
    progressNavigationBounds!.y
  )

  const enlargedTextStyle = await page.addStyleTag({
    content: ":root { font-size: 20px !important; }",
  })
  await expect
    .poll(() =>
      page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }))
    )
    .toEqual({ scrollWidth: 320, viewportWidth: 320 })
  const enlargedNavigationBounds = await primaryNavigation.boundingBox()
  expect(enlargedNavigationBounds).not.toBeNull()
  expect(enlargedNavigationBounds!.x).toBeGreaterThanOrEqual(0)
  expect(
    enlargedNavigationBounds!.x + enlargedNavigationBounds!.width
  ).toBeLessThanOrEqual(320)
  const enlargedBrandBounds = await page.getByTestId("app-brand").boundingBox()
  const enlargedFirstHeaderActionBounds = await page
    .locator("header")
    .first()
    .getByRole("button", { name: "Ask Mr. Kim" })
    .boundingBox()
  expect(enlargedBrandBounds).not.toBeNull()
  expect(enlargedFirstHeaderActionBounds).not.toBeNull()
  expect(
    enlargedBrandBounds!.x + enlargedBrandBounds!.width
  ).toBeLessThanOrEqual(enlargedFirstHeaderActionBounds!.x)
  await enlargedTextStyle.evaluate((style) => {
    style.parentNode?.removeChild(style)
  })

  await page.setViewportSize({ width: 700, height: 800 })
  await expect(page.getByRole("button", { name: "Ask Mr. Kim" })).toHaveCount(1)
  await page.setViewportSize({ width: 390, height: 844 })

  const launcher = page.getByRole("button", { name: "Ask Mr. Kim" }).first()
  await launcher.click()
  const dialog = page.getByRole("dialog", { name: "Ask Mr. Kim" })
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box?.width).toBe(390)
  expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(844)

  await dialog
    .getByLabel("Your question")
    .fill("What does margin of error mean in regular English?")
  await dialog.getByRole("button", { name: "Ask Mr. Kim", exact: true }).click()
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

  await primaryNavigation.getByRole("button", { name: "Practice" }).click()
  await expect(
    page.getByRole("heading", { name: "Choose a practice run." })
  ).toBeVisible()

  await page.getByRole("button", { name: "Open settings" }).click()
  const settings = page.getByRole("dialog", { name: "Settings" })
  await expect(settings).toBeVisible()
  await settings.locator("summary").filter({ hasText: "Study access" }).click()
  await expect(
    settings.getByRole("switch", {
      name: "Reduced motion Stops nonessential movement.",
      exact: true,
    })
  ).toBeVisible()
  await settings
    .locator("summary")
    .filter({ hasText: "Mr. Kim's answers" })
    .click()
  await expect(
    settings.getByRole("switch", {
      name: "Use fewer technical terms Keep answers direct and learner-facing.",
      exact: true,
    })
  ).toBeVisible()
  await settings.getByRole("button", { name: "Close settings" }).click()
  await expect(settings).toBeHidden()
})

test("all lesson stages stay visible and reachable on narrow phones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await openStarterPlan(page)
  await page.getByRole("button", { name: "Open lesson" }).click()

  const stages = page.getByRole("navigation", { name: "Lesson stages" })
  const stageButtons = stages.getByRole("button")
  await expect(stageButtons).toHaveCount(5)

  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await expect
      .poll(() =>
        stages.evaluate((element) => element.scrollWidth - element.clientWidth)
      )
      .toBe(0)

    const stageLayout = await stages.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        left: bounds.left,
        right: bounds.right,
      }
    })
    expect(stageLayout.scrollWidth).toBe(stageLayout.clientWidth)

    for (const button of await stageButtons.all()) {
      await expect(button).toBeVisible()
      const bounds = await button.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.x).toBeGreaterThanOrEqual(stageLayout.left)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(stageLayout.right)
    }
  }

  for (const name of ["Idea", "Example", "Method", "Need to know"]) {
    const stage = stages.getByRole("button", { name })
    await stage.click()
    await expect(stage).toHaveAttribute("aria-current", "step")
  }
})

test("practice keeps scored feedback with its question until Next question", async ({
  page,
}) => {
  await openStarterPlan(page)
  await page.getByRole("button", { name: "Open lesson" }).click()

  const lessonResponse = await page.request.get("/api/learning")
  expect(lessonResponse.ok()).toBeTruthy()
  const lesson = (await lessonResponse.json()) as {
    questions: ReadonlyArray<{
      id: string
      prompt: string
      choices: ReadonlyArray<{ id: string; text: string }>
    }>
    currentQuestionIndex: number
  }
  const stages = page.getByRole("navigation", { name: "Lesson stages" })
  await expect(stages.getByRole("button")).toHaveCount(5)
  await stages.getByRole("button", { name: "Need to know" }).click()

  await page.getByRole("button", { name: "Start focused practice" }).click()
  const current = lesson.questions[lesson.currentQuestionIndex]
  const secureQuestion = ACT_PRACTICE_QUESTIONS.find(
    (question) => question.id === current.id
  )
  expect(secureQuestion).toBeTruthy()
  const wrongChoiceIndex = current.choices.findIndex(
    (choice) => choice.id !== secureQuestion?.correctChoiceId
  )
  expect(wrongChoiceIndex).toBeGreaterThanOrEqual(0)

  const wrongChoice = page
    .getByRole("radiogroup", { name: "Practice answer choices" })
    .getByRole("radio")
    .nth(wrongChoiceIndex)
  await wrongChoice.focus()
  await page.keyboard.press("Space")
  await expect(wrongChoice).toBeChecked()

  const answerResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/learning") &&
      response.request().method() === "POST" &&
      response.ok()
  )
  await page.getByRole("button", { name: "Check answer" }).click()
  const answerResponse = await answerResponsePromise
  const scored = (await answerResponse.json()) as {
    questions: ReadonlyArray<{ id: string; prompt: string }>
    currentQuestionIndex: number
  }
  const next = scored.questions[scored.currentQuestionIndex]

  await expect(
    page.getByRole("heading", { name: current.prompt })
  ).toBeVisible()
  await expect(
    page.getByText(
      `Question ${lesson.currentQuestionIndex + 1} of ${lesson.questions.length}`,
      { exact: true }
    )
  ).toBeVisible()
  await expect(
    page.getByRole("radiogroup", { name: "Scored practice answer choices" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Next question" })
  ).toBeVisible()
  await expect(
    page.locator('[aria-live="polite"]').filter({ hasText: "Not quite." })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Compare choices" })
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Simpler" })).toHaveCount(0)

  await page.getByRole("button", { name: "Next question" }).click()
  await expect(page.getByRole("heading", { name: next.prompt })).toBeVisible()
  await expect(
    page.getByText(
      `Question ${scored.currentQuestionIndex + 1} of ${scored.questions.length}`,
      { exact: true }
    )
  ).toBeVisible()
})

test("timed practice opens at the first question on a narrow phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await openStarterPlan(page)
  await page.request.delete("/api/exam-lab")

  await page
    .getByRole("navigation", { name: "Primary study navigation" })
    .getByRole("button", { name: "Practice" })
    .click()
  await expect(
    page.getByRole("heading", { name: "Choose a practice run." })
  ).toBeVisible()

  const start = page.getByRole("button", { name: "Start timed practice" })
  await start.scrollIntoViewIfNeeded()
  await expect(start).toBeVisible()
  await start.click()

  const questionLabel = page.getByText("Question 1 of 12", { exact: true })
  await expect(questionLabel).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

  const labelBounds = await questionLabel.boundingBox()
  expect(labelBounds).not.toBeNull()
  expect(labelBounds!.y).toBeGreaterThanOrEqual(0)
  expect(labelBounds!.y + labelBounds!.height).toBeLessThan(740)

  await page
    .getByRole("radiogroup", { name: "Exam answer choices" })
    .locator("label")
    .first()
    .click()
  await page.getByRole("button", { name: "Next", exact: true }).click()

  const secondQuestion = page.getByText("Question 2 of 12", { exact: true })
  await expect(secondQuestion).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test("a guest plan survives a refresh on the same device", async ({ page }) => {
  await openStarterPlan(page)
  await page.reload()

  await expect(page.getByTestId("lessons-command-center")).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("ai-act-tutor-placement-v3")
        if (!raw) return null
        return (
          JSON.parse(raw) as {
            guestPlan?: { currentComposite?: number }
          }
        ).guestPlan?.currentComposite
      })
    )
    .toBe(24)
  await expect(
    page.getByText("Your starter plan uses a temporary 18.")
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Sign in / save progress" })
  ).toBeVisible()
})

test("an in-progress full diagnostic resumes, preserves the plan, and keeps Lessons locked", async ({
  page,
}) => {
  await openFullDiagnostic(page)

  const firstAnswer = page
    .getByRole("radiogroup", { name: "Answer choices for question 1" })
    .locator("label")
    .first()
  await firstAnswer.click()
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()

  await page.reload()
  const resumedFirstAnswer = page
    .getByRole("radiogroup", { name: "Answer choices for question 1" })
    .getByRole("radio")
    .first()
  await expect(resumedFirstAnswer).toBeChecked()

  await page.getByRole("button", { name: "Save and exit" }).click()
  await expect(
    page.getByRole("heading", { name: "Find your starting point." })
  ).toBeVisible()
  await expect(page.getByTestId("lessons-command-center")).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("ai-act-tutor-placement-v3")
        if (!raw) return null
        return (
          JSON.parse(raw) as {
            guestPlan?: { currentComposite?: number }
          }
        ).guestPlan?.currentComposite
      })
    )
    .toBe(24)
})

test("diagnostic review makes the first unanswered question the primary action", async ({
  page,
}) => {
  await openFullDiagnostic(page)

  const sessionResponse = await page.request.get("/api/diagnostic")
  expect(sessionResponse.ok()).toBeTruthy()
  const session = (await sessionResponse.json()) as {
    form: {
      id: string
      version: string
      questions: ReadonlyArray<{
        id: string
        choices: ReadonlyArray<{ id: string }>
      }>
    }
  }
  const answers = Object.fromEntries(
    session.form.questions
      .slice(1)
      .map((question) => [question.id, question.choices[0]?.id])
  )
  const saveResponse = await page.request.patch("/api/diagnostic", {
    data: {
      formId: session.form.id,
      formVersion: session.form.version,
      progress: {
        answers,
        currentIndex: session.form.questions.length - 1,
        phase: "review",
      },
    },
  })
  expect(saveResponse.ok()).toBeTruthy()

  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Review your answers." })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Answer first blank" })
  ).toBeVisible()
  await expect(
    page.locator("details").filter({ hasText: "Finish unanswered questions" })
  ).toHaveAttribute("open", "")

  await page.getByRole("button", { name: "Answer first blank" }).click()
  await expect(
    page.getByRole("progressbar", { name: "Diagnostic question 1 of 66" })
  ).toBeVisible()
  const saveResponseAfterBlank = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/diagnostic") &&
      response.request().method() === "PATCH"
  )
  await page
    .getByRole("radiogroup", { name: "Answer choices for question 1" })
    .locator("label")
    .first()
    .click()
  await saveResponseAfterBlank
  await expect(
    page.getByRole("heading", { name: "Review your answers." })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Submit diagnostic" })
  ).toBeVisible()
})

test("full diagnostic moves focus and announces mobile save failures", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await openFullDiagnostic(page)

  const questionHeading = page.getByRole("heading", { level: 1 })
  await expect(questionHeading).toBeFocused()
  const firstPrompt = await questionHeading.textContent()

  let saveResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/diagnostic") &&
      response.request().method() === "PATCH"
  )
  const firstDiagnosticChoice = page
    .getByRole("radiogroup", { name: "Answer choices for question 1" })
    .getByRole("radio")
    .first()
  await firstDiagnosticChoice.focus()
  await page.keyboard.press("Space")
  await expect(firstDiagnosticChoice).toBeChecked()
  await saveResponse

  saveResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/diagnostic") &&
      response.request().method() === "PATCH"
  )
  await page.getByRole("button", { name: "Next question" }).click()
  await saveResponse
  await expect(questionHeading).not.toHaveText(firstPrompt ?? "")
  await expect(questionHeading).toBeFocused()
  const nextHeadingBounds = await questionHeading.boundingBox()
  expect(nextHeadingBounds).not.toBeNull()
  expect(nextHeadingBounds!.y).toBeGreaterThanOrEqual(0)

  saveResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/diagnostic") &&
      response.request().method() === "PATCH"
  )
  await page.getByRole("button", { name: "Previous" }).click()
  await saveResponse
  await expect(questionHeading).toHaveText(firstPrompt ?? "")
  await expect(questionHeading).toBeFocused()

  await page.route("**/api/diagnostic", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Diagnostic save unavailable." }),
      })
      return
    }
    await route.continue()
  })
  const changedDiagnosticChoice = page
    .getByRole("radiogroup", { name: "Answer choices for question 1" })
    .getByRole("radio")
    .nth(1)
  await changedDiagnosticChoice.focus()
  await page.keyboard.press("Space")
  await expect(changedDiagnosticChoice).toBeChecked()

  await expect(
    page.getByRole("alert").filter({
      hasText: "Save failed. Your latest progress may not be saved.",
    })
  ).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ pageWidth: 320, viewportWidth: 320 })
})

test("a calendar review cannot masquerade as the current lesson", async ({
  page,
}) => {
  await openStarterPlan(page)
  await page.getByRole("tab", { name: "My Schedule" }).click()

  const calendarReview = page.getByRole("button", {
    name: /Review · \d+m .+ review/,
  })
  const nextWeek = page.getByRole("button", { name: "Next study week" })
  for (let week = 0; week < 8 && (await calendarReview.count()) === 0; week++) {
    if (await nextWeek.isDisabled()) break
    await nextWeek.click()
  }

  await expect(calendarReview.first()).toBeVisible()
  await calendarReview.first().click()
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
  await page.getByRole("tab", { name: "My Schedule" }).click()

  const dayCards = page.getByTestId("week-day")
  await expect(dayCards).toHaveCount(7)
  const todayCard = dayCards.filter({
    has: page.getByText("Today", { exact: true }),
  })
  await expect(todayCard).toHaveCount(1)
  await expect(todayCard).not.toContainText("No study planned")
  const laptopCards = await dayCards.evaluateAll((cards) =>
    cards.map((card) => {
      const bounds = card.getBoundingClientRect()
      return { width: bounds.width, top: bounds.top }
    })
  )
  expect(Math.min(...laptopCards.map((card) => card.width))).toBeGreaterThan(
    280
  )
  expect(new Set(laptopCards.map((card) => Math.round(card.top))).size).toBe(7)

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

test("incomplete timed practice keeps its honest summary above the mobile fold", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
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
          confidence: "unreported",
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
          confidence: "guess" | "unsure" | "sure" | null
        }>
      }
    }
  }
  const result = finalized.session.result
  expect(result.total).toBeGreaterThan(1)
  expect(result.unanswered).toBe(result.total - 1)
  expect(
    result.review.find((answer) => answer.selectedChoiceId !== null)?.confidence
  ).toBeNull()

  await page
    .getByRole("navigation", { name: "Primary study navigation" })
    .getByRole("button", { name: "Practice" })
    .click()

  await expect(
    page.getByText("Your starter plan uses a temporary 18.")
  ).toHaveCount(0)
  const savedSummary = page.getByRole("heading", {
    name: "Your completed answers are saved for review.",
  })
  await expect(savedSummary).toBeVisible()
  const savedSummaryBounds = await savedSummary.boundingBox()
  expect(savedSummaryBounds).not.toBeNull()
  expect(savedSummaryBounds!.y + savedSummaryBounds!.height).toBeLessThan(740)
  await expect(
    page.getByText("Practice score range", { exact: true })
  ).toHaveCount(0)

  const accuracy = page.getByTestId("timed-practice-answer-accuracy")
  await expect(accuracy).toContainText("Completed answers correct")
  await expect(accuracy).toContainText(`${result.correct} of 1`)
  await expect(
    page.getByText(`${result.unanswered} unanswered`, { exact: true })
  ).toBeVisible()
  await expect(accuracy).not.toContainText("%")
  await expect(
    page.getByText(`${result.total - result.unanswered}/${result.total}`, {
      exact: true,
    })
  ).toBeVisible()

  const answeredSection = result.review.find(
    (answer) => answer.selectedChoiceId !== null
  )?.section
  if (!answeredSection)
    throw new Error("Timed practice did not preserve the completed answer.")
  await expect(
    page.getByTestId(`timed-practice-section-${answeredSection}`)
  ).toContainText(`${result.correct}/1 completed answer`)
})

test("a learner can save a reported-score plan and restore it after sign-in", async ({
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
    name: "Keep your AlexACT progress.",
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
  await page.reload({ waitUntil: "networkidle" })
  await expect(page.getByTestId("lessons-command-center")).toBeVisible()
  await expect(
    page.getByText("Your starter plan uses a temporary 18.")
  ).toHaveCount(0)

  await page.getByRole("button", { name: "Open settings" }).click()
  await page
    .getByRole("dialog", { name: "Settings" })
    .getByRole("button", { name: "Data & privacy" })
    .click()
  await expect(
    page.getByRole("button", { name: "Technical details" })
  ).toHaveCount(0)

  await page.getByRole("button", { name: "E2E Learner" }).click()
  const savedAccount = page.getByRole("dialog", {
    name: "Your progress is saved.",
  })
  await savedAccount.getByRole("button", { name: "Sign out" }).click()
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true })
  ).toBeVisible()

  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  const signIn = page.getByRole("dialog", { name: "Welcome back." })
  await signIn.getByLabel("Username").fill(username)
  await signIn.getByLabel("Password").fill(password)
  await signIn.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByTestId("lessons-command-center")).toBeVisible({
    timeout: 15_000,
  })
  await expect(
    page.getByText("Your starter plan uses a temporary 18.")
  ).toHaveCount(0)
})

test("server-verified developer mode reveals the technical review layer", async ({
  page,
}) => {
  const judgeUsername =
    process.env.SCOUT_DEV_USERNAME ?? process.env.SCOUT_JUDGE_USERNAME
  const judgePassword =
    process.env.SCOUT_E2E_DEV_PASSWORD ??
    process.env.SCOUT_E2E_JUDGE_PASSWORD
  expect(
    judgeUsername,
    "Set SCOUT_DEV_USERNAME for the developer flow."
  ).toBeTruthy()
  expect(
    judgePassword,
    "Set SCOUT_E2E_DEV_PASSWORD for the developer flow."
  ).toBeTruthy()

  await page.addInitScript(() => {
    window.localStorage.setItem("scout-dashboard-tour-v3", "done")
  })
  await page.goto("/")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  const signIn = page.getByRole("dialog", { name: "Welcome back." })
  await signIn.getByLabel("Username").fill(judgeUsername!)
  await signIn.getByLabel("Password").fill(judgePassword!)
  await signIn.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(
    page.getByRole("button", { name: "Developer mode" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Build my starting plan" }).click()
  await page.getByRole("button", { name: "Open the developer demo" }).click()
  await expect(page.getByRole("heading", { name: "Quick Check" })).toBeVisible({
    timeout: 20_000,
  })
  await expect(
    page.getByText("How AlexACT chose this question", { exact: false })
  ).toBeVisible()

  await page.getByRole("button", { name: "Open settings" }).click()
  await page
    .getByRole("dialog", { name: "Settings" })
    .getByRole("button", { name: "Data & privacy" })
    .click()
  await expect(
    page.getByRole("button", { name: "Technical details" })
  ).toBeVisible()
})
