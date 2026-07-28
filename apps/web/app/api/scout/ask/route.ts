import { randomUUID } from "node:crypto"

import {
  buildMotivationBadges,
  classifyScoutIntent,
  POINTS_PER_MOMENTUM_LEVEL,
  SCOUT_SCREENS,
  type AdaptiveCalibrationPayload,
  type AdaptiveStudyPlan,
  type LearningSessionPayload,
  type ScoutAnswer,
  type ScoutAskRequest,
  type ScoutBadgeProgress,
  type ScoutExplanationPreferences,
  type ScoutMessage,
  type ScoutScreen,
} from "@act-tutor/core"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { syncLinkedSession } from "@/lib/auth.server"
import { CALIBRATION_BANK, calibrationSessions } from "@/lib/calibration.server"
import { getExamLabSession } from "@/lib/exam-lab.server"
import { LEARNING_BANK } from "@/lib/learning-content.server"
import { learningSessions } from "@/lib/learning-sessions.server"
import {
  answerWithMrKimAI,
  isMrKimAIAvailable,
  mrKimSafetyIdentifier,
} from "@/lib/mr-kim-ai.server"
import { scoutSessions } from "@/lib/scout-sessions.server"
import { studyPlanSessions } from "@/lib/study-plan.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SCOUT_COOKIE = "ai_act_scout_session"
const LEARNING_COOKIE = "ai_act_learning_session"
const EXAM_COOKIE = "scout_exam_lab_session"
const CALIBRATION_COOKIE = "ai_act_calibration_session"
const STUDY_PLAN_COOKIE = "scout_study_plan_session"
const SCREENS = new Set<ScoutScreen>(SCOUT_SCREENS)

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

