import { describe, expect, it } from "vitest"

import { parseSavedTutorPlan } from "@/lib/auth.server"

describe("account assessment-history persistence", () => {
  it("validates and preserves exact diagnostic mistake records", () => {
    const parsed = parseSavedTutorPlan({
      version: 2,
      draft: {
        goal: 30,
        priorScoreChoice: "never",
        scoreSource: "practice",
        startingCheckChoice: "take",
        composite: 0,
        english: 0,
        math: 0,
        reading: 0,
        scienceEnabled: false,
        science: 0,
        testDate: "2026-09-19",
        studyDaysPerWeek: 3,
        minutesPerSession: 30,
        preferredSection: "balanced",
      },
      evidence: {
        source: "rapid_diagnostic",
        reportedComposite: null,
        calculatedComposite: 22,
        reportedSections: null,
        planningBaseline: { english: 20, math: 23, reading: 23 },
        science: null,
        confidence: "low",
        compositeDifference: null,
      },
      currentComposite: 22,
      profileSkillResults: [],
      assessmentHistory: [
        {
          id: "diagnostic:attempt-1",
          kind: "diagnostic",
          title: "66-question diagnostic",
          completedAt: "2026-07-29T12:00:00.000Z",
          correct: 40,
          total: 66,
          compositeScore: 22,
          sectionScores: { english: 20, math: 23, reading: 23 },
          mistakes: [
            {
              id: "attempt-1:q1",
              questionId: "q1",
              section: "english",
              skill: "sentence-boundaries",
              skillLabel: "Sentence boundaries",
              prompt: "Which choice completes the sentence?",
              selectedChoiceText: "A comma",
              correctChoiceText: "A period",
              rationale: "Two complete thoughts need a period here.",
            },
          ],
        },
      ],
      journey: {
        version: 1,
        tourVersion: 1,
        onboardingCompleted: true,
        lessonEntryChoice: "start-lessons",
        officialScoreHistory: [],
        pendingOfficialScores: [],
        baselineOfficialComposite: null,
        checkInSnoozedUntil: null,
        doneForNow: false,
      },
      adaptiveBaselineRequired: false,
      baselineSkipped: false,
    })

    expect(parsed.assessmentHistory?.[0]).toMatchObject({
      compositeScore: 22,
      sectionScores: { english: 20, math: 23, reading: 23 },
      mistakes: [
        {
          prompt: "Which choice completes the sentence?",
          selectedChoiceText: "A comma",
          correctChoiceText: "A period",
          rationale: "Two complete thoughts need a period here.",
        },
      ],
    })
  })
})
