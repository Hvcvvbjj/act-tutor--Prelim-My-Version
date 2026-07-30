import {
  UNANSWERED_DIAGNOSTIC_CHOICE_ID,
  type DiagnosticFormPublic,
  type DiagnosticResult,
  type ExamLabSessionPayload,
} from "@act-tutor/core"

import type {
  AssessmentHistoryEntry,
  AssessmentHistoryMistake,
} from "@/components/tutor/types"

const MAX_ASSESSMENT_HISTORY_ENTRIES = 64

function choiceText(
  choices: ReadonlyArray<{ id: string; text: string }>,
  choiceId: string | null
) {
  if (!choiceId || choiceId === UNANSWERED_DIAGNOSTIC_CHOICE_ID) {
    return "No answer"
  }
  return (
    choices.find((choice) => choice.id === choiceId)?.text ??
    "Answer unavailable"
  )
}

export function buildDiagnosticHistoryEntry(input: {
  result: DiagnosticResult
  form: DiagnosticFormPublic
  attemptId: string
  completedAt?: string
}): AssessmentHistoryEntry {
  const questionMap = new Map(
    input.form.questions.map((question) => [question.id, question])
  )
  const mistakes = input.result.feedback.flatMap(
    (feedback): AssessmentHistoryMistake[] => {
      if (feedback.correct) return []
      const question = questionMap.get(feedback.questionId)
      if (!question) return []
      return [
        {
          id: `${input.attemptId}:${feedback.questionId}`,
          questionId: feedback.questionId,
          section: question.section,
          skill: question.primarySkill,
          skillLabel: question.skillLabel,
          prompt: question.prompt,
          selectedChoiceText: choiceText(
            question.choices,
            feedback.selectedChoiceId
          ),
          correctChoiceText: choiceText(
            question.choices,
            feedback.correctChoiceId
          ),
          rationale: feedback.rationale,
        },
      ]
    }
  )

  return {
    id: `diagnostic:${input.attemptId}`,
    kind: "diagnostic",
    title:
      input.form.mode === "rapid" ? "66-question diagnostic" : "ACT diagnostic",
    completedAt: input.completedAt ?? new Date().toISOString(),
    correct: input.result.feedback.filter((feedback) => feedback.correct)
      .length,
    total: input.result.feedback.length,
    compositeScore: input.result.compositeRange.estimate,
    sectionScores: input.result.planningBaseline,
    mistakes,
  }
}

export function buildFullTestHistoryEntry(input: {
  session: ExamLabSessionPayload
  completedAt?: string
}): AssessmentHistoryEntry | null {
  const result = input.session.result
  if (input.session.mode !== "core" || !result) return null
  const questionMap = new Map(
    input.session.questions.map((question) => [question.id, question])
  )
  const mistakes = result.review.flatMap(
    (review): AssessmentHistoryMistake[] => {
      if (review.correct) return []
      const question = questionMap.get(review.questionId)
      if (!question) return []
      return [
        {
          id: `${input.session.id}:${review.questionId}`,
          questionId: review.questionId,
          section: review.section,
          skill: review.skill,
          skillLabel: review.skillLabel,
          prompt: question.prompt,
          selectedChoiceText: choiceText(
            question.choices,
            review.selectedChoiceId
          ),
          correctChoiceText: choiceText(
            question.choices,
            review.correctChoiceId
          ),
          rationale: review.rationale,
        },
      ]
    }
  )
  const sectionScores = Object.fromEntries(
    result.sections.map((section) => [
      section.section,
      section.practiceEstimate,
    ])
  ) as AssessmentHistoryEntry["sectionScores"]

  if (
    !Number.isInteger(sectionScores.english) ||
    !Number.isInteger(sectionScores.math) ||
    !Number.isInteger(sectionScores.reading)
  ) {
    return null
  }

  return {
    id: `full-test:${input.session.id}`,
    kind: "full-test",
    title: "Full-length ACT practice test",
    completedAt:
      input.completedAt ??
      result.debrief.generation.generatedAt ??
      input.session.progress.updatedAt,
    correct: result.correct,
    total: result.total,
    compositeScore: result.practiceEstimate.estimate,
    sectionScores,
    mistakes,
  }
}

export function addAssessmentHistoryEntry(
  history: ReadonlyArray<AssessmentHistoryEntry>,
  entry: AssessmentHistoryEntry
) {
  return [entry, ...history.filter((candidate) => candidate.id !== entry.id)]
    .sort(
      (left, right) =>
        right.completedAt.localeCompare(left.completedAt) ||
        right.id.localeCompare(left.id)
    )
    .slice(0, MAX_ASSESSMENT_HISTORY_ENTRIES)
}
