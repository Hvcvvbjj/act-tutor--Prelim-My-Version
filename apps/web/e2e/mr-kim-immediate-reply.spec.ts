import type {
  ScoutAnswer,
  ScoutExplanationPreferences,
  ScoutMessage,
} from "@act-tutor/core"
import { expect, test } from "@playwright/test"

import { openReportedScorePlan } from "./helpers"

const preferences: ScoutExplanationPreferences = {
  depth: "normal",
  readingLevel: "standard",
  exampleStyle: "everyday",
  fewerTechnicalTerms: true,
}

const reviewedAnswer: ScoutAnswer = {
  summary: "A comma alone cannot join two complete sentences.",
  explanation:
    "Check whether both sides can stand alone. If they can, use a period, a semicolon, or a comma with a joining word.",
  example: "The bell rang; class began.",
  technical: "Reviewed sentence-boundary lesson guidance.",
  nextAction: "Check each side of the sentence before choosing punctuation.",
  source: "Reviewed AlexACT sentence-boundary lesson",
  mode: "grounded",
  receipt: {
    questionId: null,
    skillId: "sentence-boundaries",
    permissions: ["CAN_REPHRASE", "CAN_DEFINE"],
    checks: ["reviewed-source"],
    delivery: "reviewed-rule",
    assistanceMode: "study",
    intent: "rule",
  },
}

test("a reviewed Mr. Kim reply appears before optional AI and survives its failure", async ({
  page,
}) => {
  let askedQuestion = ""
  const messages: ScoutMessage[] = []

  await page.route("**/vendor/puter-v2.5.4.js", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `
        window.__mrKimEnhancement = { started: false };
        window.puter = {
          auth: {
            isSignedIn: () => true,
            signIn: async () => undefined,
          },
          ai: {
            chat: () => {
              window.__mrKimEnhancement.started = true;
              return new Promise((resolve, reject) => {
                window.__mrKimEnhancement.reject = () =>
                  reject(new Error("Optional AI unavailable"));
              });
            },
          },
        };
      `,
    })
  })

  await page.route("**/api/scout/ask", async (route) => {
    const request = route.request()
    if (request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          aiAvailable: false,
          messages,
          preferences,
          preferencesVersion: 2,
          preferencesUpdatedAt: "2026-07-29T12:00:00.000Z",
        }),
      })
      return
    }

    if (request.method() === "POST") {
      const body = request.postDataJSON() as { question: string; screen: string }
      askedQuestion = body.question
      const message: ScoutMessage = {
        id: "reviewed-answer-1",
        askedAt: "2026-07-29T12:01:00.000Z",
        screen: "today",
        question: body.question,
        answer: reviewedAnswer,
      }
      messages.push(message)
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          aiAvailable: false,
          answer: reviewedAnswer,
          messages,
          preferences,
          preferencesVersion: 2,
          preferencesUpdatedAt: "2026-07-29T12:00:00.000Z",
        }),
      })
      return
    }

    await route.continue()
  })

  await openReportedScorePlan(page)

  await page.getByRole("button", { name: "Ask Mr. Kim" }).first().click()
  const dialog = page.getByRole("dialog", { name: "Ask Mr. Kim" })
  const question = "Why can’t a comma join these two sentences?"
  await dialog.getByLabel("Your question").fill(question)
  await dialog.getByRole("button", { name: "Ask Mr. Kim", exact: true }).click()

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              __mrKimEnhancement?: { started: boolean }
            }
          ).__mrKimEnhancement?.started ?? false
      )
    )
    .toBe(true)
  expect(askedQuestion).toBe(question)

  await expect(dialog.getByText(question, { exact: true })).toBeVisible()
  await expect(
    dialog.getByText(reviewedAnswer.summary, { exact: true })
  ).toBeVisible()
  await expect(
    dialog.getByText(reviewedAnswer.explanation, { exact: true })
  ).toBeVisible()
  await expect(
    dialog.getByText("Free AI is writing a grounded answer…", { exact: true })
  ).toBeVisible()

  await page.evaluate(() => {
    ;(
      window as Window & {
        __mrKimEnhancement?: { reject?: () => void }
      }
    ).__mrKimEnhancement?.reject?.()
  })

  await expect(
    dialog.getByText("Reviewed AlexACT guidance", { exact: true })
  ).toBeVisible()
  await expect(
    dialog.getByText(reviewedAnswer.summary, { exact: true })
  ).toBeVisible()
  await expect(
    dialog.getByText(reviewedAnswer.explanation, { exact: true })
  ).toBeVisible()
})
