"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
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
  type CalibrationLearningBaseline,
} from "@act-tutor/core"

import { Onboarding } from "@/components/tutor/onboarding"
import type { GeneratedPlan, PlacementDraft } from "@/components/tutor/types"
import {
  GUEST_VIEWER,
  type AuthViewer,
  type SavedTutorPlan,
} from "@/lib/auth-types"
import { addCalendarDaysFrom } from "@/lib/dates"

const STORAGE_KEY = "ai-act-tutor-placement-v2"
const LEGACY_STORAGE_KEY = "ai-act-tutor-placement-v1"

function TutorSurfaceLoading({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-svh items-center justify-center bg-background px-5 text-foreground"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-xl border-y-2 border-foreground py-10">
        <p className="ink-label text-primary">Scout is getting ready</p>
        <p className="mt-3 font-heading text-4xl leading-none font-black sm:text-5xl">
          {message}
        </p>
      </div>
    </div>
  )
}

const loadDashboard = () =>
  import("@/components/tutor/dashboard").then((module) => module.Dashboard)
const loadDiagnosticIntro = () =>
  import("@/components/tutor/diagnostic-intro").then(
    (module) => module.DiagnosticIntro
  )
const loadDiagnosticRunner = () =>
  import("@/components/tutor/diagnostic-runner").then(
    (module) => module.DiagnosticRunner
  )

const Dashboard = dynamic(loadDashboard, {
  loading: () => <TutorSurfaceLoading message="Opening your study plan…" />,
})
const DiagnosticIntro = dynamic(loadDiagnosticIntro, {
  loading: () => (
    <TutorSurfaceLoading message="Opening your starting diagnostic…" />
  ),
})
const DiagnosticRunner = dynamic(loadDiagnosticRunner, {
  loading: () => <TutorSurfaceLoading message="Preparing your questions…" />,
})

interface TutorAppProps {
  today: string
  initialTestDate: string
  initialViewer?: AuthViewer
}

function initialDraft(initialTestDate: string): PlacementDraft {
  return {
    goal: 30,
    priorScoreChoice: "scores",
    startingCheckChoice: "take",
    composite: 24,
    english: 26,
    math: 20,
    reading: 25,
    scienceEnabled: false,
    science: 24,
    testDate: initialTestDate,
    studyDaysPerWeek: 3,
    minutesPerSession: 30,
    preferredSection: "balanced",
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
    (draft.startingCheckChoice === undefined ||
      draft.startingCheckChoice === "take" ||
      draft.startingCheckChoice === "skip") &&
    typeof draft.composite === "number" &&
    typeof draft.english === "number" &&
    typeof draft.math === "number" &&
    typeof draft.reading === "number" &&
    typeof draft.scienceEnabled === "boolean" &&
    typeof draft.science === "number" &&
    typeof draft.testDate === "string" &&
    Number.isInteger(draft.studyDaysPerWeek) &&
    Number(draft.studyDaysPerWeek) >= 1 &&
    Number(draft.studyDaysPerWeek) <= 7 &&
    Number.isInteger(draft.minutesPerSession) &&
    Number(draft.minutesPerSession) >= 15 &&
    Number(draft.minutesPerSession) <= 180 &&
    (draft.preferredSection === "balanced" ||
      draft.preferredSection === "english" ||
      draft.preferredSection === "math" ||
      draft.preferredSection === "reading")
  )
}

