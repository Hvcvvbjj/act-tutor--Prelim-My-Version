import {
  buildCalibrationLearningBaseline,
  examLabInterpretationReadiness,
  type DiagnosticSkillResult,
  type LearningAnswerCommand,
  type LessonPlanContext,
} from "@act-tutor/core"
import { type NextRequest, NextResponse } from "next/server"

import { CALIBRATION_BANK, calibrationSessions } from "@/lib/calibration.server"
import { syncLinkedSession } from "@/lib/auth.server"
import {
  FULL_LENGTH_PRACTICE_FORM,
  RAPID_DIAGNOSTIC_FORM,
} from "@/lib/diagnostic-content.server"
import { diagnosticSessions } from "@/lib/diagnostic-sessions.server"
import { examLabSessions } from "@/lib/exam-lab.server"
import { LEARNING_BANK } from "@/lib/learning-content.server"
import { lessonComposer } from "@/lib/lesson-composer.server"
import { learningSessions } from "@/lib/learning-sessions.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SESSION_COOKIE = "ai_act_learning_session"
const CALIBRATION_COOKIE = "ai_act_calibration_session"
const DIAGNOSTIC_COOKIE = "ai_act_diag_session"
const EXAM_LAB_COOKIE = "scout_exam_lab_session"
const MAX_SKILL_RESULTS = 24
const MAX_ASSESSMENT_QUESTIONS = 200

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
  if (value.length > MAX_SKILL_RESULTS) {
    throw new RangeError("Too many diagnostic skill results were provided.")
  }
  const skills = new Set<string>()
  let totalQuestions = 0
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
    if (
      !Number.isInteger(candidate.correct) ||
      !Number.isInteger(candidate.total) ||
      candidate.total <= 0 ||
      candidate.correct < 0 ||
      candidate.correct > candidate.total ||
      !Number.isFinite(candidate.accuracy) ||
      candidate.accuracy < 0 ||
      candidate.accuracy > 1 ||
      Math.abs(candidate.accuracy - candidate.correct / candidate.total) >
        0.0001
    ) {
      throw new RangeError("Diagnostic skill counts are malformed.")
    }
    if (skills.has(candidate.skill)) {
      throw new RangeError(`Duplicate diagnostic skill: ${candidate.skill}.`)
    }
    skills.add(candidate.skill)
    totalQuestions += candidate.total
    if (totalQuestions > MAX_ASSESSMENT_QUESTIONS) {
      throw new RangeError("Diagnostic skill counts exceed the supported form.")
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

async function resolveRoundAssessment(
  request: NextRequest,
  source: unknown
): Promise<{
  assessmentKey: string
  diagnosticSkillResults: DiagnosticSkillResult[]
  currentScore: number
  sectionScores: NonNullable<LessonPlanContext["sectionScores"]>
}> {
  if (source === "diagnostic") {
    const sessionId = request.cookies.get(DIAGNOSTIC_COOKIE)?.value
    if (!sessionId) {
      throw new RangeError(
        "Finish a new diagnostic before starting the next lesson round."
      )
    }
    const session = await diagnosticSessions.get(
      sessionId,
      RAPID_DIAGNOSTIC_FORM
    )
    if (session.status !== "completed" || !session.result) {
      throw new RangeError(
        "Finish the current diagnostic before starting the next lesson round."
      )
    }
    return {
      assessmentKey: `diagnostic:${session.attemptId}`,
      diagnosticSkillResults: [...session.result.skillResults],
      currentScore: session.result.compositeRange.estimate,
      sectionScores: session.result.planningBaseline,
    }
  }

  if (source === "full-test") {
    const sessionId = request.cookies.get(EXAM_LAB_COOKIE)?.value
    if (!sessionId) {
      throw new RangeError(
        "Finish a new full-length test before starting the next lesson round."
      )
    }
    const session = await examLabSessions.get(
      sessionId,
      FULL_LENGTH_PRACTICE_FORM
    )
    const result = session.result
    if (
      session.status !== "completed" ||
      !result ||
      result.mode !== "core" ||
      !examLabInterpretationReadiness(result).sufficient
    ) {
      throw new RangeError(
        "Complete enough of the current full-length test for Scout to interpret it before starting the next lesson round."
      )
    }
    const sectionScores = Object.fromEntries(
      result.sections.map((section) => [
        section.section,
        section.practiceEstimate,
      ])
    ) as NonNullable<LessonPlanContext["sectionScores"]>
    if (
      !Number.isInteger(sectionScores.english) ||
      !Number.isInteger(sectionScores.math) ||
      !Number.isInteger(sectionScores.reading)
    ) {
      throw new RangeError(
        "The completed full-length test is missing section results."
      )
    }
    return {
      assessmentKey: `full-test:${session.id}`,
      diagnosticSkillResults: result.skills.map((skill) => ({
        skill: skill.skill,
        label: skill.label,
        section: skill.section,
        correct: skill.correct,
        total: skill.total,
        accuracy: skill.accuracy,
        signal:
          skill.accuracy >= 0.75
            ? "strength"
            : skill.accuracy < 0.5
              ? "focus"
              : "developing",
      })),
      currentScore: result.practiceEstimate.estimate,
      sectionScores,
    }
  }

  throw new RangeError(
    "Choose a completed diagnostic or full-length test for the next round."
  )
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
  const scoreEvidenceKey =
    typeof body.scoreEvidenceKey === "string"
      ? body.scoreEvidenceKey.trim()
      : undefined
  const rawSectionScores = body.sectionScores
  const sectionScores =
    rawSectionScores &&
    typeof rawSectionScores === "object" &&
    !Array.isArray(rawSectionScores)
      ? (rawSectionScores as Record<string, unknown>)
      : null
  const parsedSectionScores = sectionScores
    ? {
        english: Number(sectionScores.english),
        math: Number(sectionScores.math),
        reading: Number(sectionScores.reading),
      }
    : undefined
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
    (scoreEvidenceKey !== undefined &&
      (scoreEvidenceKey.length < 8 || scoreEvidenceKey.length > 160)) ||
    (parsedSectionScores !== undefined &&
      Object.values(parsedSectionScores).some(
        (score) => !Number.isInteger(score) || score < 1 || score > 36
      )) ||
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
    ...(scoreEvidenceKey ? { scoreEvidenceKey } : {}),
    sectionScores: parsedSectionScores,
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

    if (action === "rebase_after_diagnostic") {
      const diagnosticSessionId = request.cookies.get(DIAGNOSTIC_COOKIE)?.value
      if (!diagnosticSessionId) {
        throw new RangeError(
          "Complete the full diagnostic before rebuilding the plan."
        )
      }
      const learningSessionId = requireSessionId(request)
      const diagnostic = await diagnosticSessions.get(
        diagnosticSessionId,
        RAPID_DIAGNOSTIC_FORM
      )
      if (diagnostic.status !== "completed" || !diagnostic.result) {
        throw new RangeError(
          "Complete the full diagnostic before rebuilding the plan."
        )
      }
      const plan = parsePlanContext({
        ...body,
        currentScore: diagnostic.result.compositeRange.estimate,
        sectionScores: diagnostic.result.planningBaseline,
      })
      const learning = await learningSessions.rebaseAfterCalibration(
        learningSessionId,
        LEARNING_BANK,
        {
          calibrationKey: `diagnostic:${diagnostic.attemptId}`,
          diagnosticSkillResults: diagnostic.result.skillResults,
          plan,
          baselineLabel: "Full diagnostic",
          replaceLearningTwin: true,
        },
        lessonComposer
      )
      const response = NextResponse.json({ learning })
      response.headers.set("Cache-Control", "no-store")
      return response
    }

    if (action === "rebase_after_calibration") {
      const calibrationSessionId =
        request.cookies.get(CALIBRATION_COOKIE)?.value
      if (!calibrationSessionId) {
        throw new RangeError("Complete Quick Check before rebuilding the plan.")
      }
      const learningSessionId = requireSessionId(request)
      const calibration = await calibrationSessions.get(
        calibrationSessionId,
        CALIBRATION_BANK
      )
      const calibrationEvidence = await calibrationSessions.getEvidence(
        calibrationSessionId,
        CALIBRATION_BANK
      )
      for (const evidence of calibrationEvidence) {
        await learningSessions.recordCalibrationEvidence(
          learningSessionId,
          LEARNING_BANK,
          evidence
        )
      }
      const baseline = buildCalibrationLearningBaseline(calibration)
      const plan = parsePlanContext({
        ...body,
        currentScore: baseline.composite,
        sectionScores: baseline.sections,
      })
      const learning = await learningSessions.rebaseAfterCalibration(
        learningSessionId,
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
      await syncLinkedSession(request, "learning", session.sessionId)
      return response
    }

    if (action === "start_adaptive_round") {
      const assessment = await resolveRoundAssessment(
        request,
        body.assessmentSource
      )
      const plan = parsePlanContext(body)
      const payload = await learningSessions.applyRoundAssessment(
        requireSessionId(request),
        LEARNING_BANK,
        {
          assessmentKey: assessment.assessmentKey,
          diagnosticSkillResults: assessment.diagnosticSkillResults,
          plan: {
            ...plan,
            currentScore: assessment.currentScore,
            sectionScores: assessment.sectionScores,
          },
        },
        lessonComposer
      )
      return NextResponse.json(payload)
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
    await syncLinkedSession(request, "learning", null)
    const response = NextResponse.json({ reset: true })
    response.cookies.delete(SESSION_COOKIE)
    return response
  } catch (error) {
    return errorResponse(error)
  }
}