export function parseScreen(value: unknown): ScoutScreen {
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
    return (await getExamLabSession(sessionId)).session
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
    summary = plainWords(summary)
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

function badgeProgressFor(
  learning: LearningSessionPayload | null
): ScoutBadgeProgress | null {
  if (!learning) return null
  const secureSkills = learning.learningTwin.skills.filter(
    (skill) => skill.learnedProbability >= 0.82 && skill.evidenceCount >= 6
  ).length
  const totalSkills = Math.max(1, learning.learningTwin.skills.length)
  const badges = buildMotivationBadges({
    points: learning.mission.progress.xp,
    currentStreak: learning.mission.progress.currentStreak,
    longestStreak: learning.mission.progress.longestStreak,
    completedLessons: learning.cycle.completedSkills.length,
    completedSets: learning.mission.progress.completedSets,
    totalAnswered: learning.mission.progress.totalAnswered,
    secureSkills,
    totalSkills,
  })
  const nextBadge =
    badges
      .filter((badge) => !badge.earned)
      .sort(
        (left, right) =>
          right.progress / right.target - left.progress / left.target
      )[0] ?? null
  return {
    points: learning.mission.progress.xp,
    currentStreak: learning.mission.progress.currentStreak,
    secureSkills,
    totalSkills,
    earnedCount: badges.filter((badge) => badge.earned).length,
    totalCount: badges.length,
    nextBadge: nextBadge
      ? {
          id: nextBadge.id,
          title: nextBadge.title,
          description: nextBadge.description,
          progress: nextBadge.progress,
          target: nextBadge.target,
        }
      : null,
  }
}

function mrKimGroundingFacts(input: {
  request: ScoutAskRequest
  answer: ScoutAnswer
  learning: LearningSessionPayload | null
  exam: Awaited<ReturnType<typeof getExam>>
  calibration: AdaptiveCalibrationPayload | null
  studyPlan: AdaptiveStudyPlan | null
  badgeProgress: ScoutBadgeProgress | null
}) {
  const facts = [
    `The current screen is ${input.request.screen}.`,
    `The reviewed source is ${input.answer.source}.`,
    `The reviewed summary is: ${input.answer.summary}`,
    `The reviewed explanation is: ${input.answer.explanation}`,
    `The allowed next step is: ${input.answer.nextAction}`,
  ]
  if (input.learning && input.request.screen !== "badges") {
    const question = input.request.questionId
      ? input.learning.questions.find(
          (item) => item.id === input.request.questionId
        )
      : input.learning.questions[input.learning.currentQuestionIndex]
    facts.push(
      `The current lesson is ${input.learning.lesson.title}.`,
      `The lesson objective is: ${input.learning.lesson.objective}`,
      `The reviewed lesson rule is: ${input.learning.lesson.concept}`,
      ...input.learning.lesson.sections.map(
        (section) =>
          `${section.title}: ${section.explanation} Coach guidance: ${section.coachPrompt}`
      )
    )
    if (question && input.learning.answeredQuestionIds.includes(question.id)) {
      facts.push(`The attempted question prompt is: ${question.prompt}`)
      if (input.learning.lastFeedback?.questionId === question.id) {
        facts.push(
          `The submitted answer was ${input.learning.lastFeedback.correct ? "correct" : "incorrect"}.`,
          `The reviewed rationale is: ${input.learning.lastFeedback.rationale}`
        )
      }
    }
  }
  if (input.answer.receipt.assistanceMode === "review" && input.exam?.result) {
    facts.push(
      "The learner has submitted the timed work and answer review is unlocked."
    )
  }
  if (input.calibration) {
    facts.push(
      `The starting check has ${input.calibration.responseCount} recorded responses.`,
      `Its internal estimate standard error is ${input.calibration.estimate.standardError.toFixed(2)}; this is not an ACT score.`
    )
  }
  if (input.studyPlan) {
    facts.push(
      `The learner's test date is ${input.studyPlan.testDate}.`,
      `The current planning section scores are English ${input.studyPlan.current.english}, Math ${input.studyPlan.current.math}, and Reading ${input.studyPlan.current.reading}.`,
      `The target section scores are English ${input.studyPlan.target.english}, Math ${input.studyPlan.target.math}, and Reading ${input.studyPlan.target.reading}.`,
      `The dated plan schedules ${input.studyPlan.forecast.scheduledMinutes} minutes before test day.`,
      `The learner currently has ${input.studyPlan.forecast.weeklyCapacity} available minutes per week.`
    )
  }
  if (input.badgeProgress) {
    facts.push(
      `The learner has earned ${input.badgeProgress.earnedCount} of ${input.badgeProgress.totalCount} badges.`,
      `The learner has ${input.badgeProgress.points} study points and a ${input.badgeProgress.currentStreak}-day current streak.`,
      `The learner has ${input.badgeProgress.secureSkills} of ${input.badgeProgress.totalSkills} secure skills.`
    )
    if (input.badgeProgress.nextBadge) {
      facts.push(
        `The next badge is ${input.badgeProgress.nextBadge.title} at ${input.badgeProgress.nextBadge.progress} of ${input.badgeProgress.nextBadge.target}: ${input.badgeProgress.nextBadge.description}`
      )
    }
  }
  return facts
}

export function answerFor(input: {
  request: ScoutAskRequest
  preferences: ScoutExplanationPreferences
  learning: LearningSessionPayload | null
  exam: Awaited<ReturnType<typeof getExam>>
  calibration?: AdaptiveCalibrationPayload | null
  studyPlan?: AdaptiveStudyPlan | null
  badgeProgress?: ScoutBadgeProgress | null
  history?: ReadonlyArray<ScoutMessage>
}): ScoutAnswer {
  const { request, preferences, learning } = input
  const calibration = input.calibration ?? null
  const studyPlan = input.studyPlan ?? null
  const badgeProgress = input.badgeProgress ?? null
  const exam = request.screen === "lab" ? input.exam : null
  const examMode = exam
    ? exam.status === "in_progress" && exam.progress.phase === "questions"
      ? "timed-test"
      : "review"
    : "study"
  const learningQuestion =
    request.screen === "today"
      ? request.questionId
        ? learning?.questions.find(
            (question) => question.id === request.questionId
          )
        : learning?.questions[learning.currentQuestionIndex]
      : undefined
  const examQuestion = request.questionId
    ? exam?.questions.find((question) => question.id === request.questionId)
    : exam?.questions[exam.progress.currentIndex]
  if (request.questionId && !learningQuestion && !examQuestion) {
    throw new RangeError("That question is not part of the current session.")
  }
  const activeQuestion = examMode === "study" ? learningQuestion : examQuestion
  const questionId = activeQuestion?.id ?? null
  const skillId =
    request.screen === "badges"
      ? null
      : (examQuestion?.primarySkill ??
        learningQuestion?.skill ??
        learning?.todaySkill ??
        null)
  const attempted =
    examMode === "study"
      ? Boolean(
          questionId && learning?.answeredQuestionIds.includes(questionId)
        )
      : Boolean(questionId && exam?.progress.responses[questionId]?.choiceId)
  const permissions =
    request.screen === "badges"
      ? ["CAN_EXPLAIN_BADGE_PROGRESS", "NO_SCORE_CLAIMS"]
      : examMode === "timed-test"
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
        "I can only help with Timed Practice controls while the timer is running.",
      explanation:
        "I cannot explain the question, give a hint, eliminate choices, or solve it during the timed section. Full help unlocks in review.",
      example: null,
      technical:
        "Timed state was read from the server-owned Timed Practice session.",
      nextAction:
        "Keep working, flag the item, or finish the section and open review.",
      source: "Server-enforced Timed Practice assistance policy",
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
  const nextSkill =
    request.screen === "today"
      ? lessonTitle
      : (learning?.learningTwin.recommendation.label ?? lessonTitle)
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

  if (previous && request.screen !== "badges") {
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
      nextAction = "Try the new example, then check your work."
    } else if (/more simply|explain (that|this)/.test(lower)) {
      summary = plainWords(previous.answer.summary)
      explanation = plainWords(previous.answer.explanation)
      nextAction = "Use the simpler version on the current question."
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
      "Quick 12 is the shortest cross-section check. One-section practice contains 36–50 questions. Full-length contains 131 English, Math, and Reading questions."
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
      "The report shows raw accuracy and average time per answered question. It does not update Lessons, My Week, or the skill web."
    nextAction =
      "Use the report as a practice observation, not a mastery score."
    source = "Reviewed Timed Practice result fields and sync boundary"
    delivery = "reviewed-interface-guidance"
  } else if (examMode === "timed-test" && interfaceOnly) {
    summary =
      "Use the Timed Practice controls without changing the question content."
    explanation =
      "Flag saves the item for later. Skip moves on without selecting an answer. Submit is available when the section workflow allows it."
    nextAction = "Use the control you need, then return to the timed work."
    source = "Reviewed Timed Practice interface guidance"
    delivery = "reviewed-interface-guidance"
  } else if (examMode === "review" && review) {
    summary = review.correct
      ? "Your submitted answer was correct."
      : "This item is ready to review."
    explanation = review.rationale
    nextAction = "Use the explanation on a different item."
    source = `Scored Timed Practice review for ${review.questionId}`
  } else if (request.screen === "badges") {
    if (badgeProgress) {
      const nextBadge = badgeProgress.nextBadge
      const asksAboutNext = /\b(next|closest|earn|unlock|progress)\b/.test(
        lower
      )
      summary =
        asksAboutNext && nextBadge
          ? `${nextBadge.title} is your closest badge.`
          : `${badgeProgress.earnedCount} of ${badgeProgress.totalCount} badges are earned.`
      explanation = nextBadge
        ? `You have ${badgeProgress.points.toLocaleString("en-US")} points, a ${badgeProgress.currentStreak}-day streak, and ${badgeProgress.secureSkills} of ${badgeProgress.totalSkills} secure skills. ${nextBadge.title} is at ${nextBadge.progress} of ${nextBadge.target}.`
        : `You have earned every current badge. You have ${badgeProgress.points.toLocaleString("en-US")} points and a ${badgeProgress.currentStreak}-day streak.`
      example = `${POINTS_PER_MOMENTUM_LEVEL.toLocaleString("en-US")} study points earn one momentum level. Momentum levels reward studying; they never change or predict an ACT score.`
      nextAction = nextBadge
        ? nextBadge.description
        : "Keep studying to protect your streak and secure skills."
      source = "Server learning progress and fixed badge rules"
      delivery = "reviewed-interface-guidance"
    } else {
      summary = "I cannot read badge progress for this session yet."
      explanation =
        "Open a lesson once so Scout can load the server-owned progress used by Badges."
      example = null
      nextAction =
        "Return to Lessons, load your current path, then open Badges."
      source = "Capability boundary: no badge progress context available"
      delivery = "reviewed-interface-guidance"
    }
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
      nextAction = "Use the reviewed rule on the current question."
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
        ? `Your calendar uses your available days, test date, and skills that need practice. ${studyPlan.forecast.scheduledMinutes} minutes are currently scheduled before test day.`
        : "Open “Why this is scheduled” on My week."
      example = null
      nextAction =
        "Open the selected assignment’s “Why this is scheduled” panel."
      source = studyPlan
        ? "Server dated-plan fields and fixed scheduling rules"
        : "Capability boundary: no dated-plan context available"
    } else {
      summary = `${nextSkill} is the current next skill.`
      explanation =
        "Scout chose it from your recent scored answers and where more practice will help most."
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
      ? "This study estimate comes from your scored answers for this skill. More answers make it steadier."
      : "No current skill state was available."
    nextAction =
      "Open Progress and choose the skill to see the answers behind the estimate."
    source = "Server learning state"
  } else if (intent === "hint") {
    summary = "Start with the first decision step."
    explanation = rule
    example = "Cross out a choice when it clearly conflicts with the lesson."
    nextAction = "Use the first guided hint, then make your own choice."
  } else if (intent === "example") {
    summary = "Use the same decision on a fresh example."
    explanation = rule
    example = learning?.lesson.workedExample.prompt ?? null
    nextAction = "Apply the first step before comparing choices."
  } else if (intent === "rule" || intent === "simplify") {
    summary = rule
    explanation = objective
    nextAction = "Use this on the next item."
  } else if (request.screen === "plan") {
    summary = studyPlan
      ? `${studyPlan.availability.entries.length} weekdays and ${studyPlan.forecast.weeklyCapacity} minutes per week are available to the calendar generator.`
      : "Scout cannot read the dated calendar in this answer."
    explanation = studyPlan
      ? `${studyPlan.forecast.scheduledMinutes} minutes are scheduled before test day. You can change the available days or minutes from My week.`
      : "Open My week to inspect the calendar. The assistant currently has only the learning-session context."
    nextAction = "Edit your availability if the schedule no longer fits."
    source = "Server study-plan inputs and learning state"
  } else if (request.screen === "calibrate") {
    summary = calibration
      ? `Quick Check has recorded ${calibration.responseCount} of at most ${calibration.maximumItems} answers.`
      : "Quick Check uses 8–12 questions."
    explanation =
      "Quick Check asks 8–12 questions and stops once it has enough coverage across English, Math, and Reading."
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
        request.screen === "badges"
          ? "This response used server-owned mission totals, skill estimates, and fixed badge thresholds. It did not turn points into a diagnostic score."
          : "This response used the current lesson, result, or plan fields named under Source. Scout did not read the rest of the visible screen.",
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
      checks: [
        ...receiptBase.checks,
        ...(request.screen === "badges" && badgeProgress
          ? ["server-badge-progress"]
          : []),
        ...(previous ? ["server-conversation-history"] : []),
      ],
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
    const response = NextResponse.json({
      ...session.state,
      aiAvailable: isMrKimAIAvailable(),
    })
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
      getStudyPlan(request),
    ])
    const badgeProgress =
      scoutRequest.screen === "badges" ? badgeProgressFor(learning) : null
    const screenHistory = scout.state.messages
      .filter((message) => (message.screen ?? "today") === scoutRequest.screen)
      .slice(-12)
    const reviewedAnswer = answerFor({
      request: scoutRequest,
      preferences: scout.state.preferences,
      learning,
      exam,
      calibration,
      studyPlan,
      badgeProgress,
      history: screenHistory.slice(-6),
    })
    const answer = await answerWithMrKimAI(
      {
        request: scoutRequest,
        fallback: reviewedAnswer,
        groundingFacts: mrKimGroundingFacts({
          request: scoutRequest,
          answer: reviewedAnswer,
          learning,
          exam,
          calibration,
          studyPlan,
          badgeProgress,
        }),
        history: screenHistory,
      },
      {
        safetyIdentifier: await mrKimSafetyIdentifier(scout.sessionId),
      }
    )
    const message: ScoutMessage = {
      id: randomUUID(),
      askedAt: new Date().toISOString(),
      screen: scoutRequest.screen,
      question,
      answer,
    }
    const state = await scoutSessions.appendMessage(scout.sessionId, message)
    const response = NextResponse.json({
      aiAvailable: isMrKimAIAvailable(),
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
