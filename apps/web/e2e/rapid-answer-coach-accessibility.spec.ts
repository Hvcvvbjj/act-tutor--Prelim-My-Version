import { expect, test, type Page } from "@playwright/test"

async function startFreshDiagnostic(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Build my starting plan" }).click()
  await page.getByRole("button", { name: "Add my starting score" }).click()
  await page.getByRole("radio", { name: "I haven’t taken the ACT" }).check()
  await page.getByRole("button", { name: "Set my schedule" }).click()
  await page
    .getByRole("button", { name: "Continue to full diagnostic" })
    .click()
  await page.getByRole("button", { name: "Start diagnostic" }).click()
  await expect(
    page.getByRole("radiogroup", {
      name: "Answer choices for question 1",
    })
  ).toBeVisible({ timeout: 20_000 })
}

async function answerAndAdvance(
  page: Page,
  count: number,
  answersBeforeFirstQuestion: number
) {
  for (let index = 0; index < count; index += 1) {
    await chooseFirstAnswer(page, answersBeforeFirstQuestion + index + 1)
    await page.getByRole("button", { name: "Next question" }).click()
  }
}

async function chooseFirstAnswer(page: Page, expectedAnswerCount: number) {
  const firstChoice = page
    .getByRole("radiogroup")
    .getByRole("radio")
    .first()
  await expect(firstChoice).toBeVisible({ timeout: 20_000 })
  const save = page.waitForResponse((response) => {
    if (
      !response.url().endsWith("/api/diagnostic") ||
      response.request().method() !== "PATCH"
    ) {
      return false
    }
    const body = response.request().postDataJSON() as {
      progress?: { answers?: Record<string, string> }
    }
    return (
      Object.keys(body.progress?.answers ?? {}).length === expectedAnswerCount
    )
  })
  await firstChoice.press("Space")
  expect((await save).ok()).toBeTruthy()
}

test("a full diagnostic question stays inside a 320px viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await startFreshDiagnostic(page)

  await expect(
    page.getByRole("heading", {
      name: "Which revision of sentence 2 correctly joins its clauses?",
    })
  ).toBeVisible()

  const answerChoices = page.getByRole("radiogroup", {
    name: "Answer choices for question 1",
  })
  const previous = page.getByRole("button", { name: "Previous" })
  const nextQuestion = page.getByRole("button", { name: "Next question" })
  const [answerBounds, previousBounds, nextBounds] = await Promise.all([
    answerChoices.boundingBox(),
    previous.boundingBox(),
    nextQuestion.boundingBox(),
  ])

  for (const bounds of [answerBounds, previousBounds, nextBounds]) {
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
  }
  expect(previousBounds!.width).toBeGreaterThanOrEqual(240)
  expect(nextBounds!.width).toBeGreaterThanOrEqual(240)

  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ pageWidth: 320, viewportWidth: 320 })
})

test("the rapid-answer pace check behaves as a true keyboard modal", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await startFreshDiagnostic(page)
  await answerAndAdvance(page, 9, 0)
  await chooseFirstAnswer(page, 10)

  const dialog = page.getByRole("dialog", {
    name: "Slow down for the next one.",
  })
  const dismiss = dialog.getByRole("button", { name: "I'll slow down" })
  await expect(dialog).toBeVisible()
  await expect(dismiss).toBeFocused()

  await page.keyboard.press("Tab")
  await expect(dismiss).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(dismiss).toBeFocused()

  await page.getByRole("button", { name: "Next question" }).focus()
  await expect(dismiss).toBeFocused()

  const bounds = await dialog.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.width).toBeLessThanOrEqual(358)
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844)
  await page.mouse.click(
    Math.max(1, bounds!.x - 16),
    Math.max(1, bounds!.y - 16)
  )
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("radio").first()).toBeFocused()

  await page.reload()
  await expect(page.getByRole("radiogroup")).toBeVisible({ timeout: 20_000 })
  await page.getByRole("button", { name: "Next question" }).click()
  await answerAndAdvance(page, 9, 10)
  await chooseFirstAnswer(page, 20)
  await expect(dialog).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("radio").first()).toBeFocused()
})
