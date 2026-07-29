import { expect, test, type Locator } from "@playwright/test"

import { openReportedScorePlan } from "./helpers"

async function expectFingerSizedQuestionButtons(questionButtons: Locator) {
  const sizes = await questionButtons.evaluateAll((buttons) =>
    buttons.map((button) => {
      const bounds = button.getBoundingClientRect()
      return { height: bounds.height, width: bounds.width }
    })
  )

  expect(sizes).toHaveLength(12)
  for (const size of sizes) {
    expect(size.width).toBeGreaterThanOrEqual(44)
    expect(size.height).toBeGreaterThanOrEqual(44)
  }
}

test("timed practice exposes its timer and keeps the question map finger-sized", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 320, height: 740 })
  await openReportedScorePlan(page)
  await page.request.delete("/api/exam-lab")

  await page
    .getByRole("navigation", { name: "Primary study navigation" })
    .getByRole("button", { name: "Practice", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Choose a practice run." })
  ).toBeVisible()
  await page.getByRole("button", { name: "Start timed practice" }).click()

  await expect(
    page.getByRole("timer", {
      name: /Mixed sprint time remaining: \d{2}:\d{2}/,
    })
  ).toBeVisible()

  const questionButtons = page
    .getByRole("navigation", { name: "Question navigator" })
    .getByRole("button")
  await expect(questionButtons).toHaveCount(12)
  await expect(questionButtons.first()).toHaveAttribute("aria-current", "step")
  await expectFingerSizedQuestionButtons(questionButtons)

  await page.setViewportSize({ width: 1280, height: 900 })
  await expectFingerSizedQuestionButtons(questionButtons)
})
