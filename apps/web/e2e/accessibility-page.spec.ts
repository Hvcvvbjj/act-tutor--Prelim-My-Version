import { expect, test } from "@playwright/test"

test("the public accessibility guide explains real controls and current limits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto("/accessibility")

  await expect(
    page.getByRole("heading", {
      name: "Study tools should adapt to how you work.",
    })
  ).toBeVisible()
  await expect(page.getByText("8 study-access options")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Settings → Study access" })
  ).toBeVisible()
  await expect(
    page.getByText(/not a formal WCAG conformance claim/)
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Report an accessibility issue" })
  ).toHaveAttribute(
    "href",
    "https://github.com/Hvcvvbjj/act-tutor--Prelim-My-Version/issues"
  )

  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ pageWidth: 320, viewportWidth: 320 })

  await page.getByRole("link", { name: "Read data and privacy limits" }).click()
  await expect(
    page.getByRole("heading", {
      name: "What Scout saves—and what it does not.",
    })
  ).toBeVisible()
})
