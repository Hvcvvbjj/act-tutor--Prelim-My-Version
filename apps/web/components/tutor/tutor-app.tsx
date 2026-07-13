"use client"

import { useEffect, useState } from "react"
import {
  buildPlanIntensity,
  calendarDaysUntil,
  diagnosticResultToEvidence,
  normalizeCurrentScore,
  selectTargetVector,
  type CoreSection,
  type CoreSectionScores,
  type DiagnosticResult,
  type DiagnosticSkillResult,
  type NormalizedScoreEvidence,
} from "@act-tutor/core"

import { Dashboard } from "@/components/tutor/dashboard"
import { DiagnosticIntro } from "@/components/tutor/diagnostic-intro"
import { DiagnosticRunner } from "@/components/tutor/diagnostic-runner"
import { Onboarding } from "@/components/tutor/onboarding"
import type { GeneratedPlan, PlacementDraft } from "@/components/tutor/types"
import { addCalendarDaysFrom } from "@/lib/dates"

const STORAGE_KEY = "ai-act-tutor-placement-v1"

interface TutorAppProps {
  today: string
  initialTestDate: string
}

function initialDraft(initialTestDate: string): PlacementDraft {
  return {
    goal: 30,
    priorScoreChoice: "scores",
    composite: 24,
    english: 26,
    math: 20,
    reading: 25,
    scienceEnabled: false,
    science: 24,
    testDate: initialTestDate,
  }
}

function isPlacementDraft(value: unknown): value is PlacementDraft {
  if (!value || typeof value !== "object") return false
  const draft = value as Partial<PlacementDraft>
  return (
    typeof draft.goal === "number" &&
    (draft.priorScoreChoice === "scores" ||
      draft.priorScoreChoice === "composite_only" ||
      draft.priorScoreChoice === "never") &&
    typeof draft.composite === "number" &&
    typeof draft.english === "number" &&
    typeof draft.math === "number" &&
    typeof draft.reading === "number" &&
    typeof draft.scienceEnabled === "boolean" &&
    typeof draft.science === "number" &&
    typeof draft.testDate === "string"
  )
}

function validateScore(value: number, label: string): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 36) {
    return `${label} score must be a whole number from 1 to 36.`
  }
  return null
}

function validateScoreStep(draft: PlacementDraft): string | null {
  if (draft.priorScoreChoice === "never") return null

  const compositeError = validateScore(draft.composite, "Composite")
  if (compositeError) return compositeError

  if (draft.priorScoreChoice === "scores") {
    for (const [label, value] of [
      ["English", draft.english],
      ["Math", draft.math],
      ["Reading", draft.reading],
    ] as const) {
      const sectionError = validateScore(value, label)
      if (sectionError) return sectionError
    }
  }

  if (draft.scienceEnabled) {
    return validateScore(draft.science, "Science")
  }

  return null
}

function weakestSection(scores: CoreSectionScores): CoreSection {
  return (Object.entries(scores) as Array<[CoreSection, number]>).reduce(
    (weakest, entry) => (entry[1] < weakest[1] ? entry : weakest)
  )[0]
}

