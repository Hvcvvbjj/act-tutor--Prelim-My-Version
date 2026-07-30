import { afterEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_LESSON_REMINDER_PREFERENCES,
  type LessonReminderPreferences,
} from "@/lib/auth-types"

import {
  deliverLessonReminder,
  lessonReminderDeliveryStatus,
} from "./reminder-delivery.server"

const ENABLED_PREFERENCES: LessonReminderPreferences = {
  ...DEFAULT_LESSON_REMINDER_PREFERENCES,
  enabled: true,
  emailEnabled: true,
  emailAddress: "student@example.com",
  smsEnabled: true,
  phoneNumber: "+13125550198",
  consentedAt: "2026-07-29T12:00:00.000Z",
  updatedAt: "2026-07-29T12:00:00.000Z",
}

const MESSAGE = {
  kind: "upcoming" as const,
  subject: "Your AlexACT lesson is tomorrow",
  body: "You have a 30-minute English lesson scheduled tomorrow.",
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("lesson reminder delivery", () => {
  it("does not make a network request when provider credentials are absent", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "")
    vi.stubEnv("SENDGRID_FROM_EMAIL", "")
    vi.stubEnv("TWILIO_ACCOUNT_SID", "")
    vi.stubEnv("TWILIO_AUTH_TOKEN", "")
    vi.stubEnv("TWILIO_FROM_NUMBER", "")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      deliverLessonReminder(ENABLED_PREFERENCES, MESSAGE)
    ).resolves.toEqual({
      email: "not_configured",
      sms: "not_configured",
    })
    expect(lessonReminderDeliveryStatus()).toEqual({
      emailConfigured: false,
      smsConfigured: false,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("builds SendGrid and Twilio requests only when both providers are configured", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "sendgrid-test-key")
    vi.stubEnv("SENDGRID_FROM_EMAIL", "reminders@alexact.example")
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC123")
    vi.stubEnv("TWILIO_AUTH_TOKEN", "twilio-test-token")
    vi.stubEnv("TWILIO_FROM_NUMBER", "+13125550000")
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      deliverLessonReminder(ENABLED_PREFERENCES, MESSAGE)
    ).resolves.toEqual({
      email: "sent",
      sms: "sent",
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const requests = fetchMock.mock.calls as Array<
      [string, RequestInit | undefined]
    >
    const sendGridRequest = requests.find(([url]) =>
      url.includes("sendgrid.com")
    )
    const twilioRequest = requests.find(([url]) => url.includes("twilio.com"))
    expect(sendGridRequest?.[1]?.headers).toMatchObject({
      Authorization: "Bearer sendgrid-test-key",
    })
    expect(String(sendGridRequest?.[1]?.body)).toContain("student@example.com")
    expect(twilioRequest?.[1]?.headers).toMatchObject({
      Authorization: expect.stringMatching(/^Basic /),
    })
    expect(String(twilioRequest?.[1]?.body)).toContain("To=%2B13125550198")
    expect(String(twilioRequest?.[1]?.body)).toContain("Reply+STOP+to+opt+out")
  })

  it("keeps disabled channels offline even when credentials exist", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "sendgrid-test-key")
    vi.stubEnv("SENDGRID_FROM_EMAIL", "reminders@alexact.example")
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC123")
    vi.stubEnv("TWILIO_AUTH_TOKEN", "twilio-test-token")
    vi.stubEnv("TWILIO_FROM_NUMBER", "+13125550000")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      deliverLessonReminder(DEFAULT_LESSON_REMINDER_PREFERENCES, MESSAGE)
    ).resolves.toEqual({
      email: "disabled",
      sms: "disabled",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
