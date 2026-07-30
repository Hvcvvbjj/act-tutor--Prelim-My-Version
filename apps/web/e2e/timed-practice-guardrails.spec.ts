import { expect, test } from "@playwright/test"

import { openReportedScorePlan } from "./helpers"

test("timed practice explains its boundaries before starting", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 320, height: 760 })
  await openReportedScorePlan(page)

  await page.getByRole("button", { name: "Practice", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Choose a practice run." })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Question help pauses." })
  ).toBeVisible()
  await expect(page.getByText(/not answers, rules, hints/)).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Your plan stays put." })
  ).toBeVisible()
  await expect(
    page.getByText("They do not update Lessons or My Schedule.", {
      exact: false,
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

  await page.getByRole("button", { name: "Start timed practice" }).click()
  await expect(page.getByText("No correctness during the run.")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Review and finish section" })
  ).toBeVisible()
})
