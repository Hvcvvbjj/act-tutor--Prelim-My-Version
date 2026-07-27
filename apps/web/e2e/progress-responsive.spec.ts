import { expect, test } from "@playwright/test"

import { completeLearnerOrientation } from "./helpers"

async function openStarterPlan(page: import("@playwright/test").Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Set up my plan" }).click()
  await page.getByRole("button", { name: "Add my starting score" }).click()
  await page.getByRole("radio", { name: "I haven’t taken the ACT" }).check()
  await page.getByRole("radio", { name: /Skip for now/ }).check()
  await page.getByRole("button", { name: "Set my schedule" }).click()
  await page.getByRole("button", { name: "Create my starter plan" }).click()
  await completeLearnerOrientation(page)
  await expect(
    page.getByText("Your starter plan uses a temporary 18.")
  ).toBeVisible()
}

test("Progress keeps its skill comparison readable at mobile and desktop sizes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await openStarterPlan(page)
  await page
    .getByRole("navigation", { name: "Primary study navigation" })
    .getByRole("tab", { name: "Progress" })
    .click()

  const overview = page.getByTestId("mobile-mastery-overview")
  const radar = page.getByTestId("mastery-radar")
  await expect(overview).toBeVisible()
  await expect(overview.getByRole("listitem")).toHaveCount(3)
  await expect(overview).toContainText(
    "Each bar averages four skill practice estimates. It is not an ACT section score."
  )
  await expect(overview).toContainText("English")
  await expect(overview).toContainText("Math")
  await expect(overview).toContainText("Reading")
  await expect(overview).toContainText(
    "Starting estimates only · no scored answers yet"
  )
  await expect(radar).toBeHidden()
  await page.getByRole("button", { name: /Ratios and percent/ }).click()
  await expect(
    overview.getByRole("listitem").filter({ hasText: "Math" })
  ).toContainText("Selected skill is here")
  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ pageWidth: 320, viewportWidth: 320 })

  const enlargedText = await page.addStyleTag({
    content: ":root { font-size: 20px !important; }",
  })
  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ pageWidth: 320, viewportWidth: 320 })
  await enlargedText.evaluate((node) => {
    node.parentNode?.removeChild(node)
  })

  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(overview).toBeHidden()
  await expect(radar).toBeVisible()
  const radarBounds = await radar.boundingBox()
  expect(radarBounds).not.toBeNull()
  expect(radarBounds!.width).toBeGreaterThan(400)
})
