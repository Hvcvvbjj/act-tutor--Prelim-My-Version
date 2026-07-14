import {
  buildCalibrationLearningBaseline,
  type DiagnosticSkillResult,
  type LearningAnswerCommand,
  type LessonPlanContext,
} from "@act-tutor/core"
import { type NextRequest, NextResponse } from "next/server"

import { CALIBRATION_BANK, calibrationSessions } from "@/lib/calibration.server"
import { LEARNING_BANK } from "@/lib/learning-content.server"
import { lessonComposer } from "@/lib/lesson-composer.server"
import { learningSessions } from "@/lib/learning-sessions.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SESSION_COOKIE = "ai_act_learning_session"
const CALIBRATION_COOKIE = "ai_act_calibration_session"

function setSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    priority: "high",
  })
}

function errorResponse(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "The learning request could not be completed.",
    },
    { status: 400 }
  )
}

function requireSessionId(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) throw new RangeError("Learning session not found.")
  return sessionId
}

function parseDiagnosticSkillResults(value: unknown): DiagnosticSkillResult[] {
  if (value === undefined) return []
  if (!Array.isArray(value))
    throw new RangeError("Diagnostic skill results must be an array.")
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new RangeError("Diagnostic skill result must be an object.")
    }
    const candidate = item as Record<string, unknown>
    if (
      typeof candidate.skill !== "string" ||
      typeof candidate.label !== "string" ||
      (candidate.section !== "english" &&
        candidate.section !== "math" &&
        candidate.section !== "reading") ||
      typeof candidate.correct !== "number" ||
      typeof candidate.total !== "number" ||
      typeof candidate.accuracy !== "number" ||
      (candidate.signal !== "strength" &&
        candidate.signal !== "developing" &&
        candidate.signal !== "focus")
    ) {
      throw new RangeError("Diagnostic skill result is malformed.")
    }
    return {
      skill: candidate.skill,
      label: candidate.label,
      section: candidate.section,
      correct: candidate.correct,
      total: candidate.total,
      accuracy: candidate.accuracy,
      signal: candidate.signal,
    }
  })
}

function parseAnswerCommand(value: unknown): LearningAnswerCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RangeError("A versioned answer command is required.")
  }
  const command = value as Record<string, unknown>
  const issuedAt = typeof command.issuedAt === "string" ? command.issuedAt : ""
  if (
    command.schemaVersion !== 2 ||
    typeof command.idempotencyKey !== "string" ||
    command.idempotencyKey.length < 8 ||
    typeof command.learnerSessionId !== "string" ||
    typeof command.bankVersion !== "string" ||
    !Number.isInteger(command.questionVersion) ||
    !Number.isInteger(command.sequence) ||
    Number(command.sequence) < 0 ||
    command.answerRevision !== 1 ||
    !issuedAt ||
    Number.isNaN(new Date(issuedAt).getTime())
  ) {
    throw new RangeError("The saved answer command is malformed.")
  }
  return {
    schemaVersion: 2,
    idempotencyKey: command.idempotencyKey,
    learnerSessionId: command.learnerSessionId,
    bankVersion: command.bankVersion,
    questionVersion: Number(command.questionVersion),
    sequence: Number(command.sequence),
    answerRevision: 1,
    issuedAt,
  }
}

