import { randomUUID } from "node:crypto"

import {
  classifyScoutIntent,
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
import { examLabSessions } from "@/lib/exam-lab.server"
import { LEARNING_BANK } from "@/lib/learning-content.server"
import { learningSessions } from "@/lib/learning-sessions.server"
import { scoutSessions } from "@/lib/scout-sessions.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SCOUT_COOKIE = "ai_act_scout_session"
const LEARNING_COOKIE = "ai_act_learning_session"
const EXAM_COOKIE = "scout_exam_lab_session"
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
    .replaceAll(/uncertainty/gi, "how unsure Scout is")
    .replaceAll(/independent evidence/gi, "answers you gave without help")
    .replaceAll(/learner model/gi, "skill tracker")
    .replaceAll(/mastery estimate/gi, "skill estimate")
}

function exampleForStyle(
  style: ScoutExplanationPreferences["exampleStyle"],
  base: string | null,
  lessonTitle: string
) {
  if (!base) return null
  const example = base
  if (style === "school") {
    return `School example: before turning in a ${lessonTitle} answer, underline the clue that triggers the rule. ${example}`
  }
  if (style === "sports") {
    return `Sports example: treat the rule like a boundary line—check it before calling the play. ${example}`
  }
  if (style === "gaming") {
    return `Gaming example: identify the rule like a game mechanic before selecting your move. ${example}`
  }
  return `Everyday example: pause, name the rule, and then make the choice. ${example}`
}

function applyPreferences(
  answer: Omit<ScoutAnswer, "receipt">,
  preferences: ScoutExplanationPreferences,
  lessonTitle: string
) {
  let summary = answer.summary
  let explanation = answer.explanation
  let technical = answer.technical
  if (preferences.readingLevel === "plain") {
    summary = `In plain words: ${plainWords(summary)}`
    explanation = plainWords(explanation)
  } else if (preferences.readingLevel === "advanced") {
    explanation +=
      " Advanced view: Scout separates the estimated skill level from how certain that estimate is."
  }
  if (preferences.fewerTechnicalTerms) {
    summary = plainWords(summary)
    explanation = plainWords(explanation)
    technical = plainWords(technical)
  } else {
    explanation +=
      " Technical note: Scout tracks evidence weight and confidence separately from whether the answer was correct."
    technical +=
      " · Technical terms stay visible: evidence weight, confidence, and server state"
  }
  if (preferences.depth === "quick") {
    explanation = concise(explanation, preferences)
  } else if (preferences.depth === "detailed") {
    explanation += ` Walkthrough: first identify what ${lessonTitle} is testing, then apply the reviewed rule, and only then compare the choices.`
  }
  return {
    ...answer,
    summary,
    explanation,
    example: exampleForStyle(
      preferences.exampleStyle,
      answer.example,
      lessonTitle
    ),
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
  history?: ReadonlyArray<ScoutMessage>
}): ScoutAnswer {
  const { request, preferences, learning } = input
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
    /\b(timer|flag|skip|submit|button|technical issue|navigate|move to)\b/.test(
      lower
    )
  const intent = classifyScoutIntent({
    question: request.question,
    hasSelectedText: Boolean(request.selectedText),
  })
  const followup =
    /\b(another example|explain (that|this)|more simply|why does this matter|show (that|the) rule|let me try one)\b/.test(
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
          ? "If Scout stops after eight questions with a 24–27 range, it has enough information to plan. A full diagnostic may narrow that range."
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
    summary =
      "Margin of error means Scout is still unsure about the exact starting level."
    explanation =
      "A wider range means the short check has less evidence. As you answer useful questions across English, math, and reading, the range can narrow. It is a planning range, not an official ACT score."
    example =
      "If the estimate says 20–25, Scout is saying your current evidence fits several nearby starting levels—not that you earned one exact score."
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
    summary = `${nextSkill} is the current next mission.`
    explanation = planReason
    example = learning
      ? `${learning.planCounterfactual.correctOutcome} ${learning.planCounterfactual.incorrectOutcome}`
      : null
    nextAction =
      "Open My Skills to inspect the scored evidence behind the choice."
    source = "Server learning recommendation and scored evidence"
  } else if (intent === "estimate") {
    const selectedState = learning?.learningTwin.skills.find(
      (skill) => skill.skill === learning.todaySkill
    )
    summary = selectedState
      ? `The current practice estimate is ${Math.round(selectedState.learnedProbability * 100)}%.`
      : "Scout does not have enough scored evidence for a skill estimate yet."
    explanation =
      "This is an internal practice estimate, not an ACT score. Its certainty depends on how much independent evidence Scout has collected."
    nextAction =
      "Open the Evidence Timeline to see the answers behind the estimate."
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
    summary = "The schedule uses the days and minutes you said are available."
    explanation = planReason
    nextAction = "Edit your availability if the schedule no longer fits."
    source = "Server study-plan inputs and learning state"
  } else if (request.screen === "calibrate") {
    summary =
      "Quick Check chooses a useful next question, then stops at its evidence limit."
    explanation =
      "It checks all three core sections and uses each scored response to choose the next item. The result is only a planning baseline."
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
      technical: `Context and permissions derived on the server · ${examMode}`,
      nextAction,
      source,
      mode: "grounded",
    },
    preferences,
    lessonTitle
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
    const [learning, exam] = await Promise.all([
      getLearning(request),
      scoutRequest.screen === "lab" ? getExam(request) : Promise.resolve(null),
    ])
    const answer = answerFor({
      request: scoutRequest,
      preferences: scout.state.preferences,
      learning,
      exam,
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
    return response
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(SCOUT_COOKIE)?.value
    if (sessionId) await scoutSessions.reset(sessionId)
    const response = NextResponse.json({ reset: true })
    response.cookies.delete(SCOUT_COOKIE)
    return response
  } catch (error) {
    return errorResponse(error)
  }
}
