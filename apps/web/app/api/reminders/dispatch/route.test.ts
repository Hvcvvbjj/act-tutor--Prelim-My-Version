import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
}))

vi.mock("@/lib/lesson-reminder-scheduler.server", () => ({
  dispatchScheduledLessonReminders: mocks.dispatch,
}))

import { POST } from "./route"

const SECRET = "reminder-cron-secret-at-least-24-characters"

function request(token?: string) {
  return new NextRequest("http://localhost/api/reminders/dispatch", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

beforeEach(() => {
  mocks.dispatch.mockReset()
  mocks.dispatch.mockResolvedValue({
    scannedSubscriptions: 3,
    dueBatches: 1,
    missingPlans: 0,
    claimsSkipped: 0,
    sent: { email: 1, sms: 0 },
    notConfigured: { email: 0, sms: 0 },
    failed: { email: 0, sms: 0 },
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("reminder cron route", () => {
  it("stays unavailable until a strong server-side cron secret is configured", async () => {
    vi.stubEnv("SCOUT_REMINDER_CRON_SECRET", "")
    const response = await POST(request())
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Reminder dispatch is not configured.",
    })
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })

  it("rejects a caller with the wrong bearer token", async () => {
    vi.stubEnv("SCOUT_REMINDER_CRON_SECRET", SECRET)
    const response = await POST(request("wrong-token"))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Reminder dispatch is not authorized.",
    })
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })

  it("returns only aggregate delivery counts to an authorized cron", async () => {
    vi.stubEnv("SCOUT_REMINDER_CRON_SECRET", SECRET)
    const response = await POST(request(SECRET))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toEqual({
      ok: true,
      summary: {
        scannedSubscriptions: 3,
        dueBatches: 1,
        missingPlans: 0,
        claimsSkipped: 0,
        sent: { email: 1, sms: 0 },
        notConfigured: { email: 0, sms: 0 },
        failed: { email: 0, sms: 0 },
      },
    })
    expect(JSON.stringify(payload)).not.toContain("@")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(mocks.dispatch).toHaveBeenCalledOnce()
  })
})
