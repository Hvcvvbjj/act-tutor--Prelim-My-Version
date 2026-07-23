import { randomUUID } from "node:crypto"

import {
  classifyScoutIntent,
  type AdaptiveCalibrationPayload,
  type AdaptiveStudyPlan,
  type LearningSessionPayload,
  type ScoutAnswer,
  type ScoutAskRequest,
  type ScoutExplanationPreferences,
  type ScoutMessage,
  type ScoutScreen,
} from "@act-tutor/core"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { RAPID_DIAGNOSTIC_FORM } from "@/lib/diagnostic-content.server"
import { syncLinkedSession } from "@/lib/auth.server"
import { CALIBRATION_BANK, calibrationSessions } from "@/lib/calibration.server"
import { examLabSessions } from "@/lib/exam-lab.server"
import { LEARNING_BANK } from "@/lib/learning-content.server"
import { learningSessions } from "@/lib/learning-sessions.server"
import { scoutSessions } from "@/lib/scout-sessions.server"
import { studyPlanSessions } from "@/lib/study-plan.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SCOUT_COOKIE = "ai_act_scout_session"
const LEARNING_COOKIE = "ai_act_learning_session"
const EXAM_COOKIE = "scout_exam_lab_session"
const CALIBRATION_COOKIE = "ai_act_calibration_session"
const STUDY_PLAN_COOKIE = "scout_study_plan_session"
const SCREENS = new Set<ScoutScreen>([
  "today",
  "plan",
  "calibrate",
  "progress",
  "lab",
  "control",
])

function setScoutCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(SCOUT_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    priority: "high",
  })
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function parseScreen(value: unknown): ScoutScreen {
  return SCREENS.has(value as ScoutScreen) ? (value as ScoutScreen) : "today"
}

function parsePreferences(value: unknown): ScoutExplanationPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RangeError("Scout explanation preferences are malformed.")
  }
  const input = value as Record<string, unknown>
  if (
    (input.depth !== "quick" &&
      input.depth !== "normal" &&
      input.depth !== "detailed") ||
    (input.readingLevel !== "plain" &&
      input.readingLevel !== "standard" &&
      input.readingLevel !== "advanced") ||
    (input.exampleStyle !== "school" &&
      input.exampleStyle !== "sports" &&
      input.exampleStyle !== "gaming" &&
      input.exampleStyle !== "everyday") ||
    typeof input.fewerTechnicalTerms !== "boolean"
  ) {
    throw new RangeError("Scout explanation preferences are malformed.")
  }
  return {
    depth: input.depth,
    readingLevel: input.readingLevel,
    exampleStyle: input.exampleStyle,
    fewerTechnicalTerms: input.fewerTechnicalTerms,
  }
}

async function getLearning(request: NextRequest) {
  const sessionId = request.cookies.get(LEARNING_COOKIE)?.value
  if (!sessionId) return null
  try {
    return await learningSessions.get(sessionId, LEARNING_BANK)
  } catch {
    return null
  }
}

async function getExam(request: NextRequest) {
  const sessionId = request.cookies.get(EXAM_COOKIE)?.value
  if (!sessionId) return null
  try {
    return await examLabSessions.get(sessionId, RAPID_DIAGNOSTIC_FORM)
  } catch {
    return null
  }
}

async function getCalibration(request: NextRequest) {
  const sessionId = request.cookies.get(CALIBRATION_COOKIE)?.value
  if (!sessionId) return null
  try {
    return await calibrationSessions.get(sessionId, CALIBRATION_BANK)
  } catch {
    return null
  }
}

async function getStudyPlan(request: NextRequest) {
  const sessionId = request.cookies.get(STUDY_PLAN_COOKIE)?.value
  if (!sessionId) return null
  try {
    return await studyPlanSessions.get(sessionId)
  } catch {
    return null
  }
}

function selectionIsGrounded(
  selectedText: string,
  corpus: ReadonlyArray<string>
) {
  if (!selectedText) return false
  const normalized = selectedText.toLowerCase().replace(/\s+/g, " ")
  return corpus.some((entry) =>
    entry.toLowerCase().replace(/\s+/g, " ").includes(normalized)
  )
}

