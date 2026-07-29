import { expect, test } from "@playwright/test"

test("the public explainer separates reproducible evidence from outcome claims", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto("/how-scout-works")

  await expect(
    page.getByRole("heading", {
      name: "A demo should prove behavior—not promise an outcome.",
    })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "What this demo demonstrates" })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "What Scout does not claim" })
  ).toBeVisible()
  await expect(
    page.getByText(
      "Guaranteed score improvement or proof that a learner will reach a target."
    )
  ).toBeVisible()

  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ pageWidth: 320, viewportWidth: 320 })

  await page
    .getByRole("link", { name: "Read data, AI, and product limits" })
    .click()
  await expect(page).toHaveURL(/\/trust$/)
  await expect(
    page.getByRole("heading", {
      name: "What Scout saves—and what it does not.",
    })
  ).toBeVisible()
})
