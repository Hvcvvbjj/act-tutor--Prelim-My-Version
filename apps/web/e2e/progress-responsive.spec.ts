import { expect, test } from "@playwright/test"

import { openReportedScorePlan } from "./helpers"

test("Progress keeps its skill comparison readable at mobile and desktop sizes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await openReportedScorePlan(page)
  await page
    .getByRole("navigation", { name: "Primary study navigation" })
    .getByRole("tab", { name: "Progress" })
    .click()

  const overview = page.getByTestId("mobile-mastery-overview")
  const radar = page.getByTestId("mastery-radar")
  await expect(
    page.getByRole("heading", { name: "Skill map", exact: true })
  ).toBeVisible()
  await expect(overview).toBeVisible()
  await expect(radar).toBeHidden()
  await expect(overview.getByRole("listitem")).toHaveCount(3)
  await expect(overview).toContainText(
    "Each bar averages four skill practice estimates. It is not an ACT section score."
  )
  await expect(overview).toContainText("English")
  await expect(overview).toContainText("Math")
  await expect(overview).toContainText("Reading")
  await expect(overview).toContainText("4 of 4 skills have scored evidence")
  await expect(radar).toBeHidden()
  await page.getByRole("button", { name: /Ratios and percent/ }).click()
  await expect(
    overview.getByRole("listitem").filter({ hasText: "Math" })
  ).toContainText("Selected skill is here")
  const selectedSkillDetail = page.locator("#selected-skill-detail")
  await expect(selectedSkillDetail).toContainText(
    /All \d+ came from your diagnostic\./
  )
  await expect(
    selectedSkillDetail.getByRole("heading", { name: "Latest evidence" })
  ).toBeVisible()
  await expect(selectedSkillDetail).toContainText(
    /Your diagnostic set this estimate from \d+ scored answers?\./
  )
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