function concise(value: string, preferences: ScoutExplanationPreferences) {
  if (preferences.depth !== "quick") return value
  return value.split(/(?<=[.!?])\s+/)[0] ?? value
}

function plainWords(value: string) {
  return value
    .replaceAll(/calibration/gi, "starting check")
    .replaceAll(/uncertainty/gi, "estimate uncertainty")
    .replaceAll(/independent evidence/gi, "answers you gave without help")
    .replaceAll(/learner model/gi, "skill tracker")
    .replaceAll(/mastery estimate/gi, "skill estimate")
}

function exampleForStyle(base: string | null) {
  return base
}

function applyPreferences(
  answer: Omit<ScoutAnswer, "receipt">,
  preferences: ScoutExplanationPreferences
) {
  let summary = answer.summary
  let explanation = answer.explanation
  let technical = answer.technical
  if (preferences.readingLevel === "plain") {
    summary = `In plain words: ${plainWords(summary)}`
    explanation = plainWords(explanation)
  }
  if (preferences.fewerTechnicalTerms) {
    summary = plainWords(summary)
    explanation = plainWords(explanation)
    technical = plainWords(technical)
  }
  if (preferences.depth === "quick") {
    explanation = concise(explanation, preferences)
  }
  return {
    ...answer,
    summary,
    explanation,
    example: exampleForStyle(answer.example),
    technical,
  }
}

function lessonCorpus(learning: LearningSessionPayload | null) {
  if (!learning) return []
  const question = learning.questions[learning.currentQuestionIndex]
  return [
    learning.lesson.title,
    learning.lesson.objective,
    learning.lesson.concept,
    learning.lesson.whyAssigned,
    ...learning.lesson.sections.flatMap((section) => [
      section.title,
      section.explanation,
      section.coachPrompt,
    ]),
    ...(question
      ? [
          question.prompt,
          question.stimulus ?? "",
          ...question.choices.map((choice) => choice.text),
        ]
      : []),
  ].filter(Boolean)
}

