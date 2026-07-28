export type PracticeExplanationStyle = "step-by-step" | "compare" | "simple"

interface PracticeChoice {
  id: string
  text: string
}

interface PracticeExplanationInput {
  correct: boolean
  rationale: string
  selectedChoiceId: string
  correctChoiceId: string
  choices: readonly PracticeChoice[]
  concept: string
  strategyChecklist: readonly string[]
  style: PracticeExplanationStyle
}

export interface PracticeExplanation {
  title: string
  lines: readonly string[]
  ordered: boolean
}

export function lessonSectionsForDisplay<T extends { id: string }>(
  sections: readonly T[]
) {
  return sections.filter((section) => section.id !== "transfer")
}

function firstSentence(value: string) {
  return value.split(/(?<=[.!?])\s+/)[0] ?? value
}

export function lessonSegmentMinutes(
  totalMinutes: number,
  sectionCount: number,
  sectionIndex: number
) {
  const count = Math.max(1, Math.round(sectionCount))
  const total = Math.max(count, Math.round(totalMinutes))
  const index = Math.max(0, Math.min(count - 1, Math.round(sectionIndex)))
  const base = Math.floor(total / count)
  const remainder = total % count
  return base + (index < remainder ? 1 : 0)
}

export function shouldHoldPracticeFeedback({
  status,
  currentQuestionId,
  feedbackQuestionId,
  feedbackIdentity,
  dismissedFeedbackIdentity,
}: {
  status: string
  currentQuestionId?: string
  feedbackQuestionId?: string
  feedbackIdentity?: string
  dismissedFeedbackIdentity: string | null
}) {
  return Boolean(
    currentQuestionId &&
    feedbackQuestionId &&
    feedbackIdentity &&
    (status === "complete" || currentQuestionId !== feedbackQuestionId) &&
    feedbackIdentity !== dismissedFeedbackIdentity
  )
}

export function shouldShowRoundTransition({
  cycleStatus,
  workspaceOpen,
  activeTab,
}: {
  cycleStatus: string | undefined
  workspaceOpen: boolean
  activeTab: string
}) {
  return (
    cycleStatus === "assessment-choice" &&
    !(workspaceOpen && activeTab === "today")
  )
}

export function buildPracticeExplanation({
  correct,
  rationale,
  correctChoiceId,
  choices,
}: PracticeExplanationInput): PracticeExplanation {
  if (correct) {
    return {
      title: "Correct",
      lines: [rationale],
      ordered: false,
    }
  }

  const correctChoice =
    choices.find((choice) => choice.id === correctChoiceId)?.text ??
    correctChoiceId

  return {
    title: "Review",
    lines: [`The answer is ${correctChoice}. ${firstSentence(rationale)}`],
    ordered: false,
  }
}