function isCoreSectionScores(value: unknown): value is CoreSectionScores {
  if (!value || typeof value !== "object") return false
  const scores = value as Partial<CoreSectionScores>
  return [scores.english, scores.math, scores.reading].every(
    (score) =>
      typeof score === "number" &&
      Number.isInteger(score) &&
      score >= 1 &&
      score <= 36
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

function makeGeneratedPlan(input: {
  today: string
  draft: PlacementDraft
  evidence: NormalizedScoreEvidence
  baseline: CoreSectionScores
  currentComposite: number
  diagnosticResult?: DiagnosticResult
  adaptiveBaselineRequired?: boolean
  baselineSkipped?: boolean
}): GeneratedPlan {
  const daysUntilTest = calendarDaysUntil(input.today, input.draft.testDate)
  if (!Number.isInteger(daysUntilTest) || daysUntilTest <= 0) {
    throw new RangeError("Choose a test date after today.")
  }

  const target = selectTargetVector({
    current: input.baseline,
    goalComposite: input.draft.goal,
    opportunityWeights: {
      english:
        (36 - input.baseline.english) *
        (input.draft.preferredSection === "english" ? 1.35 : 1),
      math:
        (36 - input.baseline.math) *
        (input.draft.preferredSection === "math" ? 1.35 : 1),
      reading:
        (36 - input.baseline.reading) *
        (input.draft.preferredSection === "reading" ? 1.35 : 1),
    },
  })
  const intensity = buildPlanIntensity({
    daysUntilTest,
    current: input.baseline,
    target: target.scores,
    studyDaysPerWeek: input.draft.studyDaysPerWeek,
    minutesPerSession: input.draft.minutesPerSession,
  })

  return {
    today: input.today,
    draft: input.draft,
    evidence: input.evidence,
    target,
    intensity,
    currentComposite: input.currentComposite,
    weakestSection: weakestSection(input.baseline),
    ...(input.diagnosticResult
      ? { diagnosticResult: input.diagnosticResult }
      : {}),
    ...(input.adaptiveBaselineRequired
      ? { adaptiveBaselineRequired: true }
      : {}),
    ...(input.baselineSkipped ? { baselineSkipped: true } : {}),
  }
}

function savedPlanFrom(plan: GeneratedPlan): SavedTutorPlan {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    draft: plan.draft,
    evidence: plan.evidence,
    currentComposite: plan.currentComposite,
    adaptiveBaselineRequired: plan.adaptiveBaselineRequired === true,
    baselineSkipped: plan.baselineSkipped === true,
  }
}

function restoredPlanFrom(today: string, value: unknown): GeneratedPlan | null {
  try {
    if (!value || typeof value !== "object") return null
    const savedPlan = value as Partial<SavedTutorPlan>
    if (
      savedPlan.version !== 1 ||
      !isPlacementDraft(savedPlan.draft) ||
      !savedPlan.evidence ||
      !isCoreSectionScores(savedPlan.evidence.planningBaseline) ||
      typeof savedPlan.currentComposite !== "number" ||
      !Number.isInteger(savedPlan.currentComposite) ||
      savedPlan.currentComposite < 1 ||
      savedPlan.currentComposite > 36 ||
      typeof savedPlan.adaptiveBaselineRequired !== "boolean" ||
      typeof savedPlan.baselineSkipped !== "boolean"
    ) {
      return null
    }
    return makeGeneratedPlan({
      today,
      draft: savedPlan.draft,
      evidence: savedPlan.evidence,
      baseline: savedPlan.evidence.planningBaseline,
      currentComposite: savedPlan.currentComposite,
      adaptiveBaselineRequired: savedPlan.adaptiveBaselineRequired,
      baselineSkipped: savedPlan.baselineSkipped,
    })
  } catch {
    return null
  }
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

export function TutorApp({
  today,
  initialTestDate,
  initialViewer = GUEST_VIEWER,
}: TutorAppProps) {
  const [restoredAtLoad] = useState(() =>
    restoredPlanFrom(today, initialViewer.savedPlan)
  )
  const [draft, setDraft] = useState<PlacementDraft>(
    () => restoredAtLoad?.draft ?? initialDraft(initialTestDate)
  )
  const [step, setStep] = useState(1)
  const [surface, setSurface] = useState<
    "onboarding" | "dashboard" | "diagnostic" | "diagnostic-runner"
  >(restoredAtLoad ? "dashboard" : "onboarding")
  const [plan, setPlan] = useState<GeneratedPlan | null>(restoredAtLoad)
  const [viewer, setViewer] = useState<AuthViewer>(initialViewer)
  const [error, setError] = useState<string | null>(null)
  const [storageReady, setStorageReady] = useState(false)
  const [welcomeComplete, setWelcomeComplete] = useState(
    Boolean(restoredAtLoad)
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const stored =
          window.localStorage.getItem(STORAGE_KEY) ??
          window.localStorage.getItem(LEGACY_STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as {
            version?: number
            draft?: unknown
            guestPlan?: unknown
          }
          if (!restoredAtLoad && initialViewer.role === "guest") {
            const restoredGuestPlan =
              parsed.version === 2
                ? restoredPlanFrom(today, parsed.guestPlan)
                : null
            if (restoredGuestPlan) {
              setDraft(restoredGuestPlan.draft)
              setPlan(restoredGuestPlan)
              setSurface("dashboard")
              setWelcomeComplete(true)
            } else if (
              (parsed.version === 1 || parsed.version === 2) &&
              isPlacementDraft(parsed.draft)
            ) {
              setDraft({ ...initialDraft(initialTestDate), ...parsed.draft })
            }
          }
        }
      } catch {
        try {
          window.localStorage.removeItem(STORAGE_KEY)
          window.localStorage.removeItem(LEGACY_STORAGE_KEY)
        } catch {}
      } finally {
        setStorageReady(true)
      }
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [initialTestDate, initialViewer.role, restoredAtLoad, today])

  useEffect(() => {
    if (!storageReady) return
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 2,
          draft,
          guestPlan:
            viewer.role === "guest" && plan ? savedPlanFrom(plan) : null,
        })
      )
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {}
  }, [draft, plan, storageReady, viewer.role])

  function updateDraft(update: Partial<PlacementDraft>) {
    setDraft((current) => ({ ...current, ...update }))
    setError(null)
  }

  function buildPlanFromEvidence(
    evidence: NormalizedScoreEvidence,
    baseline: CoreSectionScores,
    currentComposite: number,
    diagnosticResult?: DiagnosticResult,
    placementDraft: PlacementDraft = draft,
    options: {
      adaptiveBaselineRequired?: boolean
      baselineSkipped?: boolean
      save?: boolean
    } = {}
  ) {
    const nextPlan = makeGeneratedPlan({
      today,
      draft: placementDraft,
      evidence,
      baseline,
      currentComposite,
      diagnosticResult,
      adaptiveBaselineRequired: options.adaptiveBaselineRequired,
      baselineSkipped: options.baselineSkipped,
    })
    setPlan(nextPlan)
    setSurface("dashboard")
    setError(null)
    if (options.save !== false) void persistPlan(nextPlan)
  }

  async function persistPlan(nextPlan: GeneratedPlan) {
    if (viewer.role !== "learner") return
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_plan",
          savedPlan: savedPlanFrom(nextPlan),
        }),
      })
      const payload = (await response.json()) as {
        viewer?: AuthViewer
        error?: string
      }
      if (!response.ok || !payload.viewer) {
        throw new Error(payload.error ?? "The plan could not be saved.")
      }
      setViewer(payload.viewer)
    } catch {
      setError(
        "Your plan is open, but Scout could not sync it to your account yet."
      )
    }
  }

  function handleViewerChange(nextViewer: AuthViewer) {
    setViewer(nextViewer)
    const restored = restoredPlanFrom(today, nextViewer.savedPlan)
    if (restored) {
      setDraft(restored.draft)
      setPlan(restored)
      setSurface("dashboard")
      setWelcomeComplete(true)
      setError(null)
    }
  }

  function createPlan() {
    void loadDashboard()
    try {
      const daysUntilTest = calendarDaysUntil(today, draft.testDate)
      if (!Number.isInteger(daysUntilTest) || daysUntilTest <= 0) {
        throw new RangeError("Choose a test date after today.")
      }

      if (draft.priorScoreChoice === "never") {
        const evidence: NormalizedScoreEvidence = {
          source: "not_taken",
          reportedComposite: null,
          calculatedComposite: null,
          reportedSections: null,
          planningBaseline: { english: 18, math: 18, reading: 18 },
          science: null,
          confidence: "none",
          compositeDifference: null,
        }
        const baseline = evidence.planningBaseline
        if (!baseline) throw new Error("Could not start the adaptive baseline.")
        buildPlanFromEvidence(evidence, baseline, 18, undefined, draft, {
          adaptiveBaselineRequired: draft.startingCheckChoice === "take",
          baselineSkipped: draft.startingCheckChoice === "skip",
        })
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

  function useAdaptiveBaseline(payload: CalibrationLearningBaseline) {
    void loadDashboard()
    const baseline = payload.sections
    const composite = payload.composite
    const evidence: NormalizedScoreEvidence = {
      source: "rapid_diagnostic",
      reportedComposite: null,
      calculatedComposite: composite,
      reportedSections: null,
      planningBaseline: baseline,
      science: null,
      confidence: "low",
      compositeDifference: null,
    }
    buildPlanFromEvidence(evidence, baseline, composite, undefined, draft)
  }

  async function launchJudgeDemo() {
    void loadDashboard()
    try {
      const [learningResponse, calibrationResponse] = await Promise.all([
        fetch("/api/learning", { method: "DELETE" }),
        fetch("/api/calibration", { method: "DELETE" }),
      ])
      if (!learningResponse.ok || !calibrationResponse.ok) {
        throw new Error("Could not reset the demo learner.")
      }
      const demoDraft: PlacementDraft = {
        goal: 31,
        priorScoreChoice: "scores",
        startingCheckChoice: "take",
        composite: 24,
        english: 22,
        math: 25,
        reading: 24,
        scienceEnabled: false,
        science: 24,
        testDate: addCalendarDaysFrom(today, 36),
        studyDaysPerWeek: 3,
        minutesPerSession: 30,
        preferredSection: "english",
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

  if (!storageReady && !restoredAtLoad) {
    return <TutorSurfaceLoading message="Checking for a saved plan…" />
  }

  if (surface === "dashboard" && plan) {
    return (
      <Dashboard
        plan={plan}
        viewer={viewer}
        savedPlan={savedPlanFrom(plan)}
        onViewerChange={handleViewerChange}
        onEditPlan={startOver}
        onStartFullDiagnostic={() => {
          void loadDiagnosticIntro()
          setSurface("diagnostic")
        }}
        onUseAdaptiveBaseline={useAdaptiveBaseline}
      />
    )
  }

  if (surface === "diagnostic") {
    return (
      <DiagnosticIntro
        goal={draft.goal}
        testDate={draft.testDate}
        onBack={startOver}
        onStart={() => {
          void loadDiagnosticRunner()
          setSurface("diagnostic-runner")
        }}
      />
    )
  }

  if (surface === "diagnostic-runner") {
    return (
      <DiagnosticRunner
        onBack={() => setSurface("diagnostic")}
        canViewTechnicalDetails={viewer.technicalDetails}
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
      viewer={viewer}
      savedPlan={plan ? savedPlanFrom(plan) : null}
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
      showWelcome={!welcomeComplete}
      onDismissWelcome={() => setWelcomeComplete(true)}
      onJudgeDemo={() => {
        setWelcomeComplete(true)
        void launchJudgeDemo()
      }}
      onViewerChange={handleViewerChange}
      onUpdate={updateDraft}
    />
  )
}
