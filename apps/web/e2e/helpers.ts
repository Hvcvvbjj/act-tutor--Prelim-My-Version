import { expect, type Page } from "@playwright/test"

export async function completeLearnerOrientation(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Your starting point is ready." })
  ).toBeVisible()
  await page.getByRole("button", { name: "Start the tour" }).click()

  for (let index = 0; index < 4; index += 1) {
    await page.getByRole("button", { name: "Next feature" }).click()
  }
  await page.getByRole("button", { name: "See my skill profile" }).click()

  await expect(
    page.getByRole("heading", {
      name: "Four honest views of what we know so far.",
    })
  ).toBeVisible()
  for (const title of ["English", "Math", "Reading", "Overall"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible()
  }

  await page.getByRole("button", { name: "Continue to Mr. Kim" }).click()
  await expect(
    page.getByRole("heading", {
      name: "Want the question-type tour, or should we jump in?",
    })
  ).toBeVisible()
  await page.getByRole("button", { name: "Jump into the lessons" }).click()
}
