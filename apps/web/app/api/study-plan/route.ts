import type {
  CoreSection,
  CoreSectionScores,
  StudyAvailability,
  StudyPlanTaskStatus,
  StudySkillSignal,
  StudyWeekday,
} from "@act-tutor/core"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { syncLinkedSession } from "@/lib/auth.server"
import { studyPlanSessions } from "@/lib/study-plan.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SESSION_COOKIE = "scout_study_plan_session"
const SECTIONS = new Set<CoreSection>(["english", "math", "reading"])
const WEEKDAYS = new Set<StudyWeekday>([
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
])
const TASK_STATUSES = new Set<StudyPlanTaskStatus>([
  "scheduled",
  "complete",
  "skipped",
])

function errorResponse(error: unknown, status = 400) {
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "The adaptive study plan request failed.",
    },
    { status }
  )
}

function setSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
    priority: "high",
  })
}

function requireSessionId(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) throw new RangeError("Study plan not found.")
  return sessionId
}

function parseScores(value: unknown, label: string): CoreSectionScores {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RangeError(`${label} section scores are required.`)
  }
  const candidate = value as Record<string, unknown>
  const scores = {
    english: Number(candidate.english),
    math: Number(candidate.math),
    reading: Number(candidate.reading),
  }
  if (
    Object.values(scores).some(
      (score) => !Number.isInteger(score) || score < 1 || score > 36
    )
  ) {
    throw new RangeError(
      `${label} section scores must be integers from 1 to 36.`
    )
  }
  return scores
}

function parseSkills(value: unknown): StudySkillSignal[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new RangeError("Study plan skills must be a non-empty array.")
  }
  return value.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new RangeError("Study skill signal is malformed.")
    }
    const skill = raw as Record<string, unknown>
    if (
      typeof skill.skill !== "string" ||
      typeof skill.label !== "string" ||
      !SECTIONS.has(skill.section as CoreSection) ||
      typeof skill.mastery !== "number" ||
      typeof skill.evidence !== "number" ||
      (skill.priority !== undefined && typeof skill.priority !== "number") ||
      (skill.nextReviewAt !== null && typeof skill.nextReviewAt !== "string")
    ) {
      throw new RangeError("Study skill signal is incomplete.")
    }
    return {
      skill: skill.skill,
      label: skill.label,
      section: skill.section as CoreSection,
      mastery: skill.mastery,
      evidence: skill.evidence,
      nextReviewAt: skill.nextReviewAt as string | null,
      ...(skill.priority === undefined
        ? {}
        : { priority: skill.priority as number }),
    }
  })
}

function parseAvailability(value: unknown): StudyAvailability {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RangeError("Study availability is required.")
  }
  const entries = (value as Record<string, unknown>).entries
  if (!Array.isArray(entries)) {
    throw new RangeError("Study availability entries are required.")
  }
  return {
    entries: entries.map((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new RangeError("Study availability entry is malformed.")
      }
      const entry = raw as Record<string, unknown>
      if (
        !WEEKDAYS.has(entry.weekday as StudyWeekday) ||
        !Number.isInteger(entry.minutes)
      ) {
        throw new RangeError("Study availability day or minutes are invalid.")
      }
      return {
        weekday: entry.weekday as StudyWeekday,
        minutes: entry.minutes as number,
      }
    }),
  }
}

function parseDate(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError(`${label} must use YYYY-MM-DD.`)
  }
  return value
}

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return NextResponse.json({ plan: null })
  try {
    const plan = await studyPlanSessions.get(sessionId)
    const response = NextResponse.json({ plan })
    response.headers.set("Cache-Control", "no-store")
    return response
  } catch {
    const response = NextResponse.json({ plan: null })
    response.cookies.delete(SESSION_COOKIE)
    return response
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (body.action === "start") {
      const started = await studyPlanSessions.getOrCreate(
        request.cookies.get(SESSION_COOKIE)?.value ?? null,
        {
          today: parseDate(body.today, "Today"),
          testDate: parseDate(body.testDate, "Test day"),
          current: parseScores(body.current, "Current"),
          target: parseScores(body.target, "Target"),
          skills: parseSkills(body.skills),
          ...(body.availability
            ? { availability: parseAvailability(body.availability) }
            : {}),
        }
      )
      const response = NextResponse.json({ plan: started.plan })
      response.headers.set("Cache-Control", "no-store")
      setSessionCookie(response, started.sessionId)
      await syncLinkedSession(request, "studyPlan", started.sessionId)
      return response
    }

    if (body.action === "update_availability") {
      const plan = await studyPlanSessions.updateAvailability(
        requireSessionId(request),
        parseAvailability(body.availability)
      )
      return NextResponse.json({ plan })
    }

    if (body.action === "sync_evidence") {
      const plan = await studyPlanSessions.syncEvidence(
        requireSessionId(request),
        parseSkills(body.skills)
      )
      return NextResponse.json({ plan })
    }

    if (body.action === "set_task_status") {
      if (
        typeof body.taskId !== "string" ||
        !TASK_STATUSES.has(body.status as StudyPlanTaskStatus)
      ) {
        throw new RangeError("Study task ID and status are required.")
      }
      const plan = await studyPlanSessions.setTaskStatus(
        requireSessionId(request),
        body.taskId,
        body.status as StudyPlanTaskStatus
      )
      return NextResponse.json({ plan })
    }

    if (body.action === "catch_up") {
      const plan = await studyPlanSessions.catchUp(
        requireSessionId(request),
        parseDate(body.today, "Today")
      )
      return NextResponse.json({ plan })
    }

    throw new RangeError("Unknown adaptive study plan action.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value
    if (sessionId) await studyPlanSessions.reset(sessionId)
    await syncLinkedSession(request, "studyPlan", null)
    const response = NextResponse.json({ reset: true })
    response.cookies.delete(SESSION_COOKIE)
    return response
  } catch (error) {
    return errorResponse(error)
  }
}