function parsePlanContext(body: Record<string, unknown>) {
  const goalScore = Number(body.goalScore)
  const currentScore = Number(body.currentScore)
  const daysUntilTest = Number(body.daysUntilTest)
  const minutesPerSession = Number(body.minutesPerSession)
  const studyDaysPerWeek = Number(body.studyDaysPerWeek ?? 5)
  const preferredSection = body.preferredSection ?? "balanced"
  if (
    !Number.isInteger(goalScore) ||
    goalScore < 1 ||
    goalScore > 36 ||
    !Number.isInteger(currentScore) ||
    currentScore < 1 ||
    currentScore > 36 ||
    !Number.isInteger(daysUntilTest) ||
    daysUntilTest < 1 ||
    daysUntilTest > 730 ||
    !Number.isInteger(minutesPerSession) ||
    minutesPerSession < 15 ||
    minutesPerSession > 180 ||
    !Number.isInteger(studyDaysPerWeek) ||
    studyDaysPerWeek < 1 ||
    studyDaysPerWeek > 7 ||
    (preferredSection !== "balanced" &&
      preferredSection !== "english" &&
      preferredSection !== "math" &&
      preferredSection !== "reading")
  ) {
    throw new RangeError("Learning plan context is malformed.")
  }
  return {
    goalScore,
    currentScore,
    daysUntilTest,
    minutesPerSession,
    studyDaysPerWeek,
    preferredSection: preferredSection as LessonPlanContext["preferredSection"],
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await learningSessions.get(
      requireSessionId(request),
      LEARNING_BANK
    )
    const response = NextResponse.json(payload)
    response.headers.set("Cache-Control", "no-store")
    return response
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const action = body.action

    if (action === "rebase_after_calibration") {
      const calibrationSessionId = request.cookies.get(CALIBRATION_COOKIE)?.value
      if (!calibrationSessionId) {
        throw new RangeError("Complete Quick Check before rebuilding the plan.")
      }
      const calibration = await calibrationSessions.get(
        calibrationSessionId,
        CALIBRATION_BANK
      )
      const baseline = buildCalibrationLearningBaseline(calibration)
      const plan = parsePlanContext({
        ...body,
        currentScore: baseline.composite,
      })
      const learning = await learningSessions.rebaseAfterCalibration(
        requireSessionId(request),
        LEARNING_BANK,
        {
          calibrationKey: `${baseline.calibrationSessionId}:${baseline.calibrationBankVersion}`,
          diagnosticSkillResults: baseline.skillResults,
          plan,
        },
        lessonComposer
      )
      const response = NextResponse.json({ learning, baseline })
      response.headers.set("Cache-Control", "no-store")
      return response
    }

    if (action === "start") {
      if (typeof body.skill !== "string")
        throw new RangeError("Learning skill is required.")
      const session = await learningSessions.getOrCreate(
        request.cookies.get(SESSION_COOKIE)?.value ?? null,
        LEARNING_BANK,
        {
          skill: body.skill,
          diagnosticSkillResults: parseDiagnosticSkillResults(
            body.diagnosticSkillResults
          ),
          plan: parsePlanContext(body),
        },
        lessonComposer
      )
      const response = NextResponse.json(session.payload)
      response.headers.set("Cache-Control", "no-store")
      setSessionCookie(response, session.sessionId)
      return response
    }

    if (action === "complete_lesson") {
      const payload = await learningSessions.completeLesson(
        requireSessionId(request),
        LEARNING_BANK
      )
      return NextResponse.json(payload)
    }

    if (action === "start_next" || action === "start_skill") {
      const payload = await learningSessions.beginFocus(
        requireSessionId(request),
        LEARNING_BANK,
        {
          skill:
            action === "start_skill" && typeof body.skill === "string"
              ? body.skill
              : undefined,
          plan: parsePlanContext(body),
        },
        lessonComposer
      )
      return NextResponse.json(payload)
    }

    if (action === "start_repair") {
      if (typeof body.mistakeId !== "string") {
        throw new RangeError("A mistakeId is required.")
      }
      const payload = await learningSessions.beginRepair(
        requireSessionId(request),
        LEARNING_BANK,
        body.mistakeId
      )
      return NextResponse.json(payload)
    }

    if (action === "start_checkpoint") {
      const payload = await learningSessions.beginCheckpoint(
        requireSessionId(request),
        LEARNING_BANK
      )
      return NextResponse.json(payload)
    }

    if (action === "start_retention") {
      if (typeof body.skill !== "string")
        throw new RangeError("A review skill is required.")
      const payload = await learningSessions.beginRetention(
        requireSessionId(request),
        LEARNING_BANK,
        body.skill
      )
      return NextResponse.json(payload)
    }

    if (action === "start_challenge") {
      const payload = await learningSessions.beginChallenge(
        requireSessionId(request),
        LEARNING_BANK,
        typeof body.skill === "string" ? body.skill : undefined
      )
      return NextResponse.json(payload)
    }

    if (action === "start_micro") {
      const payload = await learningSessions.beginMicro(
        requireSessionId(request),
        LEARNING_BANK,
        {
          skill: typeof body.skill === "string" ? body.skill : undefined,
          plan: parsePlanContext(body),
        },
        lessonComposer
      )
      return NextResponse.json(payload)
    }

    if (action === "start_recovery") {
      const payload = await learningSessions.beginRecovery(
        requireSessionId(request),
        LEARNING_BANK
      )
      return NextResponse.json(payload)
    }

    if (action === "teach_back") {
      if (typeof body.response !== "string")
        throw new RangeError("A teach-back response is required.")
      const payload = await learningSessions.recordTeachBack(
        requireSessionId(request),
        LEARNING_BANK,
        body.response
      )
      return NextResponse.json(payload)
    }

    if (action === "correct_model") {
      if (
        typeof body.skill !== "string" ||
        (body.kind !== "too-high" &&
          body.kind !== "too-low" &&
          body.kind !== "wrong-misconception")
      ) {
        throw new RangeError("A valid learner-model correction is required.")
      }
      const payload = await learningSessions.correctLearnerModel(
        requireSessionId(request),
        LEARNING_BANK,
        {
          skill: body.skill,
          kind: body.kind,
          note: typeof body.note === "string" ? body.note : "",
        }
      )
      return NextResponse.json(payload)
    }

    if (action === "lesson_feedback") {
      const payload = await learningSessions.recordLessonFeedback(
        requireSessionId(request),
        LEARNING_BANK,
        {
          helpful: body.helpful === true,
          style: typeof body.style === "string" ? body.style : "standard",
        }
      )
      return NextResponse.json(payload)
    }

    if (action === "answer") {
      if (
        typeof body.questionId !== "string" ||
        typeof body.choiceId !== "string"
      ) {
        throw new RangeError("A questionId and choiceId are required.")
      }
      const payload = await learningSessions.answerQuestion(
        requireSessionId(request),
        LEARNING_BANK,
        {
          questionId: body.questionId,
          choiceId: body.choiceId,
          confidence:
            body.confidence === "unsure" || body.confidence === "guessing"
              ? body.confidence
              : "sure",
          selfCorrected: body.selfCorrected === true,
          responseSeconds:
            typeof body.responseSeconds === "number"
              ? Math.max(0, Math.min(3600, body.responseSeconds))
              : undefined,
          command: parseAnswerCommand(body.command),
        }
      )
      return NextResponse.json(payload)
    }

    throw new RangeError("Unknown learning action.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value
    if (sessionId) await learningSessions.reset(sessionId)
    const response = NextResponse.json({ reset: true })
    response.cookies.delete(SESSION_COOKIE)
    return response
  } catch (error) {
    return errorResponse(error)
  }
}
