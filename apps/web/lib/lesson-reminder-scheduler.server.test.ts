import type { AdaptiveStudyPlan } from "@act-tutor/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_LESSON_REMINDER_PREFERENCES,
  type LessonReminderPreferences,
} from "@/lib/auth-types"

const mocks = vi.hoisted(() => ({
  listSubscriptions: vi.fn(),
  getStudyPlan: vi.fn(),
  claimDelivery: vi.fn(),
  completeDelivery: vi.fn(),
  releaseDelivery: vi.fn(),
  deliver: vi.fn(),
}))

vi.mock("@/lib/auth.server", () => ({
  listLessonReminderSubscriptions: mocks.listSubscriptions,
  claimLessonReminderDelivery: mocks.claimDelivery,
  completeLessonReminderDelivery: mocks.completeDelivery,
  releaseLessonReminderDelivery: mocks.releaseDelivery,
}))

vi.mock("@/lib/study-plan.server", () => ({
  studyPlanSessions: { get: mocks.getStudyPlan },
}))

vi.mock("@/lib/reminder-delivery.server", () => ({
  deliverLessonReminder: mocks.deliver,
}))

import {
  dispatchScheduledLessonReminders,
  reminderTargetDate,
  tasksForLessonReminder,
} from "./lesson-reminder-scheduler.server"

const EMAIL_PREFERENCES: LessonReminderPreferences = {
  ...DEFAULT_LESSON_REMINDER_PREFERENCES,
  enabled: true,
  emailEnabled: true,
  emailAddress: "student@example.com",
  upcomingTiming: "one-day-before",
  overdueTiming: "same-day",
  consentedAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
}

const PLAN = {
  version: 1,
  copyVersion: 2,
  today: "2026-07-29",
  testDate: "2026-09-19",
  current: { english: 24, math: 24, reading: 24 },
  target: { english: 30, math: 30, reading: 30 },
  availability: { entries: [{ weekday: "thu", minutes: 30 }] },
  skills: [],
  tasks: [
    {
      id: "2026-07-30-0-lesson-boundaries",
      date: "2026-07-30",
      slot: 0,
      kind: "lesson",
      title: "Sentence boundaries lesson",
      section: "english",
      skill: "sentence-boundaries",
      skillLabel: "Sentence boundaries",
      minutes: 30,
      reason: "Scheduled practice.",
      status: "scheduled",
      locked: false,
      completedAt: null,
    },
    {
      id: "2026-07-28-0-review-boundaries",
      date: "2026-07-28",
      slot: 0,
      kind: "review",
      title: "Sentence boundaries review",
      section: "english",
      skill: "sentence-boundaries",
      skillLabel: "Sentence boundaries",
      minutes: 20,
      reason: "Missed review.",
      status: "skipped",
      locked: false,
      completedAt: null,
    },
    {
      id: "2026-07-30-1-review-complete",
      date: "2026-07-30",
      slot: 1,
      kind: "review",
      title: "Completed review",
      section: "english",
      skill: "sentence-boundaries",
      skillLabel: "Sentence boundaries",
      minutes: 15,
      reason: "Already complete.",
      status: "complete",
      locked: false,
      completedAt: "2026-07-29T12:00:00.000Z",
    },
  ],
  milestones: [],
  forecast: {
    health: "on-track",
    weeklyCapacity: 150,
    scheduledMinutes: 50,
    recommendedMinutes: 50,
    capacityRatio: 1,
    completionRate: 0,
    readiness: 0.5,
    evidenceCoverage: 0.5,
    message: "On track.",
  },
  revision: 1,
  revisionReason: "Initial plan.",
  generatedAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
} satisfies AdaptiveStudyPlan

beforeEach(() => {
  mocks.listSubscriptions.mockReset()
  mocks.getStudyPlan.mockReset()
  mocks.claimDelivery.mockReset()
  mocks.completeDelivery.mockReset()
  mocks.releaseDelivery.mockReset()
  mocks.deliver.mockReset()
  mocks.listSubscriptions.mockResolvedValue([
    {
      accountId: "account-1",
      displayName: "Alex",
      studyPlanSessionId: "plan-1",
      preferences: EMAIL_PREFERENCES,
    },
  ])
  mocks.getStudyPlan.mockResolvedValue(PLAN)
  mocks.claimDelivery.mockResolvedValue({
    accountId: "account-1",
    deliveryKey: "reminder:v1:upcoming:2026-07-30:email",
    claimToken: "claim-1",
  })
  mocks.completeDelivery.mockResolvedValue(true)
  mocks.releaseDelivery.mockResolvedValue(true)
  mocks.deliver.mockResolvedValue({ email: "sent", sms: "disabled" })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("scheduled lesson reminders", () => {
  it("selects the requested upcoming day and the first overdue day", () => {
    expect(
      reminderTargetDate(EMAIL_PREFERENCES, "upcoming", "2026-07-29")
    ).toBe("2026-07-30")
    expect(reminderTargetDate(EMAIL_PREFERENCES, "overdue", "2026-07-29")).toBe(
      "2026-07-28"
    )
    expect(
      tasksForLessonReminder(
        PLAN,
        EMAIL_PREFERENCES,
        "upcoming",
        "2026-07-29"
      ).map((task) => task.id)
    ).toEqual(["2026-07-30-0-lesson-boundaries"])
    expect(
      tasksForLessonReminder(
        PLAN,
        EMAIL_PREFERENCES,
        "overdue",
        "2026-07-29"
      ).map((task) => task.id)
    ).toEqual(["2026-07-28-0-review-boundaries"])
  })

  it("claims and records each due reminder without returning user data", async () => {
    const summary = await dispatchScheduledLessonReminders({
      today: "2026-07-29",
      now: "2026-07-29T14:00:00.000Z",
    })

    expect(summary).toEqual({
      scannedSubscriptions: 1,
      dueBatches: 2,
      missingPlans: 0,
      claimsSkipped: 0,
      sent: { email: 2, sms: 0 },
      notConfigured: { email: 0, sms: 0 },
      failed: { email: 0, sms: 0 },
    })
    expect(mocks.claimDelivery).toHaveBeenCalledTimes(2)
    expect(mocks.completeDelivery).toHaveBeenCalledTimes(2)
    expect(mocks.releaseDelivery).not.toHaveBeenCalled()
    expect(JSON.stringify(summary)).not.toContain("student@example.com")
    expect(JSON.stringify(summary)).not.toContain("Alex")
  })

  it("does not call a provider when another cron already owns the claim", async () => {
    mocks.claimDelivery.mockResolvedValue(null)

    const summary = await dispatchScheduledLessonReminders({
      today: "2026-07-29",
      now: "2026-07-29T14:00:00.000Z",
    })

    expect(summary.claimsSkipped).toBe(2)
    expect(mocks.deliver).not.toHaveBeenCalled()
    expect(mocks.completeDelivery).not.toHaveBeenCalled()
  })

  it("releases a claim when provider credentials are not configured", async () => {
    mocks.deliver.mockResolvedValue({
      email: "not_configured",
      sms: "disabled",
    })

    const summary = await dispatchScheduledLessonReminders({
      today: "2026-07-29",
      now: "2026-07-29T14:00:00.000Z",
    })

    expect(summary.notConfigured.email).toBe(2)
    expect(mocks.releaseDelivery).toHaveBeenCalledTimes(2)
    expect(mocks.completeDelivery).not.toHaveBeenCalled()
  })
})
