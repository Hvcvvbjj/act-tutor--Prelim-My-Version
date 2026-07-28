import { expect, test, type Page } from "@playwright/test"

const PAST_TEST_DATE = "2026-07-20"
const NEXT_TEST_DATE = "2026-09-12"

async function seedPastTestPlan(page: Page) {
  await page.addInitScript(
    ({ pastTestDate }) => {
      const draft = {
        goal: 30,
        priorScoreChoice: "scores",
        scoreSource: "official",
        startingCheckChoice: "take",
        composite: 22,
        english: 21,
        math: 22,
        reading: 23,
        scienceEnabled: false,
        science: 0,
        testDate: pastTestDate,
        studyDaysPerWeek: 3,
        minutesPerSession: 30,
        preferredSection: "balanced",
      }
      const guestPlan = {
        version: 2,
        savedAt: "2026-07-20T12:00:00.000Z",
        draft,
        evidence: {
          source: "section_scores",
          reportedComposite: 22,
          calculatedComposite: 22,
          reportedSections: { english: 21, math: 22, reading: 23 },
          planningBaseline: { english: 21, math: 22, reading: 23 },
          science: null,
          confidence: "medium",
          compositeDifference: 0,
        },
        currentComposite: 22,
        profileSkillResults: [],
        journey: {
          version: 1,
          tourVersion: 1,
          onboardingCompleted: true,
          lessonEntryChoice: "start-lessons",
          officialScoreHistory: [],
          pendingOfficialScores: [],
          baselineOfficialComposite: 22,
          checkInSnoozedUntil: null,
          doneForNow: false,
        },
        adaptiveBaselineRequired: false,
        baselineSkipped: false,
      }
      window.localStorage.setItem(
        "ai-act-tutor-placement-v3",
        JSON.stringify({
          version: 5,
          draft,
          guestPlan,
          viewerRole: "guest",
          resumeSurface: null,
        })
      )
    },
    { pastTestDate: PAST_TEST_DATE }
  )
}

test("Mr. Kim compares a reported score with the official onboarding baseline", async ({
  page,
}) => {
  await seedPastTestPlan(page)
  await page.goto("/")

  await expect(
    page.getByRole("heading", { name: /How did your July 20, 2026 test go/ })
  ).toBeVisible()
  await expect(page.getByText("Last official Composite")).toHaveCount(0)

  await page.getByText("I tested and have my scores", { exact: true }).click()
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel("Composite").fill("26")
  await page.getByRole("button", { name: "Continue" }).click()

  await expect(
    page.getByRole("heading", { name: "You moved up 4 points." })
  ).toBeVisible()
  await page.getByText("I’m done for now", { exact: true }).click()
  await page.getByRole("button", { name: "Save check-in" }).click()

  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = JSON.parse(
          window.localStorage.getItem("ai-act-tutor-placement-v3") ?? "{}"
        )
        return saved.guestPlan?.journey?.officialScoreHistory?.[0]?.composite
      })
    )
    .toBe(26)
})

test("a pending official score survives a new test date and prompts again", async ({
  page,
}) => {
  await seedPastTestPlan(page)
  await page.goto("/")

  await page.getByText("I tested; scores aren’t back", { exact: true }).click()
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(
    page.getByRole("heading", { name: "No need to guess." })
  ).toBeVisible()
  await page.getByText("Yes—add my next date", { exact: true }).click()
  await page.getByLabel("Next ACT date").fill(NEXT_TEST_DATE)
  await page.getByRole("button", { name: "Save check-in" }).click()

  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = JSON.parse(
          window.localStorage.getItem("ai-act-tutor-placement-v3") ?? "{}"
        )
        return {
          nextDate: saved.guestPlan?.draft?.testDate,
          pendingDate:
            saved.guestPlan?.journey?.pendingOfficialScores?.[0]?.testDate,
        }
      })
    )
    .toEqual({
      nextDate: NEXT_TEST_DATE,
      pendingDate: PAST_TEST_DATE,
    })

  await page.evaluate(() => {
    const key = "ai-act-tutor-placement-v3"
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "{}")
    saved.guestPlan.journey.pendingOfficialScores[0].nextPromptOn = "2026-07-26"
    window.localStorage.setItem(key, JSON.stringify(saved))
  })
  await page.reload()

  await expect(
    page.getByRole("heading", { name: /How did your July 20, 2026 test go/ })
  ).toBeVisible()
})
