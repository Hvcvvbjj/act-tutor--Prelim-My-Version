import { expect, test } from "@playwright/test"

import { openReportedScorePlan } from "./helpers"

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

test("the welcome screen leads with a real baseline and Mr. Kim", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Build my starting plan" })
  ).toBeVisible()

  await expect(
    page.getByRole("heading", {
      name: "Your ACT plan starts with a real baseline.",
    })
  ).toBeVisible()
  await expect(page.getByText(/full 66-question diagnostic/)).toBeVisible()
  await expect(
    page.getByText(/Mr\. Kim can turn\s+the result into lessons/)
  ).toBeVisible()
  const welcomeProof = page.getByRole("list", {
    name: "What AlexACT shows after one scored answer",
  })
  await expect(
    page.getByText("One answer. Three visible results.", { exact: true })
  ).toBeVisible()
  await expect(welcomeProof.getByText("Match updated")).toBeVisible()
  await expect(welcomeProof.getByText("One estimate updated")).toBeVisible()
  await expect(welcomeProof.getByText("Later priority rechecked")).toBeVisible()
  await expect(
    page.getByText("Next lesson + week", { exact: true })
  ).toHaveCount(0)
  await expect(page.getByTestId("learning-data-notice")).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "See one answer change the plan" })
  ).toHaveCount(0)
  const signInButton = page.getByRole("button", {
    name: "Sign in",
    exact: true,
  })
  await expect(signInButton).toBeVisible()
  await expect(signInButton.getByText("Sign in", { exact: true })).toBeVisible()

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
      name: "What AlexACT saves—and what it does not.",
    })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Guest progress" })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Account progress" })
  ).toBeVisible()
  await expect(page.getByText(/Settings → Data & privacy/)).toBeVisible()
  await expect(
    page.getByRole("heading", {
      name: "AI may explain. Evidence makes the decision.",
    })
  ).toBeVisible()
  await expect(page.getByText(/not an official score report/)).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Optional free cloud enhancement" })
  ).toBeVisible()
  await expect(page.getByText(/sign in to Puter/)).toBeVisible()

  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
    )
    .toEqual({ pageWidth: 320, viewportWidth: 320 })

  await page.getByRole("link", { name: "Back to AlexACT" }).click()
  await expect(
    page.getByRole("button", { name: "Build my starting plan" })
  ).toBeVisible()
})

