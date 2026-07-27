import { describe, expect, it } from "vitest"

import {
  applyEditedPlanJourney,
  applyReportedScoreSource,
  baselineStateForDraft,
} from "@/components/tutor/tutor-journey"
import type { PlacementDraft, TutorJourney } from "@/components/tutor/types"

const journey: TutorJourney = {
  version: 1,
  tourVersion: 1,
  onboardingCompleted: true,
  lessonEntryChoice: "start-lessons",
  officialScoreHistory: [],
  pendingOfficialScores: [],
  baselineOfficialComposite: 24,
  checkInSnoozedUntil: null,
  doneForNow: false,
}

const draft: PlacementDraft = {
  goal: 30,
  priorScoreChoice: "composite_only",
  scoreSource: "practice",
  startingCheckChoice: "take",
  composite: 26,
  english: 0,
  math: 0,
  reading: 0,
  scienceEnabled: false,
  science: 0,
  testDate: "2026-10-10",
  studyDaysPerWeek: 3,
  minutesPerSession: 30,
  preferredSection: "balanced",
}

describe("reported score provenance", () => {
  it("updates the test-day comparison baseline when an edited score is official", () => {
    expect(
      applyReportedScoreSource(journey, {
        ...draft,
        scoreSource: "official",
      }).baselineOfficialComposite
    ).toBe(26)
  })

  it("clears a stale official baseline when the learner changes it to practice", () => {
    expect(
      applyReportedScoreSource(journey, draft).baselineOfficialComposite
    ).toBeNull()
  })

  it("clears the onboarding baseline when the learner says they never tested", () => {
    expect(
      applyReportedScoreSource(journey, {
        ...draft,
        priorScoreChoice: "never",
        scoreSource: "official",
      }).baselineOfficialComposite
    ).toBeNull()
  })

  it("requires a skill baseline when an edited plan has no profile", () => {
    expect(baselineStateForDraft(draft, false)).toEqual({
      adaptiveBaselineRequired: true,
      baselineSkipped: false,
    })
    expect(
      baselineStateForDraft(
        {
          ...draft,
          priorScoreChoice: "never",
          startingCheckChoice: "skip",
        },
        false
      )
    ).toEqual({
      adaptiveBaselineRequired: false,
      baselineSkipped: true,
    })
    expect(baselineStateForDraft(draft, true)).toEqual({
      adaptiveBaselineRequired: false,
      baselineSkipped: false,
    })
  })

  it("clears an old cycle snooze when the learner schedules a new test", () => {
    expect(
      applyEditedPlanJourney(
        {
          ...journey,
          checkInSnoozedUntil: "2026-10-20",
          doneForNow: true,
        },
        { ...draft, testDate: "2026-10-10" },
        { ...draft, testDate: "2026-12-12" }
      )
    ).toMatchObject({
      checkInSnoozedUntil: null,
      doneForNow: false,
    })
  })
})
