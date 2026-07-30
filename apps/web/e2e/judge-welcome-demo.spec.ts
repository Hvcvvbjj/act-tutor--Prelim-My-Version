import { expect, type Page, test } from "@playwright/test"

async function signInAsJudge(page: Page) {
  const judgeUsername =
    process.env.SCOUT_DEV_USERNAME ?? process.env.SCOUT_JUDGE_USERNAME
  const judgePassword =
    process.env.SCOUT_E2E_DEV_PASSWORD ?? process.env.SCOUT_E2E_JUDGE_PASSWORD
  expect(
    judgeUsername,
    "Set SCOUT_DEV_USERNAME for the developer flow."
  ).toBeTruthy()
  expect(
    judgePassword,
    "Set SCOUT_E2E_DEV_PASSWORD for the developer flow."
  ).toBeTruthy()

  await page.addInitScript(() => {
    window.localStorage.setItem("scout-dashboard-tour-v3", "done")
  })
  await page.goto("/")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  const signIn = page.getByRole("dialog", { name: "Welcome back." })
  await signIn.getByLabel("Username").fill(judgeUsername!)
  await signIn.getByLabel("Password").fill(judgePassword!)
  await signIn.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(
    page.getByRole("button", { name: "Developer mode" })
  ).toBeVisible()
}

test("a verified developer can open the demo directly from the welcome screen", async ({
  page,
}) => {
  await signInAsJudge(page)
  await expect(
    page.getByRole("heading", {
      name: "Your ACT plan starts with a real baseline.",
    })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Choose your ACT goal" })
  ).toHaveCount(0)

  await page.getByRole("button", { name: "Open the developer demo" }).click()
  await expect(page.getByRole("heading", { name: "Quick Check" })).toBeVisible({
    timeout: 20_000,
  })
  await expect(
    page.getByText("How AlexACT chose this question", { exact: false })
  ).toBeVisible()

  const answerChoices = page.getByRole("radiogroup", {
    name: "Answer choices for Quick Check question 8",
  })
  await answerChoices.getByRole("radio").first().press("Space")
  await page.getByRole("button", { name: "Check my answer" }).click()

  await expect(
    page.getByRole("heading", {
      name: "AlexACT updated one skill estimate.",
    })
  ).toBeVisible()
  await expect(
    page.getByText("AlexACT then rechecked your later-round priorities.", {
      exact: false,
    })
  ).toBeVisible()
  await expect(
    page.getByText("Priority unchanged", { exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", {
      name: "AlexACT updated your skill estimates.",
    })
  ).toHaveCount(0)
})

test("a failed developer demo stays on the welcome screen with a retry path", async ({
  page,
}) => {
  await signInAsJudge(page)
  await page.route("**/api/calibration", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Temporary demo reset failure." }),
      })
      return
    }
    await route.continue()
  })

  const demoButton = page.getByRole("button", {
    name: "Open the developer demo",
  })
  await demoButton.click()

  await expect(
    page.getByRole("alert").filter({
      hasText:
        "The developer demo did not open. Try again, or continue with normal setup.",
    })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", {
      name: "Your ACT plan starts with a real baseline.",
    })
  ).toBeVisible()
  await expect(demoButton).toBeEnabled()
  await expect(page.getByRole("heading", { name: "Quick Check" })).toHaveCount(
    0
  )
})
