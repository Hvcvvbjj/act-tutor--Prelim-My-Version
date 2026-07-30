import "server-only"

import type { LessonReminderPreferences } from "@/lib/auth-types"

export type LessonReminderKind = "upcoming" | "overdue"
export type ReminderChannelStatus =
  "sent" | "disabled" | "not_configured" | "failed"

export interface LessonReminderMessage {
  kind: LessonReminderKind
  subject: string
  body: string
}

export interface LessonReminderDeliveryResult {
  email: ReminderChannelStatus
  sms: ReminderChannelStatus
}

function cleanEnvironmentValue(value: string | undefined) {
  const cleaned = value?.trim()
  return cleaned ? cleaned : null
}

function sendGridConfiguration() {
  const apiKey = cleanEnvironmentValue(process.env.SENDGRID_API_KEY)
  const fromEmail = cleanEnvironmentValue(process.env.SENDGRID_FROM_EMAIL)
  return {
    apiKey,
    fromEmail,
    configured: Boolean(apiKey && fromEmail),
  }
}

function twilioConfiguration() {
  const accountSid = cleanEnvironmentValue(process.env.TWILIO_ACCOUNT_SID)
  const authToken = cleanEnvironmentValue(process.env.TWILIO_AUTH_TOKEN)
  const fromNumber = cleanEnvironmentValue(process.env.TWILIO_FROM_NUMBER)
  return {
    accountSid,
    authToken,
    fromNumber,
    configured: Boolean(accountSid && authToken && fromNumber),
  }
}

export function lessonReminderDeliveryStatus() {
  return {
    emailConfigured: sendGridConfiguration().configured,
    smsConfigured: twilioConfiguration().configured,
  }
}

function validMessage(message: LessonReminderMessage) {
  return (
    (message.kind === "upcoming" || message.kind === "overdue") &&
    message.subject.trim().length > 0 &&
    message.subject.length <= 160 &&
    message.body.trim().length > 0 &&
    message.body.length <= 1_500
  )
}

async function deliverEmail(
  preferences: LessonReminderPreferences,
  message: LessonReminderMessage
): Promise<ReminderChannelStatus> {
  if (!preferences.enabled || !preferences.emailEnabled) return "disabled"
  const configuration = sendGridConfiguration()
  if (
    !configuration.configured ||
    !configuration.apiKey ||
    !configuration.fromEmail
  ) {
    return "not_configured"
  }
  if (!preferences.emailAddress) return "failed"

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: preferences.emailAddress }] }],
        from: { email: configuration.fromEmail, name: "AlexACT" },
        subject: message.subject,
        content: [{ type: "text/plain", value: message.body }],
      }),
      signal: AbortSignal.timeout(8_000),
    })
    return response.ok ? "sent" : "failed"
  } catch {
    return "failed"
  }
}

async function deliverSms(
  preferences: LessonReminderPreferences,
  message: LessonReminderMessage
): Promise<ReminderChannelStatus> {
  if (!preferences.enabled || !preferences.smsEnabled) return "disabled"
  const configuration = twilioConfiguration()
  if (
    !configuration.configured ||
    !configuration.accountSid ||
    !configuration.authToken ||
    !configuration.fromNumber
  ) {
    return "not_configured"
  }
  if (!preferences.phoneNumber) return "failed"

  const smsMessage = `AlexACT: ${message.body} Reply STOP to opt out.`
  const body = new URLSearchParams({
    To: preferences.phoneNumber,
    From: configuration.fromNumber,
    Body: smsMessage,
  })
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(configuration.accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${configuration.accountSid}:${configuration.authToken}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body,
        signal: AbortSignal.timeout(8_000),
      }
    )
    return response.ok ? "sent" : "failed"
  } catch {
    return "failed"
  }
}

/**
 * Provider-ready delivery boundary for a future scheduled job. Missing
 * credentials always produce `not_configured`; no network request is made.
 */
export async function deliverLessonReminder(
  preferences: LessonReminderPreferences,
  message: LessonReminderMessage
): Promise<LessonReminderDeliveryResult> {
  if (!validMessage(message)) {
    throw new Error("Lesson reminder content is invalid.")
  }
  const [email, sms] = await Promise.all([
    deliverEmail(preferences, message),
    deliverSms(preferences, message),
  ])
  return { email, sms }
}