export function answerFor(input: {
  request: ScoutAskRequest
  preferences: ScoutExplanationPreferences
  learning: LearningSessionPayload | null
  exam: Awaited<ReturnType<typeof getExam>>
  calibration?: AdaptiveCalibrationPayload | null
  studyPlan?: AdaptiveStudyPlan | null
  history?: ReadonlyArray<ScoutMessage>
}): ScoutAnswer {
  const { request, preferences, learning } = input
  const calibration = input.calibration ?? null
  const studyPlan = input.studyPlan ?? null
  const exam = request.screen === "lab" ? input.exam : null
  const examMode = exam
    ? exam.status === "in_progress" && exam.progress.phase === "questions"
      ? "timed-test"
      : "review"
    : "study"
  const learningQuestion = request.questionId
    ? learning?.questions.find((question) => question.id === request.questionId)
    : learning?.questions[learning.currentQuestionIndex]
  const examQuestion = request.questionId
    ? exam?.questions.find((question) => question.id === request.questionId)
    : exam?.questions[exam.progress.currentIndex]
  if (request.questionId && !learningQuestion && !examQuestion) {
    throw new RangeError("That question is not part of the current session.")
  }
  const activeQuestion = examMode === "study" ? learningQuestion : examQuestion
  const questionId = activeQuestion?.id ?? null
  const skillId =
    examQuestion?.primarySkill ??
    learningQuestion?.skill ??
    learning?.todaySkill ??
    null
  const attempted =
    examMode === "study"
      ? Boolean(
          questionId && learning?.answeredQuestionIds.includes(questionId)
        )
      : Boolean(questionId && exam?.progress.responses[questionId]?.choiceId)
  const permissions =
    examMode === "timed-test"
      ? ["TEST_MODE", "INTERFACE_HELP_ONLY"]
      : [
          "CAN_REPHRASE",
          "CAN_DEFINE",
          "CAN_HINT",
          attempted || examMode === "review"
            ? "CAN_EXPLAIN_AFTER_ATTEMPT"
            : "DIRECT_ANSWER_REQUIRES_ATTEMPT",
        ]
  const receiptBase = {
    questionId,
    skillId,
    permissions,
    checks: [
      "server-session-context",
      "server-question-state",
      "server-test-mode",
      "reviewed-source",
    ],
    assistanceMode: examMode,
  } as const
  const lower = request.question.toLowerCase()
  const answerSeeking =
    /\b(answer|which choice|tell me which|solve|eliminate)\b/.test(lower)
  const interfaceOnly =
    /\b(timer|flag|skip|submit|button|technical issue|navigate|move to|pace|pacing|timed practice|results|accuracy)\b/.test(
      lower
    )
  const intent = classifyScoutIntent({
    question: request.question,
    hasSelectedText: Boolean(request.selectedText),
  })
  const followup =
    /\b(another example|explain (that|this)|more simply|why does this matter|show (that|the) rule)\b/.test(
      lower
    )
  const previous = followup ? input.history?.at(-1) : undefined

  if (examMode === "timed-test" && !interfaceOnly) {
    return {
      summary:
        "I can only help with Test Lab controls while the timer is running.",
      explanation:
        "I cannot explain the question, give a hint, eliminate choices, or solve it during the timed section. Full help unlocks in review.",
      example: null,
      technical: "Timed state was read from the server-owned Test Lab session.",
      nextAction:
        "Keep working, flag the item, or finish the section and open review.",
      source: "Server-enforced Test Lab assistance policy",
      mode: "guarded",
      receipt: {
        ...receiptBase,
        delivery: "reviewed-interface-guidance",
        intent,
      },
    }
  }

  if (examMode === "study" && answerSeeking && !attempted) {
    return {
      summary: "I won’t choose the answer before you try.",
      explanation:
        "I can define a term or give a small starting hint. Your first independent choice is part of the evidence used for your plan.",
      example: null,
      technical: "Attempt state was read from the server learning session.",
      nextAction: "Ask for a small hint, then make your own first choice.",
      source: "Server-enforced practice assistance policy",
      mode: "guarded",
      receipt: {
        ...receiptBase,
        delivery: "reviewed-interface-guidance",
        intent,
      },
    }
  }

  const lessonTitle = learning?.lesson.title ?? "the current skill"
  const objective =
    learning?.lesson.objective ??
    "Use the reviewed rule on a new practice item."
  const rule =
    learning?.lesson.concept ??
    "Name what the question is testing before you compare the choices."
  const nextSkill = learning?.learningTwin.recommendation.label ?? lessonTitle
  const planReason =
    learning?.learningTwin.recommendation.reason ??
    "Scout needs more scored evidence before changing the mission."
  const review = questionId
    ? exam?.result?.review.find((item) => item.questionId === questionId)
    : null
  const corpus = [
    ...lessonCorpus(learning),
    ...(activeQuestion
      ? [
          activeQuestion.prompt,
          activeQuestion.stimulus ?? "",
          ...activeQuestion.choices.map((choice) => choice.text),
        ]
      : []),
  ]
  const groundedSelection = selectionIsGrounded(
    request.selectedText ?? "",
    corpus
  )
  let summary = `You are working on ${lessonTitle}.`
  let explanation = objective
  let example: string | null = null
  let nextAction = "Continue the current mission."
  let source = `Reviewed lesson ${learning?.lesson.id ?? "fallback"}`
  let delivery: ScoutAnswer["receipt"]["delivery"] = "reviewed-rule"

  if (previous) {
    summary = previous.answer.summary
    explanation = previous.answer.explanation
    example = previous.answer.example
    nextAction = previous.answer.nextAction
    source = `Follow-up to ${previous.answer.source}`
    if (/another example/.test(lower)) {
      example =
        previous.answer.receipt.intent === "calibration-definition"
          ? "For example, a standard error of 0.60 means ±0.60 in theta units. The separate 80% interval is wider because it uses ±1.281552 × standard error. Neither number maps to ACT points."
          : (learning?.lesson.workedExample.prompt ??
            `Try the same ${lessonTitle} rule on a new item before checking your work.`)
      nextAction =
        "Use the same rule on the new example without copying the earlier answer."
    } else if (/more simply|explain (that|this)/.test(lower)) {
      summary = plainWords(previous.answer.summary)
      explanation = plainWords(previous.answer.explanation)
      nextAction = "Say the idea back in one sentence, then continue."
    } else if (/why does this matter/.test(lower)) {
      explanation = `${previous.answer.explanation} It matters because Scout uses that evidence to choose what you practice next without pretending one answer proves everything.`
    } else if (/show (that|the) rule/.test(lower)) {
      explanation = rule
      nextAction =
        "Apply this rule to the current item before comparing choices."
    }
  } else if (
    request.screen === "lab" &&
    /which timed practice|which practice|should i choose/.test(lower)
  ) {
    summary = "Choose the run that matches how much you want to practice."
    explanation =
      "Quick 12 is the shortest cross-section check. One-section practice contains 18–25 questions. Half-length contains 66 English, Math, and Reading questions."
    nextAction = "Choose the shortest mode that still matches today’s purpose."
    source = "Reviewed Timed Practice mode definitions"
    delivery = "reviewed-interface-guidance"
  } else if (request.screen === "lab" && /pace|pacing|timer/.test(lower)) {
    summary = "Use the timer shown for the mode you choose."
    explanation =
      "During a timed run, answer, flag, and move on. The clock continues while you navigate, and answer explanations unlock only after submission."
    nextAction =
      "Flag a question if you need to return before the section ends."
    source = "Reviewed Timed Practice timer and review rules"
    delivery = "reviewed-interface-guidance"
  } else if (
    request.screen === "lab" &&
    /results|what will scout|confidence|accuracy/.test(lower)
  ) {
    summary = "Timed Practice results stay inside Timed Practice."
    explanation =
      "The report shows raw accuracy, average time per answered question, and self-reported confidence labels. It does not update Today, My Week, or the skill web."
    nextAction =
      "Use the report as a practice observation, not a mastery score."
    source = "Reviewed Timed Practice result fields and sync boundary"
    delivery = "reviewed-interface-guidance"
  } else if (examMode === "timed-test" && interfaceOnly) {
    summary = "Use the Test Lab controls without changing the question content."
    explanation =
      "Flag saves the item for later. Skip moves on without selecting an answer. Submit is available when the section workflow allows it."
    nextAction = "Use the control you need, then return to the timed work."
    source = "Reviewed Test Lab interface guidance"
    delivery = "reviewed-interface-guidance"
  } else if (examMode === "review" && review) {
    summary = review.correct
      ? "Your submitted answer was correct."
      : "This item is ready to review."
    explanation = review.rationale
    nextAction =
      "Explain the rule in your own words, then try a different item."
    source = `Scored Test Lab review for ${review.questionId}`
  } else if (intent === "calibration-definition") {
    summary = calibration
      ? `Here, “margin of error” means Scout’s estimate is still about ±${calibration.estimate.standardError.toFixed(2)} on its internal scale.`
      : "Here, “margin of error” means Scout’s estimate is still shaky."
    explanation = calibration
      ? `A smaller ± number means the estimate is settling down. The shaded band shows the middle 80% of values Scout considers plausible, from ${calibration.estimate.interval80.low.toFixed(2)} to ${calibration.estimate.interval80.high.toFixed(2)} on its internal scale. These are not ACT score points, and the app uses preset question difficulty rather than national calibration.`
      : "A smaller ± number means Scout is less unsure. The shaded band shows the middle 80% of values Scout considers plausible. Both use Scout’s internal scale, not ACT score points, and Scout cannot read a current Quick Check session from this request."
    example = calibration
      ? `Current theta ${calibration.estimate.theta.toFixed(2)} is displayed as ${calibration.estimate.readinessIndex}/100 using round((theta + 3) ÷ 6 × 100). That display is not ACT readiness.`
      : null
    nextAction =
      "Keep answering independently, or take the full diagnostic for more evidence."
    source = "Reviewed Quick Check interface glossary"
    delivery = "reviewed-interface-guidance"
  } else if (intent === "selection-explanation") {
    if (groundedSelection) {
      summary = `The selected text belongs to the reviewed ${lessonTitle} material.`
      explanation = rule
      example = `Selected text: “${request.selectedText}”`
      nextAction =
        "Use the reviewed rule to restate the selection in your own words."
    } else {
      summary = "I can’t tie that selection to the reviewed lesson or question."
      explanation =
        "I will not invent a rule for text that is outside the current server-owned lesson and question context."
      example = request.selectedText
        ? `Selected text: “${request.selectedText}”`
        : null
      nextAction =
        "Select wording from the current lesson or ask about a named interface term."
      source = "Grounding check: no matching reviewed source"
      delivery = "reviewed-interface-guidance"
    }
  } else if (intent === "plan-reason") {
    if (request.screen === "plan") {
      summary = studyPlan
        ? "I can explain the calendar rules, but I cannot see which assignment you selected."
        : "I cannot read the dated calendar for this answer."
      explanation = studyPlan
        ? `The current calendar contains ${studyPlan.forecast.scheduledMinutes} minutes before test day. Scout considers lower skill estimates, fewer scored answers, section goals, reviews that are due, and whether work is marked Today or Next. The time check compares those minutes with a rough ${studyPlan.forecast.recommendedMinutes}-minute target; it does not prove the goal is reachable.`
        : "Open “Why this assignment is here” on My week. That panel stores the specific skill estimate, answer count, section target movement, review status, and fixed phase rule used for the selected task."
      example = null
      nextAction =
        "Open the selected assignment’s “Why this assignment is here” panel for its exact stored inputs."
      source = studyPlan
        ? "Server dated-plan fields and fixed scheduling rules"
        : "Capability boundary: no dated-plan context available"
    } else {
      summary = `${nextSkill} is the current next skill.`
      explanation = `${planReason} Scout combines four fixed signals: your estimated chance on a medium question, how settled the estimate is, how many answers support it, and whether you recently missed one. Your ACT goal is not part of this ranking.`
      example = null
      nextAction =
        "Open Progress and choose the skill to see the details behind this choice."
      source = "Server learning recommendation and fixed ranking rules"
    }
  } else if (intent === "estimate") {
    const selectedState = learning?.learningTwin.skills.find(
      (skill) => skill.skill === learning.todaySkill
    )
    summary = selectedState
      ? `${selectedState.label} is ${Math.round(selectedState.learnedProbability * 100)}% from ${selectedState.evidenceCount} scored ${selectedState.evidenceCount === 1 ? "answer" : "answers"}.`
      : "Scout does not have enough scored evidence for a skill estimate yet."
    explanation = selectedState
      ? `This is Scout’s practice estimate, not percent correct or an ACT score. The technical method is Bayesian Knowledge Tracing (BKT), which updates one skill at a time from scored answers. Its starting source is ${selectedState.priorSource}; the estimate-status label comes from answer count and how settled the estimate is.`
      : "No current skill state was available."
    nextAction =
      "Open Progress and choose the skill to see the answers behind the estimate."
    source = "Server learning state"
  } else if (intent === "hint") {
    summary = "Start by naming the rule before comparing choices."
    explanation = rule
    example =
      "Cross out a choice only when you can name the exact rule it breaks."
    nextAction = "Use the first guided hint, then make your own choice."
  } else if (intent === "example") {
    summary = "Use the same decision on a fresh example."
    explanation = rule
    example = learning?.lesson.workedExample.prompt ?? null
    nextAction = "Say which rule you would check first."
  } else if (intent === "rule" || intent === "simplify") {
    summary = rule
    explanation = objective
    nextAction =
      "Say the rule once in your own words, then use it on the next item."
  } else if (request.screen === "plan") {
    summary = studyPlan
      ? `${studyPlan.availability.entries.length} weekdays and ${studyPlan.forecast.weeklyCapacity} minutes per week are available to the calendar generator.`
      : "Scout cannot read the dated calendar in this answer."
    explanation = studyPlan
      ? `${studyPlan.forecast.scheduledMinutes} minutes are scheduled before test day. The rough internal target is ${studyPlan.forecast.recommendedMinutes} minutes, calculated as 120 + 25 per planned section-score point + 15 per skill estimate below 65%. This is not evidence that the goal is reachable.`
      : "Open My week to inspect the calendar. The assistant currently has only the learning-session context."
    nextAction = "Edit your availability if the schedule no longer fits."
    source = "Server study-plan inputs and learning state"
  } else if (request.screen === "calibrate") {
    summary = calibration
      ? `Quick Check has recorded ${calibration.responseCount} of at most ${calibration.maximumItems} answers.`
      : "Quick Check uses 8–12 questions."
    explanation =
      "It stops at 12, or after at least 8 when English, Math, and Reading each have two answers and standard error is 0.56 or lower. The next item’s ranking is Fisher information plus section and skill coverage bonuses. Confidence does not affect IRT, selection, or stopping."
    nextAction =
      "Answer independently; use the full diagnostic if you want more evidence."
    source = "Reviewed Quick Check behavior"
    delivery = "reviewed-interface-guidance"
  }

  const personalized = applyPreferences(
    {
      summary,
      explanation,
      example,
      technical:
        "This response used the current lesson, result, or plan fields named under Source. Scout did not read the rest of the visible screen.",
      nextAction,
      source,
      mode: "grounded",
    },
    preferences
  )

  return {
    ...personalized,
    receipt: {
      ...receiptBase,
      checks: previous
        ? [...receiptBase.checks, "server-conversation-history"]
        : receiptBase.checks,
      delivery,
      intent,
    },
  }
}

