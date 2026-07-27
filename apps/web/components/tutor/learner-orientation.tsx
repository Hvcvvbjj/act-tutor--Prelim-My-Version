"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type {
  CoreSection,
  CoreSectionScores,
  DiagnosticSkillResult,
} from "@act-tutor/core"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenCheckIcon,
  BrainCircuitIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  CircleGaugeIcon,
  Clock3Icon,
  MessageCircleIcon,
  RouteIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TargetIcon,
} from "lucide-react"

import { ScoutMark } from "@/components/tutor/scout"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type LearnerOrientationChoice = "explain-types" | "start-lessons"

export type LearnerOrientationEvidenceSource = "diagnostic" | "quick-check"

export interface LearnerOrientationProps {
  currentComposite: number
  targetComposite: number
  skillResults?: ReadonlyArray<DiagnosticSkillResult> | null
  sectionScores?: CoreSectionScores | null
  evidenceSource?: LearnerOrientationEvidenceSource
  onComplete: (choice: LearnerOrientationChoice) => void
}

type OrientationStage = "score" | "tour" | "profile" | "choice" | "explain"
type TourPreviewKind = "today" | "week" | "check" | "progress" | "practice"

interface SkillDefinition {
  slug: string
  label: string
  shortLabel: string
  explanation: string
}

interface SkillEvidence {
  correct: number
  total: number
}

interface PolygonDatum {
  label: string
  shortLabel: string
  value: number | null
  detail: string
}

const SECTION_ORDER = [
  "english",
  "math",
  "reading",
] as const satisfies ReadonlyArray<CoreSection>

const SECTION_LABELS: Record<CoreSection, string> = {
  english: "English",
  math: "Math",
  reading: "Reading",
}

const SECTION_SKILLS = {
  english: [
    {
      slug: "sentence-boundaries",
      label: "Sentence boundaries",
      shortLabel: "Boundaries",
      explanation:
        "Tell complete sentences from fragments and run-ons before choosing punctuation.",
    },
    {
      slug: "punctuation-and-commas",
      label: "Punctuation and commas",
      shortLabel: "Punctuation",
      explanation:
        "Use punctuation for sentence structure, not simply where you hear a pause.",
    },
    {
      slug: "concision-and-redundancy",
      label: "Concision and redundancy",
      shortLabel: "Concision",
      explanation:
        "Keep the clearest complete wording and remove ideas that repeat the same job.",
    },
    {
      slug: "logical-transitions",
      label: "Logical transitions",
      shortLabel: "Transitions",
      explanation:
        "Choose a transition by the relationship between ideas: continuation, contrast, cause, or result.",
    },
  ],
  math: [
    {
      slug: "ratios-and-percent",
      label: "Ratios and percent",
      shortLabel: "Ratios",
      explanation:
        "Name the whole, translate the relationship, and check whether the result is reasonable.",
    },
    {
      slug: "linear-equations",
      label: "Linear equations",
      shortLabel: "Equations",
      explanation:
        "Undo operations in order while keeping both sides of an equation balanced.",
    },
    {
      slug: "functions-and-modeling",
      label: "Functions and modeling",
      shortLabel: "Functions",
      explanation:
        "Connect inputs and outputs across formulas, tables, graphs, and real situations.",
    },
    {
      slug: "geometry-and-measurement",
      label: "Geometry and measurement",
      shortLabel: "Geometry",
      explanation:
        "Decide whether a problem asks for length, area, volume, or angle measure before choosing a formula.",
    },
  ],
  reading: [
    {
      slug: "central-ideas-and-details",
      label: "Central ideas and details",
      shortLabel: "Central ideas",
      explanation:
        "Find the passage’s controlling point and separate it from a single interesting detail.",
    },
    {
      slug: "textual-evidence-and-details",
      label: "Textual evidence and details",
      shortLabel: "Evidence",
      explanation:
        "Locate the exact support in the passage and choose only what those lines prove.",
    },
    {
      slug: "supported-inference",
      label: "Supported inference",
      shortLabel: "Inference",
      explanation:
        "Take one careful step beyond the words without adding an unsupported motive or claim.",
    },
    {
      slug: "author-purpose-and-structure",
      label: "Author purpose and structure",
      shortLabel: "Purpose",
      explanation:
        "Identify the job a sentence or paragraph does, such as contrast, example, cause, or background.",
    },
  ],
} as const satisfies Record<CoreSection, ReadonlyArray<SkillDefinition>>

