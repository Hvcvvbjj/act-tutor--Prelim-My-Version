import type { KnowledgeState } from "@act-tutor/core"

type MasteryEvidenceState = Pick<
  KnowledgeState,
  "baselineEvidence" | "evidenceCount" | "observations" | "priorSource"
>

function scoredAnswerCopy(count: number) {
  return `${count} scored ${count === 1 ? "answer" : "answers"}`
}

export function describeMasteryEvidenceOrigin(state: MasteryEvidenceState) {
  if (state.priorSource === "diagnostic" && state.baselineEvidence > 0) {
    if (state.observations > 0) {
      return `${state.baselineEvidence} from your diagnostic · ${state.observations} from later lessons or Quick Check`
    }

    return `All ${state.baselineEvidence} came from your diagnostic.`
  }

  if (state.priorSource === "score-estimate") {
    if (state.observations > 0) {
      return `Started from the score you entered · ${scoredAnswerCopy(state.observations)} from later lessons or Quick Check`
    }

    return "Starting point comes from the score you entered; no skill-specific answers yet."
  }

  if (state.evidenceCount > 0) {
    return `${scoredAnswerCopy(state.observations)} from lessons or Quick Check.`
  }

  return "Neutral starting point; no skill-specific answers yet."
}

export function describeMasteryStartingEvidence(state: MasteryEvidenceState) {
  if (state.priorSource === "diagnostic" && state.baselineEvidence > 0) {
    return `Your diagnostic set this estimate from ${scoredAnswerCopy(state.baselineEvidence)}. No later lesson or Quick Check answer has changed it yet.`
  }

  if (state.priorSource === "score-estimate") {
    return "The score you entered set this starting estimate. No skill-specific lesson or Quick Check answer has changed it yet."
  }

  return "This is a neutral starting estimate until you answer a scored lesson or Quick Check question in this skill."
}
