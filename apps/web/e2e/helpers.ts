import type { DiagnosticSessionPayload } from "@act-tutor/core"
import { expect, type Page } from "@playwright/test"

export async function completeServerDiagnostic(page: Page) {
  const sessionResponse = await page.request.get("/api/diagnostic")
  expect(sessionResponse.ok()).toBeTruthy()
  const session = (await sessionResponse.json()) as DiagnosticSessionPayload
  const answers = session.form.questions.map((question) => {
    const firstChoice = question.choices[0]
    expect(
      firstChoice,
      `Question ${question.id} needs an answer choice.`
    ).toBeDefined()
    return {
      questionId: question.id,
      choiceId: firstChoice!.id,
    }
  })
  const resultResponse = await page.request.post("/api/diagnostic", {
    data: {
      formId: session.form.id,
      formVersion: session.form.version,
      answers,
    },
  })
  expect(resultResponse.ok()).toBeTruthy()
  const completed = (await resultResponse.json()) as DiagnosticSessionPayload
  expect(completed.status).toBe("completed")
  expect(completed.result).not.toBeNull()
  return completed
}

export async function completeLearnerOrientation(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Your starting score is ready." })
  ).toBeVisible()
  await page.getByRole("button", { name: "Continue" }).click()
  const profileHeading = page.getByRole("heading", {
    name: /^(Your question-type map\.|Your score is set\. The skill map starts empty\.)$/,
  })
  const tourDialog = page.getByRole("dialog", {
    name: /AlexACT dashboard tour/,
  })
  await expect(profileHeading.or(tourDialog)).toBeVisible({ timeout: 25_000 })
  if (await tourDialog.isVisible()) {
    await tourDialog.getByRole("button", { name: "Skip website tour" }).click()
  }

  await expect(profileHeading).toBeVisible()
  for (const title of ["English", "Math", "Reading", "Overall"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible()
  }

  await page.getByRole("button", { name: "Continue to Mr. Kim" }).click()
  await expect(
    page.getByRole("heading", {
      name: "Want me to teach the 12 question types first?",
    })
  ).toBeVisible()
  await page.getByRole("button", { name: "Start lesson one" }).click()
  await expect(page.getByTestId("lessons-command-center")).toBeVisible({
    timeout: 15_000,
  })
}

export async function openReportedScorePlan(page: Page, composite = 24) {
  await page.addInitScript(
    ({ startingScore }) => {
      window.localStorage.setItem("scout-dashboard-tour-v3", "done")
      for (const section of ["english", "math", "reading"]) {
        window.localStorage.setItem(
          `scout-goal-support-${startingScore}-30-${section}`,
          "seen"
        )
      }
    },
    { startingScore: composite }
  )
  await page.goto("/")
  await page.getByRole("button", { name: "Build my starting plan" }).click()
  await page.getByRole("button", { name: "Add my starting score" }).click()
  await page.getByRole("radio", { name: "I only know my Composite" }).check()
  await page
    .getByRole("spinbutton", { name: "Composite ACT score" })
    .fill(String(composite))
  await page.getByRole("button", { name: "Set my schedule" }).click()
  await page
    .getByRole("button", { name: "Continue to full diagnostic" })
    .click()
  await expect(
    page.getByRole("heading", { name: "Find your starting point." })
  ).toBeVisible()
  await expect(
    page.getByText("Your score is set. The skill map starts empty.", {
      exact: true,
    })
  ).toBeVisible()

  await completeServerDiagnostic(page)

  await page.reload()
  await expect(
    page.getByRole("button", { name: "Start diagnostic" })
  ).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: /^Your starting estimate is \d+\.$/ })
  ).toBeVisible()
  await page.getByRole("button", { name: "Continue" }).click()
  await completeLearnerOrientation(page)
}