const JUDGE_DEMO_SKILLS: ReadonlyArray<DiagnosticSkillResult> = [
  {
    skill: "sentence-boundaries",
    label: "Sentence boundaries",
    section: "english",
    correct: 0,
    total: 2,
    accuracy: 0,
    signal: "focus",
  },
  {
    skill: "concision-and-redundancy",
    label: "Concision and redundancy",
    section: "english",
    correct: 1,
    total: 2,
    accuracy: 0.5,
    signal: "focus",
  },
  {
    skill: "logical-transitions",
    label: "Logical transitions",
    section: "english",
    correct: 2,
    total: 2,
    accuracy: 1,
    signal: "strength",
  },
  {
    skill: "linear-equations",
    label: "Linear equations",
    section: "math",
    correct: 2,
    total: 2,
    accuracy: 1,
    signal: "strength",
  },
  {
    skill: "ratios-and-percent",
    label: "Ratios and percent",
    section: "math",
    correct: 1,
    total: 2,
    accuracy: 0.5,
    signal: "focus",
  },
  {
    skill: "functions-and-modeling",
    label: "Functions and modeling",
    section: "math",
    correct: 1,
    total: 2,
    accuracy: 0.5,
    signal: "focus",
  },
  {
    skill: "supported-inference",
    label: "Supported inference",
    section: "reading",
    correct: 0,
    total: 2,
    accuracy: 0,
    signal: "focus",
  },
  {
    skill: "central-ideas-and-details",
    label: "Central ideas and details",
    section: "reading",
    correct: 2,
    total: 2,
    accuracy: 1,
    signal: "strength",
  },
  {
    skill: "author-purpose-and-structure",
    label: "Author purpose and structure",
    section: "reading",
    correct: 1,
    total: 2,
    accuracy: 0.5,
    signal: "focus",
  },
]

function judgeDemoDiagnostic(): DiagnosticResult {
  const strengths = JUDGE_DEMO_SKILLS.filter(
    (skill) => skill.signal === "strength"
  ).slice(0, 2)
  const focusSkills = JUDGE_DEMO_SKILLS.filter(
    (skill) => skill.signal === "focus"
  ).filter(
    (skill) =>
      skill.skill === "sentence-boundaries" ||
      skill.skill === "supported-inference"
  )
  return {
    formId: "scout-judge-demo",
    formVersion: "judge-demo-v1",
    source: "rapid_diagnostic",
    calibrationVersion: "rapid-v1",
    sectionResults: [
      {
        section: "english",
        correct: 3,
        total: 6,
        range: { low: 20, high: 24, estimate: 22 },
      },
      {
        section: "math",
        correct: 4,
        total: 6,
        range: { low: 23, high: 27, estimate: 25 },
      },
      {
        section: "reading",
        correct: 4,
        total: 6,
        range: { low: 22, high: 26, estimate: 24 },
      },
    ],
    compositeRange: { low: 22, high: 26, estimate: 24 },
    planningBaseline: { english: 22, math: 25, reading: 24 },
    skillResults: JUDGE_DEMO_SKILLS,
    strengths,
    focusSkills,
    feedback: [],
  }
}