const TOUR_STEPS = [
  {
    label: "Today",
    title: "Start with one clear route.",
    copy: "Today keeps the next lesson, short practice, and review in one place, so you always know what to do first.",
    points: [
      "See the next required step",
      "Finish work in small, schedulable pieces",
      "Return without losing your place",
    ],
    icon: RouteIcon,
    preview: "today",
  },
  {
    label: "My week",
    title: "See the work before the week starts.",
    copy: "Your weekly plan breaks preparation into manageable days and shows how each session moves you toward test day.",
    points: [
      "Preview each study day",
      "See lesson and practice time",
      "Keep test day in view",
    ],
    icon: CalendarDaysIcon,
    preview: "week",
  },
  {
    label: "Quick Check",
    title: "Get a useful signal without a full test.",
    copy: "A Quick Check uses 8–12 adaptive questions to update what Scout has measured and what still needs evidence.",
    points: [
      "Shorter than a full diagnostic",
      "Adapts as you answer",
      "Leaves untested skills marked as not measured",
    ],
    icon: CircleGaugeIcon,
    preview: "check",
  },
  {
    label: "Progress",
    title: "Know what changed—and why.",
    copy: "Progress separates observed question-type results from planning scores, so a small sample never pretends to be a final grade.",
    points: [
      "Review section baselines",
      "See measured question types",
      "Spot where more evidence is needed",
    ],
    icon: TargetIcon,
    preview: "progress",
  },
  {
    label: "Coach and practice",
    title: "Ask for help, then rehearse the clock.",
    copy: "Mr. Kim can explain a step in plain English, while timed practice helps you learn when to move on.",
    points: [
      "Ask for a hint or explanation",
      "Practice with test-like timing",
      "Review the reasoning after you answer",
    ],
    icon: MessageCircleIcon,
    preview: "practice",
  },
] as const

function normalizeActScore(value: number) {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.min(36, Math.max(1, Math.round(value)))
}

function clampProbability(value: number) {
  return Math.min(1, Math.max(0, value))
}

function observedPercent(value: number) {
  return `${Math.round(clampProbability(value) * 100)}%`
}

function evidenceLabel(
  evidenceSource: LearnerOrientationEvidenceSource | undefined
) {
  if (evidenceSource === "quick-check") {
    return "Quick Check"
  }

  if (evidenceSource === "diagnostic") {
    return "diagnostic"
  }

  return "starting setup"
}

function aggregateEvidence(skillResults: ReadonlyArray<DiagnosticSkillResult>) {
  const evidence = new Map<string, SkillEvidence>()

  for (const result of skillResults) {
    const total = Math.trunc(result.total)
    const correct = Math.trunc(result.correct)

    if (
      !Number.isFinite(result.total) ||
      !Number.isFinite(result.correct) ||
      total <= 0 ||
      correct < 0 ||
      correct > total
    ) {
      continue
    }

    const previous = evidence.get(result.skill)
    evidence.set(result.skill, {
      correct: (previous?.correct ?? 0) + correct,
      total: (previous?.total ?? 0) + total,
    })
  }

  return evidence
}

function skillPolygonData(
  section: CoreSection,
  evidence: ReadonlyMap<string, SkillEvidence>
) {
  return SECTION_SKILLS[section].map((skill) => {
    const result = evidence.get(skill.slug)

    if (!result) {
      return {
        label: skill.label,
        shortLabel: skill.shortLabel,
        value: null,
        detail: "Not measured yet",
      }
    }

    const value = result.correct / result.total
    return {
      label: skill.label,
      shortLabel: skill.shortLabel,
      value,
      detail: `${result.correct} of ${result.total} correct · ${observedPercent(value)} observed`,
    }
  })
}

