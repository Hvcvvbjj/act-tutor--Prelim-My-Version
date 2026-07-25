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