test("the public explainer makes AlexACT's adaptive loop inspectable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto("/how-scout-works")

  await expect(
    page.getByRole("heading", {
      name: "AlexACT uses scored answers to guide what comes after Round 1.",
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
      name: "What AlexACT saves—and what it does not.",
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
    page.getByRole("button", { name: "Build my starting plan" })
  ).toBeVisible()

  await page.keyboard.press("Tab")
  const skipLink = page.getByRole("link", { name: "Skip to main content" })
  await expect(skipLink).toBeFocused()
  await expect(skipLink).toBeInViewport()
  await page.keyboard.press("Enter")
  await expect(page.locator("main#main-content")).toBeFocused()

  await openReportedScorePlan(page)
  const navigation = page.getByRole("navigation", {
    name: "Primary study navigation",
  })
  await expect(page.locator("#main-content")).toHaveCount(1)
  await expectSkipLinkToFocusMain(page)
  for (const destination of ["Schedule", "Progress", "Badges"]) {
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
  await openReportedScorePlan(page)

  const header = page.locator("header")
  const targets = [
    header.getByRole("tab", { name: "Lessons" }),
    header.getByRole("tab", { name: "My Schedule" }),
    header.getByRole("button", { name: "Timed Practice" }),
    header.getByRole("tab", { name: "Progress" }),
    header.getByRole("tab", { name: "History" }),
    header.getByRole("tab", { name: "Badges" }),
    header.getByRole("button", { name: "Ask Mr. Kim" }),
    header.getByRole("button", { name: "Open settings" }),
    header.getByRole("button", { name: "Sign in / save progress" }),
  ]

  for (const target of targets) {
    const bounds = await target.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.height).toBeGreaterThanOrEqual(44)
    expect(bounds!.width).toBeGreaterThanOrEqual(44)
  }

  await expect(header.getByRole("button", { name: "More" })).toHaveCount(0)
  await expect(
    page.getByRole("menu", { name: "More from AlexACT" })
  ).toHaveCount(0)

  await expect(
    header.getByRole("button", { name: "Full Diagnostic" })
  ).toHaveCount(0)

  for (const destination of [
    "Lessons",
    "My Schedule",
    "Progress",
    "History",
    "Badges",
  ]) {
    await page.getByRole("tab", { name: destination }).click()
    await expectNoHorizontalOverflow(page)
  }
  await expect(header.getByRole("tab", { name: "Needs Work" })).toHaveCount(0)

  await header.getByRole("button", { name: "Open settings" }).click()
  const settings = page.getByRole("dialog", { name: "Settings" })
  await settings.getByRole("button", { name: "Data & privacy" }).click()
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

test("the desktop tour scrolls to and precisely spotlights the real lesson action", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1100, height: 700 })
  await openReportedScorePlan(page)

  await page.getByRole("button", { name: "Open settings" }).click()
  await page
    .getByRole("dialog", { name: "Settings" })
    .getByRole("button", { name: "Replay website tour" })
    .click()

  const tour = page.getByRole("dialog", {
    name: "AlexACT dashboard tour, step 1 of 9",
  })
  await expect(tour).toBeVisible()
  await tour.getByRole("button", { name: "Next" }).click()
  await expect(
    page.getByRole("dialog", {
      name: "AlexACT dashboard tour, step 2 of 9",
    })
  ).toBeVisible()

  const action = page.locator('[data-tour-id="lesson-action"]')
  const spotlight = page.locator('[data-tour-spotlight="lesson-action"]')
  await expect(action).toBeInViewport()
  await expect(spotlight).toBeVisible()
  await expect
    .poll(async () => {
      const [actionBox, spotlightBox] = await Promise.all([
        action.boundingBox(),
        spotlight.boundingBox(),
      ])
      if (!actionBox || !spotlightBox) return Number.POSITIVE_INFINITY
      const centerDeltaX = Math.abs(
        actionBox.x +
          actionBox.width / 2 -
          (spotlightBox.x + spotlightBox.width / 2)
      )
      const centerDeltaY = Math.abs(
        actionBox.y +
          actionBox.height / 2 -
          (spotlightBox.y + spotlightBox.height / 2)
      )
      return Math.max(centerDeltaX, centerDeltaY)
    })
    .toBeLessThanOrEqual(1)

  const actionBox = await action.boundingBox()
  expect(actionBox).not.toBeNull()
  expect(actionBox!.y).toBeGreaterThanOrEqual(0)
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(700)
})

test("learner actions stay comfortably targetable across the core study surfaces", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1024, height: 800 })
  await openReportedScorePlan(page)

  const lessons = page.getByRole("tabpanel", { name: "Lessons" })
  await expect(
    lessons.getByRole("complementary").getByText("Up next", { exact: true })
  ).toBeVisible()
  await expectActionTargetsAtLeast44(lessons)

  await page.getByRole("tab", { name: "My Schedule" }).click()
  await expectActionTargetsAtLeast44(
    page.getByRole("tabpanel", { name: "My Schedule" })
  )

  await page.getByRole("tab", { name: "Progress" }).click()
  await expectActionTargetsAtLeast44(
    page.getByRole("tabpanel", { name: "Progress" })
  )

  await page.setViewportSize({ width: 320, height: 760 })
  await page.getByRole("tab", { name: "Lessons" }).click()
  const mobileLessons = page.getByRole("tabpanel", { name: "Lessons" })
  await expect(
    mobileLessons
      .getByRole("complementary")
      .getByText("Up next", { exact: true })
  ).toBeVisible()
  await expectActionTargetsAtLeast44(mobileLessons)

  await page.getByRole("tab", { name: "Schedule" }).click()
  await expectActionTargetsAtLeast44(
    page.getByRole("tabpanel", { name: "Schedule" })
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
