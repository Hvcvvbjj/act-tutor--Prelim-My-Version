import type { PlacementDraft, TutorJourney } from "@/components/tutor/types"

export function baselineStateForDraft(
  draft: PlacementDraft,
  hasSkillProfile: boolean
) {
  if (hasSkillProfile) {
    return {
      adaptiveBaselineRequired: false,
      baselineSkipped: false,
    }
  }
  return {
    adaptiveBaselineRequired: draft.priorScoreChoice === "never",
    baselineSkipped: false,
  }
}

export function applyReportedScoreSource(
  journey: TutorJourney,
  draft: PlacementDraft
): TutorJourney {
  const reportedScoreIsOfficial =
    (draft.priorScoreChoice === "scores" ||
      draft.priorScoreChoice === "composite_only") &&
    draft.scoreSource === "official" &&
    Number.isInteger(draft.composite) &&
    draft.composite >= 1 &&
    draft.composite <= 36

  return {
    ...journey,
    baselineOfficialComposite: reportedScoreIsOfficial ? draft.composite : null,
  }
}

export function applyEditedPlanJourney(
  journey: TutorJourney,
  previousDraft: PlacementDraft,
  nextDraft: PlacementDraft
): TutorJourney {
  const updated = applyReportedScoreSource(journey, nextDraft)
  if (previousDraft.testDate === nextDraft.testDate) return updated
  return {
    ...updated,
    checkInSnoozedUntil: null,
    doneForNow: false,
  }
}
