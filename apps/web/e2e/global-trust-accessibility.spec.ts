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

async function expectActionTargetsAtLeast44(
  surface: import("@playwright/test").Locator
) {
  const undersizedTargets = await surface
    .locator("button, summary")
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const bounds = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          bounds.width === 0 ||
          bounds.height === 0
        ) {
          return []
        }
        if (bounds.width >= 44 && bounds.height >= 44) return []
        return [
          {
            label:
              element.getAttribute("aria-label") ??
              element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ??
              element.tagName,
            width: Math.round(bounds.width),
            height: Math.round(bounds.height),
          },
        ]
      })
    )

  expect(undersizedTargets).toEqual([])
}

async function expectNoHorizontalOverflow(
  page: import("@playwright/test").Page
) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        overflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        scrollX: window.scrollX,
      }))
    )
    .toEqual({
      overflow: 0,
      scrollX: 0,
    })
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
  const learningDataNotice = page.getByTestId("learning-data-notice")
  await expect(
    learningDataNotice.getByText("How Scout saves your work")
  ).toBeVisible()
  await learningDataNotice.getByText("How Scout saves your work").click()
  await expect(learningDataNotice).toContainText(
    "this browser keeps your setup, plan, and resume point"
  )
  await expect(learningDataNotice).toContainText(
    "More → Data & privacy to export or delete saved study data"
  )
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

test("the public trust center explains storage, control, and AI limits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto("/trust")

  await expect(
    page.getByRole("heading", {
      name: "What Scout saves—and what it does not.",
    })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Guest progress" })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Account progress" })
  ).toBeVisible()
  await expect(page.getByText(/More → Data & privacy/)).toBeVisible()
  await expect(
    page.getByRole("heading", {
      name: "AI may explain. Evidence makes the decision.",
    })
  ).toBeVisible()
  await expect(page.getByText(/not an official score report/)).toBeVisible()

  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ pageWidth: 320, viewportWidth: 320 })

  await page.getByRole("link", { name: "Back to Scout" }).click()
  await expect(
    page.getByRole("button", { name: "Set up my plan" })
  ).toBeVisible()
})

test("the public explainer makes Scout's adaptive loop inspectable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto("/how-scout-works")

  await expect(
    page.getByRole("heading", {
      name: "Scout uses scored answers to guide what comes after Round 1.",
    })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", {
      name: "One answer, three steps.",
    })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", {
      name: "Quick Check and the full diagnostic do different jobs.",
    })
  ).toBeVisible()
  await page.getByText("Technical details", { exact: true }).click()
  await expect(page.getByText("IRT · question picker")).toBeVisible()
  await expect(page.getByText("BKT · learning estimate")).toBeVisible()
  await expect(page.getByText("AI · explanation")).toBeVisible()
  await expect(page.getByRole("link", { name: "Source code" })).toHaveAttribute(
    "href",
    "https://github.com/Hvcvvbjj/act-tutor--Prelim-My-Version"
  )

  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ pageWidth: 320, viewportWidth: 320 })

  await page
    .getByRole("link", { name: "Data, privacy, and product limits" })
    .click()
  await expect(
    page.getByRole("heading", {
      name: "What Scout saves—and what it does not.",
    })
  ).toBeVisible()
})

test("desktop public pages stay inside a laptop-width viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1117, height: 891 })

  for (const route of ["/how-scout-works", "/trust"]) {
    await page.goto(route)
    await expectNoHorizontalOverflow(page)
  }
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
    const destinationTab = navigation.getByRole("tab", { name: destination })
    await destinationTab.click()
    await expect(destinationTab).toHaveAttribute("aria-selected", "true")
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

  for (const destination of ["Today", "My week", "Progress"]) {
    await page.getByRole("tab", { name: destination }).click()
    await expectNoHorizontalOverflow(page)
  }

  await header.getByRole("button", { name: "More" }).click()
  await page.getByRole("menuitem", { name: "Data & privacy" }).click()
  await expectNoHorizontalOverflow(page)

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

test("learner actions stay comfortably targetable across the core study surfaces", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 })
  await page.goto("/")
  await openStarterPlan(page)

  const today = page.getByRole("tabpanel", { name: "Today" })
  await today.getByText("More study options").click()
  await expectActionTargetsAtLeast44(today)

  await page.getByRole("tab", { name: "My week" }).click()
  await expectActionTargetsAtLeast44(
    page.getByRole("tabpanel", { name: "Week" })
  )

  await page.getByRole("tab", { name: "Progress" }).click()
  await expectActionTargetsAtLeast44(
    page.getByRole("tabpanel", { name: "Progress" })
  )

  await page.setViewportSize({ width: 320, height: 760 })
  await page.getByRole("tab", { name: "Today" }).click()
  const mobileToday = page.getByRole("tabpanel", { name: "Today" })
  await mobileToday.getByText("More study options").click()
  await expectActionTargetsAtLeast44(mobileToday)

  await page.getByRole("tab", { name: "Week" }).click()
  await expectActionTargetsAtLeast44(
    page.getByRole("tabpanel", { name: "Week" })
  )

  await page.getByRole("tab", { name: "Progress" }).click()
  await expectActionTargetsAtLeast44(
    page.getByRole("tabpanel", { name: "Progress" })
  )
  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ pageWidth: 320, viewportWidth: 320 })
})
