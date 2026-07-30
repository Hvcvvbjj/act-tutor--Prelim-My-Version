"use client"

import type {
  LessonReminderDraft,
  LessonReminderPreferences,
} from "@/lib/auth-types"
import { cn } from "@/lib/utils"

export function lessonReminderDraftFromPreferences(
  preferences: LessonReminderPreferences
): LessonReminderDraft {
  return {
    enabled: preferences.enabled,
    emailEnabled: preferences.emailEnabled,
    emailAddress: preferences.emailAddress,
    smsEnabled: preferences.smsEnabled,
    phoneNumber: preferences.phoneNumber,
    upcomingTiming: preferences.upcomingTiming,
    overdueTiming: preferences.overdueTiming,
  }
}

export function LessonReminderFields({
  value,
  onChange,
  idPrefix,
  className,
}: {
  value: LessonReminderDraft
  onChange: (next: LessonReminderDraft) => void
  idPrefix: string
  className?: string
}) {
  const update = (patch: Partial<LessonReminderDraft>) =>
    onChange({ ...value, ...patch })

  return (
    <fieldset className={cn("border-t pt-5", className)}>
      <legend className="sr-only">Lesson reminder preferences</legend>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          id={`${idPrefix}-enabled`}
          type="checkbox"
          checked={value.enabled}
          className="mt-1 size-4 shrink-0 accent-primary"
          onChange={(event) => update({ enabled: event.target.checked })}
        />
        <span>
          <span className="block text-sm font-black">
            Send me lesson reminders
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            Optional. Choose how AlexACT should remind you about scheduled and
            overdue lessons.
          </span>
        </span>
      </label>

      {value.enabled ? (
        <div className="mt-5 grid gap-5 border-l-4 border-primary bg-[var(--info-surface)] p-4">
          <fieldset>
            <legend className="text-sm font-black">
              How should AlexACT reach you?
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 border bg-background px-3 py-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={value.emailEnabled}
                  className="size-4 accent-primary"
                  onChange={(event) =>
                    update({ emailEnabled: event.target.checked })
                  }
                />
                Email
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 border bg-background px-3 py-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={value.smsEnabled}
                  className="size-4 accent-primary"
                  onChange={(event) =>
                    update({ smsEnabled: event.target.checked })
                  }
                />
                Text message
              </label>
            </div>
          </fieldset>

          {value.emailEnabled ? (
            <label
              htmlFor={`${idPrefix}-email`}
              className="grid gap-2 text-sm font-bold"
            >
              Reminder email
              <input
                id={`${idPrefix}-email`}
                type="email"
                value={value.emailAddress ?? ""}
                autoComplete="email"
                maxLength={254}
                required
                className="h-11 w-full rounded-lg border border-input bg-background px-3 py-1 text-base transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                placeholder="student@example.com"
                onChange={(event) =>
                  update({ emailAddress: event.target.value })
                }
              />
            </label>
          ) : null}

          {value.smsEnabled ? (
            <label
              htmlFor={`${idPrefix}-phone`}
              className="grid gap-2 text-sm font-bold"
            >
              Mobile number with country code
              <input
                id={`${idPrefix}-phone`}
                type="tel"
                value={value.phoneNumber ?? ""}
                autoComplete="tel"
                maxLength={30}
                required
                className="h-11 w-full rounded-lg border border-input bg-background px-3 py-1 text-base transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                placeholder="+1 312 555 0198"
                onChange={(event) =>
                  update({ phoneNumber: event.target.value })
                }
              />
            </label>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label
              htmlFor={`${idPrefix}-upcoming`}
              className="grid gap-2 text-sm font-bold"
            >
              Upcoming lesson
              <select
                id={`${idPrefix}-upcoming`}
                value={value.upcomingTiming}
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                onChange={(event) =>
                  update({
                    upcomingTiming: event.target
                      .value as LessonReminderDraft["upcomingTiming"],
                  })
                }
              >
                <option value="same-day">That morning</option>
                <option value="one-day-before">1 day before</option>
                <option value="two-days-before">2 days before</option>
              </select>
            </label>
            <label
              htmlFor={`${idPrefix}-overdue`}
              className="grid gap-2 text-sm font-bold"
            >
              Overdue lesson
              <select
                id={`${idPrefix}-overdue`}
                value={value.overdueTiming}
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                onChange={(event) =>
                  update({
                    overdueTiming: event.target
                      .value as LessonReminderDraft["overdueTiming"],
                  })
                }
              >
                <option value="same-day">First overdue day</option>
                <option value="one-day-after">1 day after that</option>
                <option value="three-days-after">3 days after that</option>
              </select>
            </label>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            By saving, you ask AlexACT to contact the address or number above
            only about your study plan. Email and phone details are stored with
            your account and are not used for advertising. If you enable text
            messages, you consent to recurring automated study reminders;
            message frequency varies and standard text/data rates may apply.
            Consent is not required to use AlexACT. Turn reminders off here at
            any time.
          </p>
          <p className="text-xs leading-5 font-semibold">
            This release saves your choices. Email and text delivery activates
            only after AlexACT&apos;s reminder service is configured.
          </p>
        </div>
      ) : null}
    </fieldset>
  )
}
