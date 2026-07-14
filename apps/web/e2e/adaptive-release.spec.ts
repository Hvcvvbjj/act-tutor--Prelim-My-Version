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
  expect(rebased.learning.questions.every(
    (question: { skill: string }) => question.skill === rebased.learning.todaySkill
  )).toBeTruthy()
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

test("mobile study navigation fits and Scout behaves as a focus-trapped bottom sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto("/")
  await page
    .getByRole("button", { name: "See one answer change the plan" })
    .click()
  await expect(page.getByText("Quick Check", { exact: true }).first()).toBeVisible()

  const primaryNavigation = page.getByRole("navigation", {
    name: "Primary study navigation",
  })
  await expect(primaryNavigation.getByRole("tab")).toHaveCount(4)

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
  await expect(dialog).toContainText(/planning range/i)

  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab")
    expect(
      await dialog.evaluate((node) => node.contains(document.activeElement))
    ).toBeTruthy()
  }

  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(launcher).toBeFocused()
})
