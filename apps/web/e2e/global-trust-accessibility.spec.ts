import { expect, test } from "@playwright/test"

import { completeLearnerOrientation } from "./helpers"

async function openStarterPlan(page: import("@playwright/test").Page) {
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

async function expectSkipLinkToFocusMain(
  page: import("@playwright/test").Page
) {
  const skipLink = page.getByRole("link", { name: "Skip to main content" })
  await skipLink.focus()
  await page.keyboard.press("Enter")
  await expect(page.locator("main#main-content")).toBeFocused()
}

test("the welcome screen states product identity and independence clearly", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Set up my plan" })
  ).toBeVisible()

  await expect(page.getByText("Meet Scout, your study coach")).toBeVisible()
  await expect(page.getByText(/Mr\. Kim/)).toHaveCount(0)
  const productNotes = page.getByRole("contentinfo")
  await expect(productNotes).toContainText("Independent hackathon project.")
  await expect(productNotes).toContainText(
    "Scout ACT is not affiliated with or endorsed by ACT."
  )
  await expect(productNotes).toContainText(
    "learning estimates—not official ACT results"
  )

  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ pageWidth: 390, viewportWidth: 390 })
})

test("the skip link is first and follows the active study surface", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Set up my plan" })
  ).toBeVisible()

  await page.keyboard.press("Tab")
  const skipLink = page.getByRole("link", { name: "Skip to main content" })
  await expect(skipLink).toBeFocused()
  await expect(skipLink).toBeInViewport()
  await page.keyboard.press("Enter")
  await expect(page.locator("main#main-content")).toBeFocused()

  await openStarterPlan(page)
  const navigation = page.getByRole("navigation", {
    name: "Primary study navigation",
  })
  await expect(page.locator("#main-content")).toHaveCount(1)
  await expectSkipLinkToFocusMain(page)
  for (const destination of ["Week", "Check", "Progress"]) {
    await navigation.getByRole("tab", { name: destination }).click()
    await expect(page.locator("#main-content")).toHaveCount(1)
    await expectSkipLinkToFocusMain(page)
  }
})

test("compact desktop navigation keeps primary controls easy to target", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto("/")
  await openStarterPlan(page)

  const header = page.locator("header")
  const targets = [
    page.getByRole("tab", { name: "Today" }),
    page.getByRole("tab", { name: "My week" }),
    page.getByRole("tab", { name: "Quick Check" }),
    page.getByRole("tab", { name: "Progress" }),
    header.getByRole("button", { name: "More" }),
    header.getByRole("button", { name: "Ask Scout" }),
    header.getByRole("button", { name: "Sign in / save progress" }),
  ]

  for (const target of targets) {
    const bounds = await target.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.height).toBeGreaterThanOrEqual(44)
    expect(bounds!.width).toBeGreaterThanOrEqual(44)
  }

  await header.getByRole("button", { name: "More" }).click()
  const goalAndSchedule = page.getByRole("menuitem", {
    name: "Goal and schedule",
  })
  const goalBounds = await goalAndSchedule.boundingBox()
  expect(goalBounds).not.toBeNull()
  expect(goalBounds!.height).toBeGreaterThanOrEqual(44)
  await header.getByRole("button", { name: "More" }).click()

  await header.getByRole("button", { name: "Sign in / save progress" }).click()
  const account = page.getByRole("dialog", { name: "Welcome back." })
  for (const label of ["Username", "Password"]) {
    const bounds = await account.getByLabel(label).boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.height).toBeGreaterThanOrEqual(44)
  }

  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ pageWidth: 1024, viewportWidth: 1024 })
})