async function ensureScoutSession(request: NextRequest) {
  return scoutSessions.getOrCreate(
    request.cookies.get(SCOUT_COOKIE)?.value ?? null
  )
}

function errorResponse(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof Error ? error.message : "Scout could not answer that.",
    },
    { status: 400 }
  )
}

export async function GET(request: NextRequest) {
  try {
    const session = await ensureScoutSession(request)
    const response = NextResponse.json(session.state)
    response.headers.set("Cache-Control", "no-store")
    setScoutCookie(response, session.sessionId)
    await syncLinkedSession(request, "scout", session.sessionId)
    return response
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const session = await ensureScoutSession(request)
    const state = await scoutSessions.updatePreferences(
      session.sessionId,
      parsePreferences(body.preferences),
      text(body.preferencesUpdatedAt, 40) || undefined
    )
    const response = NextResponse.json(state)
    response.headers.set("Cache-Control", "no-store")
    setScoutCookie(response, session.sessionId)
    await syncLinkedSession(request, "scout", session.sessionId)
    return response
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const question = text(body.question, 500)
    if (!question) throw new RangeError("Ask Scout a question first.")
    const scout = await ensureScoutSession(request)
    const scoutRequest: ScoutAskRequest = {
      question,
      screen: parseScreen(body.screen),
      questionId: text(body.questionId, 160) || null,
      selectedText: text(body.selectedText, 400) || null,
    }
    const [learning, exam, calibration, studyPlan] = await Promise.all([
      getLearning(request),
      scoutRequest.screen === "lab" ? getExam(request) : Promise.resolve(null),
      scoutRequest.screen === "calibrate"
        ? getCalibration(request)
        : Promise.resolve(null),
      scoutRequest.screen === "plan"
        ? getStudyPlan(request)
        : Promise.resolve(null),
    ])
    const answer = answerFor({
      request: scoutRequest,
      preferences: scout.state.preferences,
      learning,
      exam,
      calibration,
      studyPlan,
      history: scout.state.messages.slice(-6),
    })
    const message = {
      id: randomUUID(),
      askedAt: new Date().toISOString(),
      question,
      answer,
    }
    const state = await scoutSessions.appendMessage(scout.sessionId, message)
    const response = NextResponse.json({
      answer,
      messages: state.messages,
      preferences: state.preferences,
      preferencesVersion: state.preferencesVersion,
      preferencesUpdatedAt: state.preferencesUpdatedAt,
    })
    response.headers.set("Cache-Control", "no-store")
    setScoutCookie(response, scout.sessionId)
    await syncLinkedSession(request, "scout", scout.sessionId)
    return response
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(SCOUT_COOKIE)?.value
    if (sessionId) await scoutSessions.reset(sessionId)
    await syncLinkedSession(request, "scout", null)
    const response = NextResponse.json({ reset: true })
    response.cookies.delete(SCOUT_COOKIE)
    return response
  } catch (error) {
    return errorResponse(error)
  }
}
