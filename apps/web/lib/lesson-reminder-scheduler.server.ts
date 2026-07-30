import "server-only"

import type { AdaptiveStudyPlan, StudyPlanTask } from "@act-tutor/core"

import type {
  LessonReminderPreferences,
  OverdueLessonReminderTiming,
  UpcomingLessonReminderTiming,
} from "@/lib/auth-types"
import {
  claimLessonReminderDelivery,
  completeLessonReminderDelivery,
  listLessonReminderSubscriptions,
  releaseLessonReminderDelivery,
  type LessonReminderSubscription,
} from "@/lib/auth.server"
import {
  deliverLessonReminder,
  type LessonReminderKind,
  type ReminderChannelStatus,
} from "@/lib/reminder-delivery.server"
import { studyPlanSessions } from "@/lib/study-plan.server"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000

const UPCOMING_OFFSETS: Record<UpcomingLessonReminderTiming, number> = {
  "same-day": 0,
  "one-day-before": 1,
  "two-days-before": 2,
}

// "Same day" means the first daily cron after a lesson became overdue.
const OVERDUE_OFFSETS: Record<OverdueLessonReminderTiming, number> = {
  "same-day": -1,
  "one-day-after": -2,
  "three-days-after": -4,
}

export interface LessonReminderDispatchSummary {
  scannedSubscriptions: number
  dueBatches: number
  missingPlans: number
  claimsSkipped: number
  sent: { email: number; sms: number }
  notConfigured: { email: number; sms: number }
  failed: { email: number; sms: number }
}

function dateTimestamp(value: string) {
  if (!DATE_PATTERN.test(value)) {
    throw new RangeError("Reminder dates must use YYYY-MM-DD.")
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  if (
    Number.isNaN(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  ) {
    throw new RangeError("Reminder date is invalid.")
  }
  return timestamp
}

function addDays(value: string, days: number) {
  return new Date(dateTimestamp(value) + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

export function reminderTargetDate(
  preferences: LessonReminderPreferences,
  kind: LessonReminderKind,
  today: string
) {
  return addDays(
    today,
    kind === "upcoming"
      ? UPCOMING_OFFSETS[preferences.upcomingTiming]
      : OVERDUE_OFFSETS[preferences.overdueTiming]
  )
}

export function tasksForLessonReminder(
  plan: AdaptiveStudyPlan,
  preferences: LessonReminderPreferences,
  kind: LessonReminderKind,
  today: string
) {
  const targetDate = reminderTargetDate(preferences, kind, today)
  return plan.tasks.filter((task) => {
    if (task.date !== targetDate || task.status === "complete") return false
    if (kind === "upcoming") return task.status === "scheduled"
    return (
      task.date < today &&
      (task.status === "scheduled" || task.status === "skipped")
    )
  })
}

function taskSummary(tasks: ReadonlyArray<StudyPlanTask>) {
  const titles = tasks.map((task) => task.title)
  if (titles.length === 1) return titles[0]
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`
  return `${titles[0]}, ${titles[1]}, and ${titles.length - 2} more`
}

function publicAppUrl() {
  const configured = process.env.ALEXACT_PUBLIC_URL?.trim()
  if (!configured) return null
  try {
    const url = new URL(configured)
    return url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

function reminderMessage(
  subscription: LessonReminderSubscription,
  tasks: ReadonlyArray<StudyPlanTask>,
  kind: LessonReminderKind
) {
  const minutes = tasks.reduce((total, task) => total + task.minutes, 0)
  const date = tasks[0]?.date ?? ""
  const destination = publicAppUrl()
  const action = destination
    ? ` Open AlexACT: ${destination}`
    : " Open AlexACT when you are ready."
  if (kind === "upcoming") {
    return {
      kind,
      subject: `Your AlexACT study session is scheduled for ${date}`,
      body: `Hi ${subscription.displayName}, ${taskSummary(tasks)} is scheduled for ${date} (${minutes} minutes).${action}`,
    }
  }
  return {
    kind,
    subject: `Your AlexACT study session needs a new time`,
    body: `Hi ${subscription.displayName}, ${taskSummary(tasks)} was scheduled for ${date} (${minutes} minutes). AlexACT can move missed work into your plan.${action}`,
  }
}

function deliveryKey(
  kind: LessonReminderKind,
  date: string,
  channel: "email" | "sms"
) {
  return `reminder:v1:${kind}:${date}:${channel}`
}

function preferencesForChannel(
  preferences: LessonReminderPreferences,
  channel: "email" | "sms"
): LessonReminderPreferences {
  return {
    ...preferences,
    emailEnabled: channel === "email" && preferences.emailEnabled,
    smsEnabled: channel === "sms" && preferences.smsEnabled,
  }
}

function addChannelResult(
  summary: LessonReminderDispatchSummary,
  channel: "email" | "sms",
  status: ReminderChannelStatus
) {
  if (status === "sent") summary.sent[channel] += 1
  else if (status === "not_configured") summary.notConfigured[channel] += 1
  else if (status === "failed") summary.failed[channel] += 1
}

export async function dispatchScheduledLessonReminders(
  options: { today?: string; now?: string } = {}
): Promise<LessonReminderDispatchSummary> {
  const now = options.now ?? new Date().toISOString()
  if (Number.isNaN(Date.parse(now))) {
    throw new RangeError("Reminder dispatch time is invalid.")
  }
  const today = options.today ?? now.slice(0, 10)
  dateTimestamp(today)

  const subscriptions = await listLessonReminderSubscriptions()
  const summary: LessonReminderDispatchSummary = {
    scannedSubscriptions: subscriptions.length,
    dueBatches: 0,
    missingPlans: 0,
    claimsSkipped: 0,
    sent: { email: 0, sms: 0 },
    notConfigured: { email: 0, sms: 0 },
    failed: { email: 0, sms: 0 },
  }

  for (const subscription of subscriptions) {
    if (!subscription.studyPlanSessionId) {
      summary.missingPlans += 1
      continue
    }
    let plan: AdaptiveStudyPlan
    try {
      plan = await studyPlanSessions.get(subscription.studyPlanSessionId)
    } catch {
      summary.missingPlans += 1
      continue
    }

    for (const kind of ["upcoming", "overdue"] as const) {
      const tasks = tasksForLessonReminder(
        plan,
        subscription.preferences,
        kind,
        today
      )
      if (tasks.length === 0) continue
      summary.dueBatches += 1
      const message = reminderMessage(subscription, tasks, kind)

      for (const channel of ["email", "sms"] as const) {
        const enabled =
          channel === "email"
            ? subscription.preferences.emailEnabled
            : subscription.preferences.smsEnabled
        if (!enabled) continue
        const claim = await claimLessonReminderDelivery(
          subscription.accountId,
          deliveryKey(kind, tasks[0]?.date ?? "", channel),
          now
        )
        if (!claim) {
          summary.claimsSkipped += 1
          continue
        }

        const result = await deliverLessonReminder(
          preferencesForChannel(subscription.preferences, channel),
          message
        )
        const status = result[channel]
        addChannelResult(summary, channel, status)
        if (status === "sent") {
          const recorded = await completeLessonReminderDelivery(claim, now)
          if (!recorded) summary.failed[channel] += 1
        } else {
          await releaseLessonReminderDelivery(claim)
        }
      }
    }
  }

  return summary
}