function averageMeasured(data: ReadonlyArray<PolygonDatum>) {
  const measured = data.filter(
    (datum): datum is PolygonDatum & { value: number } => datum.value !== null
  )

  if (measured.length === 0) {
    return null
  }

  return (
    measured.reduce((total, datum) => total + datum.value, 0) / measured.length
  )
}

function pointOnPolygon(
  index: number,
  value: number,
  count: number,
  radius = 76
) {
  const center = 120
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count
  const distance = radius * value

  return {
    x: center + Math.cos(angle) * distance,
    y: center + Math.sin(angle) * distance,
  }
}

function pointsForLevel(count: number, level: number) {
  return Array.from({ length: count }, (_, index) => {
    const point = pointOnPolygon(index, level, count)
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`
  }).join(" ")
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setReducedMotion(query.matches)

    updatePreference()
    query.addEventListener("change", updatePreference)

    return () => query.removeEventListener("change", updatePreference)
  }, [])

  return reducedMotion
}

function ScoreCountUp({
  score,
  reducedMotion,
  onReady,
}: {
  score: number
  reducedMotion: boolean
  onReady: (ready: boolean) => void
}) {
  const [displayScore, setDisplayScore] = useState(1)

  useEffect(() => {
    let animationFrame = 0
    const duration = 1_150
    let startedAt: number | null = null

    animationFrame = window.requestAnimationFrame(function update(timestamp) {
      if (reducedMotion) {
        setDisplayScore(score)
        onReady(true)
        return
      }

      if (startedAt === null) {
        startedAt = timestamp
        setDisplayScore(1)
        onReady(false)
      }

      const progress = Math.min(1, (timestamp - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayScore(Math.round(1 + (score - 1) * eased))

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(update)
      } else {
        onReady(true)
      }
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [onReady, reducedMotion, score])

  return (
    <>
      <span aria-hidden="true">{displayScore}</span>
      <span className="sr-only">Your current planning score is {score}.</span>
    </>
  )
}

function SkillPolygon({
  title,
  subtitle,
  data,
  emphasized = false,
}: {
  title: string
  subtitle: string
  data: ReadonlyArray<PolygonDatum>
  emphasized?: boolean
}) {
  const allMeasured = data.every((datum) => datum.value !== null)
  const measuredCount = data.filter((datum) => datum.value !== null).length
  const dataPoints = allMeasured
    ? data
        .map((datum, index) => {
          const point = pointOnPolygon(index, datum.value ?? 0, data.length)
          return `${point.x.toFixed(1)},${point.y.toFixed(1)}`
        })
        .join(" ")
    : ""

  return (
    <section
      className={cn(
        "border-t-4 bg-background p-5 sm:p-6",
        emphasized ? "border-t-[var(--scout-coral)]" : "border-t-primary"
      )}
    >
      <div className="min-h-20">
        <p className="ink-label text-muted-foreground">{subtitle}</p>
        <h2 className="mt-2 font-heading text-2xl font-black">{title}</h2>
      </div>

      <div className="mt-3 flex justify-center">
        <svg
          viewBox="0 0 240 240"
          className="aspect-square w-full max-w-64 overflow-visible"
          aria-hidden="true"
          focusable="false"
        >
          {[0.25, 0.5, 0.75, 1].map((level) => (
            <polygon
              key={level}
              points={pointsForLevel(data.length, level)}
              fill="none"
              stroke="var(--border)"
              strokeWidth={level === 1 ? 1.5 : 1}
              strokeDasharray={level === 1 ? undefined : "3 4"}
            />
          ))}

          {data.map((datum, index) => {
            const end = pointOnPolygon(index, 1, data.length)
            return (
              <line
                key={`axis-${datum.label}`}
                x1="120"
                y1="120"
                x2={end.x}
                y2={end.y}
                stroke="var(--border)"
                strokeWidth="1"
              />
            )
          })}

          {allMeasured ? (
            <polygon
              points={dataPoints}
              fill={emphasized ? "var(--scout-coral)" : "var(--primary)"}
              fillOpacity="0.16"
              stroke={emphasized ? "var(--scout-coral)" : "var(--primary)"}
              strokeWidth="3"
              strokeLinejoin="round"
            />
          ) : (
            data.map((datum, index) => {
              const nextIndex = (index + 1) % data.length
              const nextDatum = data[nextIndex]
              if (datum.value === null || nextDatum.value === null) {
                return null
              }

              const start = pointOnPolygon(index, datum.value, data.length)
              const end = pointOnPolygon(
                nextIndex,
                nextDatum.value,
                data.length
              )
              return (
                <line
                  key={`measured-${datum.label}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={emphasized ? "var(--scout-coral)" : "var(--primary)"}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              )
            })
          )}

          {data.map((datum, index) => {
            if (datum.value === null) {
              return null
            }

            const point = pointOnPolygon(index, datum.value, data.length)
            return (
              <circle
                key={`point-${datum.label}`}
                cx={point.x}
                cy={point.y}
                r="4.5"
                fill="var(--background)"
                stroke={emphasized ? "var(--scout-coral)" : "var(--primary)"}
                strokeWidth="3"
              />
            )
          })}

          {data.map((datum, index) => {
            const labelPoint = pointOnPolygon(index, 1.24, data.length)
            const anchor =
              labelPoint.x < 105
                ? "end"
                : labelPoint.x > 135
                  ? "start"
                  : "middle"
            const dy = labelPoint.y < 70 ? -2 : labelPoint.y > 170 ? 8 : 3

            return (
              <text
                key={`label-${datum.label}`}
                x={labelPoint.x}
                y={labelPoint.y}
                dy={dy}
                textAnchor={anchor}
                fill={
                  datum.value === null
                    ? "var(--muted-foreground)"
                    : "var(--foreground)"
                }
                fontSize="9.5"
                fontWeight="700"
              >
                {datum.shortLabel}
              </text>
            )
          })}
        </svg>
      </div>

      {measuredCount < data.length ? (
        <p className="mt-1 text-center text-xs leading-5 text-muted-foreground">
          Partial shape: {data.length - measuredCount}{" "}
          {data.length - measuredCount === 1 ? "area was" : "areas were"} not
          measured.
        </p>
      ) : null}

      <dl className="mt-5 divide-y border-y">
        {data.map((datum) => (
          <div
            key={datum.label}
            className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-4"
          >
            <dt className="text-sm font-semibold">{datum.label}</dt>
            <dd
              className={cn(
                "text-sm sm:text-right",
                datum.value === null
                  ? "font-medium text-muted-foreground"
                  : "font-mono text-xs font-bold text-primary"
              )}
            >
              {datum.detail}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function TourPreview({ kind }: { kind: TourPreviewKind }) {
  if (kind === "today") {
    return (
      <div className="w-full space-y-3" aria-hidden="true">
        {[
          ["Lesson", "Question types first", "7 min"],
          ["Practice", "Try three examples", "6 min"],
          ["Review", "Explain one answer", "3 min"],
        ].map(([label, title, time], index) => (
          <div
            key={label}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border bg-background p-3"
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-xs font-black",
                index === 0
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {index + 1}
            </span>
            <div>
              <p className="ink-label text-muted-foreground">{label}</p>
              <p className="mt-1 text-sm font-bold">{title}</p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {time}
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (kind === "week") {
    return (
      <div className="w-full" aria-hidden="true">
        <div className="grid grid-cols-5 gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, index) => (
            <div
              key={day}
              className={cn(
                "border px-2 py-4 text-center",
                index === 2 ? "border-primary bg-secondary" : "bg-background"
              )}
            >
              <p className="ink-label text-muted-foreground">{day}</p>
              <span
                className={cn(
                  "mx-auto mt-4 block size-3 rounded-full",
                  index === 2
                    ? "bg-primary"
                    : index < 2
                      ? "bg-[var(--scout-sun)]"
                      : "border-2 border-border"
                )}
              />
              <p className="mt-3 font-mono text-xs">
                {index === 2 ? "16 min" : index < 2 ? "Done" : "12 min"}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3 border-l-4 border-[var(--scout-coral)] bg-[var(--coach-surface)] p-3">
          <CalendarDaysIcon className="size-5" />
          <p className="text-sm font-semibold">Test day stays visible.</p>
        </div>
      </div>
    )
  }

  if (kind === "check") {
    return (
      <div className="w-full border bg-background p-5" aria-hidden="true">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="ink-label text-primary">Quick Check</p>
            <p className="mt-2 font-heading text-2xl font-black">
              8–12 questions
            </p>
          </div>
          <CircleGaugeIcon className="size-14 text-primary" />
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/5 rounded-full bg-primary" />
        </div>
        <div className="mt-3 flex justify-between font-mono text-xs text-muted-foreground">
          <span>Adapts as you go</span>
          <span>Question 4</span>
        </div>
      </div>
    )
  }

  if (kind === "progress") {
    return (
      <div
        className="w-full space-y-5 border bg-background p-5"
        aria-hidden="true"
      >
        {[
          ["English", "Measured", "w-[72%]"],
          ["Math", "More evidence needed", "w-[46%]"],
          ["Reading", "Measured", "w-[63%]"],
        ].map(([section, state, width]) => (
          <div key={section}>
            <div className="flex items-end justify-between gap-3">
              <p className="font-bold">{section}</p>
              <p className="text-xs text-muted-foreground">{state}</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full bg-primary", width)} />
            </div>
          </div>
        ))}
        <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">
          Observed results and planning scores stay clearly labeled.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4" aria-hidden="true">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 bg-[var(--coach-surface)] p-4">
        <MessageCircleIcon className="mt-1 size-6 text-[var(--scout-coral-text)]" />
        <div>
          <p className="ink-label text-[var(--scout-coral-text)]">
            Ask Mr. Kim
          </p>
          <p className="mt-2 text-sm leading-6">
            “Show me why this answer works in regular English.”
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border bg-background p-4">
        <div className="flex items-center gap-3">
          <Clock3Icon className="size-7 text-primary" />
          <div>
            <p className="font-bold">Timed practice</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Practice pacing without hiding the review.
            </p>
          </div>
        </div>
        <span className="font-mono text-sm font-bold">04:32</span>
      </div>
    </div>
  )
}

export function LearnerOrientation({
  currentComposite,
  targetComposite,
  skillResults = [],
  sectionScores = null,
  evidenceSource,
  onComplete,
}: LearnerOrientationProps) {
  const [stage, setStage] = useState<OrientationStage>("score")
  const [tourIndex, setTourIndex] = useState(0)
  const [explainerIndex, setExplainerIndex] = useState(0)
  const [scoreReady, setScoreReady] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const completionSent = useRef(false)
  const reducedMotion = usePrefersReducedMotion()

  const currentScore = normalizeActScore(currentComposite)
  const targetScore = normalizeActScore(targetComposite)
  const sourceLabel = evidenceLabel(evidenceSource)
  const completionLabel =
    evidenceSource === "diagnostic"
      ? "Diagnostic complete"
      : evidenceSource === "quick-check"
        ? "Quick Check complete"
        : "Plan setup complete"
  const evidence = useMemo(
    () => aggregateEvidence(skillResults ?? []),
    [skillResults]
  )
  const sectionData = useMemo<Record<CoreSection, ReadonlyArray<PolygonDatum>>>(
    () => ({
      english: skillPolygonData("english", evidence),
      math: skillPolygonData("math", evidence),
      reading: skillPolygonData("reading", evidence),
    }),
    [evidence]
  )
  const overallData = useMemo(() => {
    const sectionAverages = SECTION_ORDER.map((section) => ({
      section,
      average: averageMeasured(sectionData[section]),
      measured: sectionData[section].filter((datum) => datum.value !== null)
        .length,
    }))
    const measuredTotal = sectionAverages.reduce(
      (total, section) => total + section.measured,
      0
    )

    return [
      ...sectionAverages.map(({ section, average, measured }) => ({
        label: SECTION_LABELS[section],
        shortLabel: SECTION_LABELS[section],
        value: average,
        detail:
          average === null
            ? "Not measured yet"
            : `${observedPercent(average)} average · ${measured} of 4 types measured`,
      })),
      {
        label: "Evidence coverage",
        shortLabel: "Coverage",
        value: measuredTotal / 12,
        detail: `${measuredTotal} of 12 question types measured`,
      },
    ] satisfies ReadonlyArray<PolygonDatum>
  }, [sectionData])

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? "auto" : "smooth",
    })
  }, [explainerIndex, reducedMotion, stage, tourIndex])

  function finish(choice: LearnerOrientationChoice) {
    if (completionSent.current) {
      return
    }

    completionSent.current = true
    onComplete(choice)
  }

  const sharedHeadingClass =
    "font-heading text-4xl leading-[1.02] font-black tracking-[-0.035em] outline-none sm:text-5xl lg:text-6xl"

  return (
    <div className="min-h-svh bg-[var(--canvas)] text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline gap-3">
            <span className="font-brand text-lg font-black tracking-[-0.02em]">
              Scout ACT
            </span>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              New learner orientation
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ShieldCheckIcon className="size-4 text-primary" />
            Your results stay labeled
          </div>
        </div>
      </header>

      <main
        className="mx-auto min-h-[calc(100svh-4rem)] max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
        aria-label="New learner orientation"
      >
        {stage === "score" ? (
          <section className="grid min-h-[calc(100svh-10rem)] items-center gap-10 py-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] lg:gap-16">
            <div className="animate-in duration-300 fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
              <p className="ink-label text-primary">{completionLabel}</p>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className={cn(sharedHeadingClass, "mt-4 max-w-3xl")}
              >
                Your starting point is ready.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                This is a planning baseline—not a promise or a limit. Your
                lessons will change as Scout sees more work.
              </p>
              <div className="mt-8 flex items-start gap-4 border-l-4 border-[var(--scout-sun)] pl-5">
                <SparklesIcon className="mt-1 size-5 shrink-0 text-[var(--scout-coral-text)]" />
                <p className="max-w-xl text-sm leading-6">
                  First, take a short tour. Then you’ll see exactly which
                  question types were measured before Mr. Kim helps you choose
                  what comes next.
                </p>
              </div>
            </div>

            <div className="paper-panel border-2 border-foreground bg-background p-6 sm:p-8">
              <p className="ink-label text-muted-foreground">
                Current planning score
              </p>
              <div className="mt-4 font-heading text-8xl leading-none font-black text-primary tabular-nums sm:text-9xl">
                <ScoreCountUp
                  score={currentScore}
                  reducedMotion={reducedMotion}
                  onReady={setScoreReady}
                />
              </div>

              <dl className="mt-8 grid grid-cols-2 gap-4 border-y py-5">
                <div>
                  <dt className="ink-label text-muted-foreground">Starting</dt>
                  <dd className="mt-2 font-heading text-3xl font-black">
                    {currentScore}
                  </dd>
                </div>
                <div>
                  <dt className="ink-label text-muted-foreground">Goal</dt>
                  <dd className="mt-2 font-heading text-3xl font-black">
                    {targetScore}
                  </dd>
                </div>
              </dl>

              <p className="sr-only" aria-live="polite">
                {scoreReady
                  ? `Score reveal complete. Your planning score is ${currentScore}.`
                  : "Preparing your planning score."}
              </p>
              <Button
                type="button"
                size="xl"
                className="mt-7 w-full"
                disabled={!scoreReady}
                onClick={() => setStage("tour")}
              >
                Start the tour
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </div>
          </section>
        ) : null}

        {stage === "tour" ? (
          <section className="mx-auto max-w-6xl animate-in duration-300 fade-in slide-in-from-right-2 motion-reduce:animate-none">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="ink-label text-primary">
                Feature tour · {tourIndex + 1} of {TOUR_STEPS.length}
              </p>
              <ol className="flex gap-2" aria-label="Feature tour progress">
                {TOUR_STEPS.map((step, index) => (
                  <li key={step.label}>
                    <span
                      className={cn(
                        "block h-2.5 rounded-full transition-[width,background-color] motion-reduce:transition-none",
                        index === tourIndex
                          ? "w-9 bg-primary"
                          : index < tourIndex
                            ? "w-2.5 bg-[var(--scout-sun)]"
                            : "w-2.5 bg-border"
                      )}
                      aria-current={index === tourIndex ? "step" : undefined}
                    >
                      <span className="sr-only">
                        {step.label}
                        {index === tourIndex ? ", current step" : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {(() => {
              const step = TOUR_STEPS[tourIndex]
              const StepIcon = step.icon

              return (
                <div className="mt-8 grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)] lg:gap-16">
                  <div>
                    <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
                      <StepIcon className="size-7" aria-hidden="true" />
                    </div>
                    <p className="ink-label mt-7 text-muted-foreground">
                      {step.label}
                    </p>
                    <h1
                      ref={headingRef}
                      tabIndex={-1}
                      className={cn(sharedHeadingClass, "mt-3 max-w-3xl")}
                    >
                      {step.title}
                    </h1>
                    <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                      {step.copy}
                    </p>
                    <ul className="mt-7 space-y-3">
                      {step.points.map((point) => (
                        <li
                          key={point}
                          className="flex items-start gap-3 text-sm leading-6"
                        >
                          <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-primary" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="paper-panel flex min-h-96 items-center border p-5 sm:p-7">
                    <TourPreview kind={step.preview} />
                  </div>
                </div>
              )
            })()}

            <div className="mt-10 flex items-center justify-between border-t pt-6">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => {
                  if (tourIndex === 0) {
                    setStage("score")
                    return
                  }
                  setTourIndex((index) => index - 1)
                }}
              >
                <ArrowLeftIcon data-icon="inline-start" />
                Back
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  if (tourIndex === TOUR_STEPS.length - 1) {
                    setStage("profile")
                    return
                  }
                  setTourIndex((index) => index + 1)
                }}
              >
                {tourIndex === TOUR_STEPS.length - 1
                  ? "See my skill profile"
                  : "Next feature"}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </div>
          </section>
        ) : null}

        {stage === "profile" ? (
          <section className="mx-auto max-w-7xl animate-in duration-300 fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)] lg:items-end">
              <div>
                <p className="ink-label text-primary">Your starting profile</p>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className={cn(sharedHeadingClass, "mt-4 max-w-4xl")}
                >
                  Four honest views of what we know so far.
                </h1>
              </div>
              <p className="border-l-4 border-[var(--scout-sun)] pl-5 text-sm leading-6 text-muted-foreground">
                Each point is the observed share correct for that exact question
                type. “Not measured yet” means your {sourceLabel} did not test
                it—not that you are weak there.
              </p>
            </div>

            <div className="mt-9 grid gap-px overflow-hidden border bg-border lg:grid-cols-2">
              {SECTION_ORDER.map((section) => (
                <SkillPolygon
                  key={section}
                  title={SECTION_LABELS[section]}
                  subtitle={
                    sectionScores
                      ? `Planning baseline ${normalizeActScore(sectionScores[section])}`
                      : "Question-type evidence"
                  }
                  data={sectionData[section]}
                />
              ))}
              <SkillPolygon
                title="Overall"
                subtitle={`${currentScore} now · ${targetScore} goal`}
                data={overallData}
                emphasized
              />
            </div>

            <div className="mt-8 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                These shapes will become more complete as you answer more
                question types. They are study signals, not official ACT score
                reports.
              </p>
              <Button
                type="button"
                size="xl"
                onClick={() => setStage("choice")}
              >
                Continue to Mr. Kim
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </div>
          </section>
        ) : null}

        {stage === "choice" ? (
          <section className="mx-auto grid min-h-[calc(100svh-10rem)] max-w-6xl items-center gap-10 py-6 lg:grid-cols-[minmax(18rem,0.65fr)_minmax(0,1.35fr)] lg:gap-16">
            <div
              className="flex justify-center lg:justify-start"
              aria-hidden="true"
            >
              <ScoutMark
                mood="ready"
                className="size-44 motion-reduce:animate-none sm:size-56"
              />
            </div>

            <div className="animate-in duration-300 fade-in slide-in-from-right-2 motion-reduce:animate-none">
              <p className="ink-label text-[var(--scout-coral-text)]">
                Mr. Kim
              </p>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className={cn(sharedHeadingClass, "mt-4 max-w-3xl")}
              >
                Want the question-type tour, or should we jump in?
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
                Either way, your first lesson round covers all 12 question types
                and what you need to know. Your results will personalize later
                rounds after that foundation is complete.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  className="group min-h-44 border-2 border-primary bg-background p-5 text-left transition-[background-color,transform] hover:bg-secondary focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring active:translate-y-px motion-reduce:transition-none"
                  onClick={() => {
                    setExplainerIndex(0)
                    setStage("explain")
                  }}
                >
                  <BrainCircuitIcon className="size-7 text-primary" />
                  <span className="mt-5 block font-heading text-xl font-black">
                    Explain the question types
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                    Take a three-part preview, then begin the same universal
                    lesson sequence.
                  </span>
                </button>

                <button
                  type="button"
                  className="group min-h-44 border-2 border-foreground bg-foreground p-5 text-left text-background transition-[transform,opacity] hover:opacity-90 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring active:translate-y-px motion-reduce:transition-none"
                  onClick={() => finish("start-lessons")}
                >
                  <BookOpenCheckIcon className="size-7 text-[var(--scout-sun)]" />
                  <span className="mt-5 block font-heading text-xl font-black">
                    Jump into the lessons
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-background/75">
                    Skip this preview. The lessons still teach every question
                    type before personalizing.
                  </span>
                </button>
              </div>

              <p className="mt-5 text-xs leading-5 text-muted-foreground">
                Mr. Kim is Scout’s in-app coach persona, not a human teacher.
              </p>
            </div>
          </section>
        ) : null}

        {stage === "explain" ? (
          <section className="mx-auto max-w-5xl animate-in duration-300 fade-in slide-in-from-right-2 motion-reduce:animate-none">
            {(() => {
              const section = SECTION_ORDER[explainerIndex]
              const skills = SECTION_SKILLS[section]

              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="ink-label text-primary">
                      Question-type preview · {explainerIndex + 1} of{" "}
                      {SECTION_ORDER.length}
                    </p>
                    <div className="flex gap-2" aria-hidden="true">
                      {SECTION_ORDER.map((item, index) => (
                        <span
                          key={item}
                          className={cn(
                            "h-2.5 rounded-full",
                            index === explainerIndex
                              ? "w-10 bg-primary"
                              : index < explainerIndex
                                ? "w-2.5 bg-[var(--scout-sun)]"
                                : "w-2.5 bg-border"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.58fr)_minmax(0,1.42fr)] lg:gap-12">
                    <div>
                      <p className="ink-label text-muted-foreground">
                        {SECTION_LABELS[section]}
                      </p>
                      <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className={cn(sharedHeadingClass, "mt-3")}
                      >
                        Four kinds of work you’ll learn to recognize.
                      </h1>
                      <p className="mt-6 text-base leading-7 text-muted-foreground">
                        This is the map, not the full lesson. Each lesson will
                        teach the rule, walk through an example, and let you
                        practice it.
                      </p>
                    </div>

                    <ol className="divide-y border-y bg-background">
                      {skills.map((skill, index) => (
                        <li
                          key={skill.slug}
                          className="grid gap-3 py-5 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:px-2"
                        >
                          <span className="flex size-9 items-center justify-center rounded-full bg-secondary font-mono text-sm font-black text-primary">
                            {index + 1}
                          </span>
                          <div>
                            <h2 className="font-heading text-xl font-black">
                              {skill.label}
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {skill.explanation}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="mt-10 flex items-center justify-between border-t pt-6">
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      onClick={() => {
                        if (explainerIndex === 0) {
                          setStage("choice")
                          return
                        }
                        setExplainerIndex((index) => index - 1)
                      }}
                    >
                      <ArrowLeftIcon data-icon="inline-start" />
                      Back
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => {
                        if (explainerIndex === SECTION_ORDER.length - 1) {
                          finish("explain-types")
                          return
                        }
                        setExplainerIndex((index) => index + 1)
                      }}
                    >
                      {explainerIndex === SECTION_ORDER.length - 1
                        ? "Start universal lessons"
                        : `Next: ${SECTION_LABELS[SECTION_ORDER[explainerIndex + 1]]}`}
                      <ArrowRightIcon data-icon="inline-end" />
                    </Button>
                  </div>
                </>
              )
            })()}
          </section>
        ) : null}
      </main>
    </div>
  )
}