export function TutorApp({ today, initialTestDate }: TutorAppProps) {
  const [draft, setDraft] = useState<PlacementDraft>(() =>
    initialDraft(initialTestDate)
  )
  const [step, setStep] = useState(1)
  const [surface, setSurface] = useState<
    "onboarding" | "dashboard" | "diagnostic" | "diagnostic-runner"
  >("onboarding")
  const [plan, setPlan] = useState<GeneratedPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [storageReady, setStorageReady] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as {
            version?: number
            draft?: unknown
          }
          if (parsed.version === 1 && isPlacementDraft(parsed.draft)) {
            setDraft(parsed.draft)
          }
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
      } finally {
        setStorageReady(true)
      }
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (!storageReady) return
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, draft })
    )
  }, [draft, storageReady])

  function updateDraft(update: Partial<PlacementDraft>) {
    setDraft((current) => ({ ...current, ...update }))
    setError(null)
  }

  function buildPlanFromEvidence(
    evidence: NormalizedScoreEvidence,
    baseline: CoreSectionScores,
    currentComposite: number,
    diagnosticResult?: DiagnosticResult,
    placementDraft: PlacementDraft = draft
  ) {
    const daysUntilTest = calendarDaysUntil(today, placementDraft.testDate)
    if (!Number.isInteger(daysUntilTest) || daysUntilTest <= 0) {
      throw new RangeError("Choose a test date after today.")
    }

    const target = selectTargetVector({
      current: baseline,
      goalComposite: placementDraft.goal,
      opportunityWeights: {
        english: 36 - baseline.english,
        math: 36 - baseline.math,
        reading: 36 - baseline.reading,
      },
    })
    const intensity = buildPlanIntensity({
      daysUntilTest,
      current: baseline,
      target: target.scores,
    })

    setPlan({
      today,
      draft: placementDraft,
      evidence,
      target,
      intensity,
      currentComposite,
      weakestSection: weakestSection(baseline),
      ...(diagnosticResult ? { diagnosticResult } : {}),
    })
    setSurface("dashboard")
    setError(null)
  }

  function createPlan() {
    try {
      const daysUntilTest = calendarDaysUntil(today, draft.testDate)
      if (!Number.isInteger(daysUntilTest) || daysUntilTest <= 0) {
        throw new RangeError("Choose a test date after today.")
      }

      if (draft.priorScoreChoice === "never") {
        setSurface("diagnostic")
        setError(null)
        return
      }

      const evidence =
        draft.priorScoreChoice === "composite_only"
          ? normalizeCurrentScore({
              kind: "composite_only",
              composite: draft.composite,
              ...(draft.scienceEnabled ? { science: draft.science } : {}),
            })
          : normalizeCurrentScore({
              kind: "section_scores",
              composite: draft.composite,
              english: draft.english,
              math: draft.math,
              reading: draft.reading,
              ...(draft.scienceEnabled ? { science: draft.science } : {}),
            })
      const baseline = evidence.planningBaseline
      if (!baseline)
        throw new Error("Section scores are required for this path.")
      buildPlanFromEvidence(
        evidence,
        baseline,
        evidence.calculatedComposite ?? draft.composite
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not build this plan yet. Check the scores and date."
      )
    }
  }

  function startOver() {
    setStep(1)
    setSurface("onboarding")
    setPlan(null)
    setError(null)
  }

  async function launchJudgeDemo() {
    try {
      const response = await fetch("/api/learning", { method: "DELETE" })
      if (!response.ok) throw new Error("Could not reset the demo learner.")
      const demoDraft: PlacementDraft = {
        goal: 31,
        priorScoreChoice: "scores",
        composite: 24,
        english: 22,
        math: 25,
        reading: 24,
        scienceEnabled: false,
        science: 24,
        testDate: addCalendarDaysFrom(today, 36),
      }
      const diagnosticResult = judgeDemoDiagnostic()
      const evidence = diagnosticResultToEvidence(diagnosticResult)
      setDraft(demoDraft)
      buildPlanFromEvidence(
        evidence,
        diagnosticResult.planningBaseline,
        diagnosticResult.compositeRange.estimate,
        diagnosticResult,
        demoDraft
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load the adaptive demo."
      )
    }
  }

  if (surface === "dashboard" && plan) {
    return <Dashboard plan={plan} onEditPlan={startOver} />
  }

  if (surface === "diagnostic") {
    return (
      <DiagnosticIntro
        goal={draft.goal}
        testDate={draft.testDate}
        onBack={startOver}
        onStart={() => setSurface("diagnostic-runner")}
      />
    )
  }

  if (surface === "diagnostic-runner") {
    return (
      <DiagnosticRunner
        onBack={() => setSurface("diagnostic")}
        onComplete={(result) => {
          try {
            const evidence = diagnosticResultToEvidence(result)
            buildPlanFromEvidence(
              evidence,
              result.planningBaseline,
              result.compositeRange.estimate,
              result
            )
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : "We could not build the plan from this baseline."
            )
            setSurface("diagnostic")
          }
        }}
      />
    )
  }

  return (
    <Onboarding
      draft={draft}
      error={error}
      step={step}
      today={today}
      onBack={() => setStep((current) => Math.max(1, current - 1))}
      onContinue={() => {
        if (step < 3) {
          if (step === 2) {
            const scoreError = validateScoreStep(draft)
            if (scoreError) {
              setError(scoreError)
              return
            }
          }
          setStep((current) => current + 1)
          setError(null)
          return
        }
        createPlan()
      }}
      onJudgeDemo={() => void launchJudgeDemo()}
      onUpdate={updateDraft}
    />
  )
}
