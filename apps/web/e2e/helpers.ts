import { expect, type Page } from "@playwright/test"

export async function completeLearnerOrientation(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Your starting point is ready." })
  ).toBeVisible()
  await page.getByRole("button", { name: "Start the tour" }).click()

  for (let index = 0; index < 2; index += 1) {
    await page.getByRole("button", { name: "Next feature" }).click()
  }
  await page.getByRole("button", { name: "See my skill profile" }).click()

  const measuredProfileHeading = page.getByRole("heading", {
    name: "Your question-type map.",
  })
  const emptyProfileHeading = page.getByRole("heading", {
    name: "No skill map yet.",
  })
  await expect(measuredProfileHeading.or(emptyProfileHeading)).toBeVisible()
  if (await measuredProfileHeading.isVisible()) {
    for (const title of ["English", "Math", "Reading", "Overall"]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible()
    }
  } else {
    await expect(
      page.getByRole("heading", {
        name: "Your first lessons will create it.",
      })
    ).toBeVisible()
  }

  await page.getByRole("button", { name: "Continue to Mr. Kim" }).click()
  await expect(
    page.getByRole("heading", {
      name: "Want a quick question-type preview?",
    })
  ).toBeVisible()
  await page.getByRole("button", { name: "Start lesson one" }).click()
}
