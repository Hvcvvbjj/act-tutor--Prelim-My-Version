import { expect, test } from "@playwright/test"

import { openReportedScorePlan } from "./helpers"

test("learner data labels estimate strength and makes deletion cancelable", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 320, height: 760 })
  await openReportedScorePlan(page)

  await page.getByRole("button", { name: "Open settings" }).click()
  await page
    .getByRole("dialog", { name: "Settings" })
    .getByRole("button", { name: "Data & privacy" })
    .click()

  await expect(
    page.getByRole("heading", {
      name: "See and control what Scout saves.",
    })
  ).toBeVisible()
  await expect(page.getByTestId("skill-evidence-status")).toHaveText(
    /(?:Early|Developing|Steadier) estimate/
  )

  await page.getByText("Current skill estimate", { exact: true }).click()
  await expect(
    page.getByText(/scored answers support this skill/)
  ).toBeVisible()
  await expect(
    page.getByText(/not an ACT score or percent correct/)
  ).toBeVisible()

  await page.getByRole("button", { name: "Delete Scout study data" }).click()
  await expect(
    page.getByText(/Delete saved study sessions and the current plan/)
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Confirm study-data deletion" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Cancel deletion" }).click()
  await expect(
    page.getByRole("button", { name: "Delete Scout study data" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Confirm study-data deletion" })
  ).toHaveCount(0)

  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ pageWidth: 320, viewportWidth: 320 })
})
