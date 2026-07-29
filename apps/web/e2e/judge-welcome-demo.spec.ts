import { expect, test } from "@playwright/test"

test("a verified judge can open the demo directly from the welcome screen", async ({
  page,
}) => {
  const judgeUsername = process.env.SCOUT_JUDGE_USERNAME
  const judgePassword = process.env.SCOUT_E2E_JUDGE_PASSWORD
  expect(
    judgeUsername,
    "Set SCOUT_JUDGE_USERNAME for the judge flow."
  ).toBeTruthy()
  expect(
    judgePassword,
    "Set SCOUT_E2E_JUDGE_PASSWORD for the judge flow."
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

  await expect(page.getByRole("button", { name: "Judge view" })).toBeVisible()
  await expect(
    page.getByRole("heading", {
      name: "Your ACT plan starts with a real baseline.",
    })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Choose your ACT goal" })
  ).toHaveCount(0)

  await page.getByRole("button", { name: "Open the judge demo" }).click()
  await expect(page.getByRole("heading", { name: "Quick Check" })).toBeVisible({
    timeout: 20_000,
  })
  await expect(
    page.getByText("How Scout chose this question", { exact: false })
  ).toBeVisible()
})
