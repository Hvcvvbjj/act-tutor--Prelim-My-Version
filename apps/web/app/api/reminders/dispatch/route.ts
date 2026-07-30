import { type NextRequest, NextResponse } from "next/server"

import { dispatchScheduledLessonReminders } from "@/lib/lesson-reminder-scheduler.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const encoder = new TextEncoder()

function constantTimeEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  let difference = leftBytes.length ^ rightBytes.length
  const length = Math.max(leftBytes.length, rightBytes.length)
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  }
  return difference === 0
}

function json(payload: unknown, status = 200) {
  const response = NextResponse.json(payload, { status })
  response.headers.set("Cache-Control", "no-store")
  return response
}

export async function POST(request: NextRequest) {
  const secret = process.env.SCOUT_REMINDER_CRON_SECRET?.trim() ?? ""
  if (secret.length < 24) {
    return json({ error: "Reminder dispatch is not configured." }, 503)
  }
  const authorization = request.headers.get("authorization") ?? ""
  if (!constantTimeEqual(authorization, `Bearer ${secret}`)) {
    return json({ error: "Reminder dispatch is not authorized." }, 401)
  }

  try {
    const summary = await dispatchScheduledLessonReminders()
    return json({ ok: true, summary })
  } catch (error) {
    console.error("Reminder dispatch failed", {
      requestId:
        request.headers.get("cf-ray") ??
        request.headers.get("x-request-id") ??
        "unavailable",
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { name: "UnknownError", message: "Non-error value thrown" },
    })
    return json({ error: "Reminder dispatch failed safely." }, 500)
  }
}
