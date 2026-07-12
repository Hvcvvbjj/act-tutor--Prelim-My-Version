"use client"

import { useEffect, useState } from "react"
import {
  buildPlanIntensity,
  calendarDaysUntil,
  normalizeCurrentScore,
  selectTargetVector,
  type CoreSection,
  type CoreSectionScores,
} from "@act-tutor/core"

import { Dashboard } from "@/components/tutor/dashboard"
import { DiagnosticIntro } from "@/components/tutor/diagnostic-intro"
import { Onboarding } from "@/components/tutor/onboarding"
import type { GeneratedPlan, PlacementDraft } from "@/components/tutor/types"

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

export function TutorApp({ today, initialTestDate }: TutorAppProps) {
  const [draft, setDraft] = useState<PlacementDraft>(() =>
    initialDraft(initialTestDate)
  )
  const [step, setStep] = useState(1)
  const [surface, setSurface] = useState<
    "onboarding" | "dashboard" | "diagnostic"
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

      const target = selectTargetVector({
        current: baseline,
        goalComposite: draft.goal,
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
        draft,
        evidence,
        target,
        intensity,
        currentComposite: evidence.calculatedComposite ?? draft.composite,
        weakestSection: weakestSection(baseline),
      })
      setSurface("dashboard")
      setError(null)
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

  if (surface === "dashboard" && plan) {
    return <Dashboard plan={plan} onEditPlan={startOver} />
  }

  if (surface === "diagnostic") {
    return (
      <DiagnosticIntro
        goal={draft.goal}
        testDate={draft.testDate}
        onBack={startOver}
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
      onUpdate={updateDraft}
    />
  )
}
