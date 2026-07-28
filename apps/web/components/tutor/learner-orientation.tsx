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
  CircleGaugeIcon,
  Clock3Icon,
  MessageCircleIcon,
  RouteIcon,
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
type TourPreviewKind = "plan" | "check" | "practice"

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
      explanation: "Spot fragments and run-ons before choosing punctuation.",
    },
    {
      slug: "punctuation-and-commas",
      label: "Punctuation and commas",
      shortLabel: "Punctuation",
      explanation: "Match punctuation to the sentence’s structure.",
    },
    {
      slug: "concision-and-redundancy",
      label: "Concision and redundancy",
      shortLabel: "Concision",
      explanation: "Cut repeated ideas and keep the clearest complete version.",
    },
    {
      slug: "logical-transitions",
      label: "Logical transitions",
      shortLabel: "Transitions",
      explanation: "Match the transition to contrast, cause, or continuation.",
    },
  ],
  math: [
    {
      slug: "ratios-and-percent",
      label: "Ratios and percent",
      shortLabel: "Ratios",
      explanation:
        "Translate the relationship, solve it, then check the scale.",
    },
    {
      slug: "linear-equations",
      label: "Linear equations",
      shortLabel: "Equations",
      explanation:
        "Undo operations in order while keeping both sides balanced.",
    },
    {
      slug: "functions-and-modeling",
      label: "Functions and modeling",
      shortLabel: "Functions",
      explanation:
        "Connect inputs and outputs across equations, tables, and graphs.",
    },
    {
      slug: "geometry-and-measurement",
      label: "Geometry and measurement",
      shortLabel: "Geometry",
      explanation: "Identify the measurement before choosing a formula.",
    },
  ],
  reading: [
    {
      slug: "central-ideas-and-details",
      label: "Central ideas and details",
      shortLabel: "Central ideas",
      explanation:
        "Separate the passage’s main point from a supporting detail.",
    },
    {
      slug: "textual-evidence-and-details",
      label: "Textual evidence and details",
      shortLabel: "Evidence",
      explanation: "Choose only what the cited lines actually support.",
    },
    {
      slug: "supported-inference",
      label: "Supported inference",
      shortLabel: "Inference",
      explanation:
        "Take one careful step beyond the text—without adding a story.",
    },
    {
      slug: "author-purpose-and-structure",
      label: "Author purpose and structure",
      shortLabel: "Purpose",
      explanation: "Identify what a sentence or paragraph is doing.",
    },
  ],
} as const satisfies Record<CoreSection, ReadonlyArray<SkillDefinition>>

const TOUR_STEPS = [
  {
    label: "Today + My Week",
    title: "One plan, two views.",
    copy: "Today shows what to do next. My Week shows when it fits.",
    icon: RouteIcon,
    preview: "plan",
  },
  {
    label: "Checks + Progress",
    title: "See what Scout has measured.",
    copy: "Quick Checks update your skill map. Progress shows what changed.",
    icon: CircleGaugeIcon,
    preview: "check",
  },
  {
    label: "Coach and practice",
    title: "Get help when you need it.",
    copy: "Ask Mr. Kim for an explanation, then practice with or without a timer.",
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
}: {
  title: string
  subtitle: string
  data: ReadonlyArray<PolygonDatum>
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
    <section className="flex min-w-0 flex-col bg-background p-5 sm:p-7">
      <header className="text-center">
        <h2 className="font-heading text-2xl font-black">{title}</h2>
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          {subtitle}
        </p>
      </header>

      <div className="mt-5 flex flex-1 items-center justify-center">
        <svg
          viewBox="-24 -24 288 288"
          className="aspect-square w-full max-w-60 overflow-visible"
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
              fill="var(--primary)"
              fillOpacity="0.16"
              stroke="var(--primary)"
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
                  stroke="var(--primary)"
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
                stroke="var(--primary)"
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
                fontSize="11"
                fontWeight="700"
              >
                {datum.shortLabel}
              </text>
            )
          })}
        </svg>
      </div>

      <p className="mt-2 text-center font-mono text-xs font-bold text-muted-foreground">
        {measuredCount} of {data.length} measured
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-4 text-xs">
        {data.map((datum) => (
          <div
            key={`visible-${datum.label}`}
            className="flex min-w-0 items-center justify-between gap-2"
          >
            <dt className="truncate text-muted-foreground">
              {datum.shortLabel}
            </dt>
            <dd className="shrink-0 font-mono font-bold">
              {datum.value === null ? "—" : observedPercent(datum.value)}
            </dd>
          </div>
        ))}
      </dl>
      <dl className="sr-only">
        {data.map((datum) => (
          <div key={datum.label}>
            <dt>{datum.label}</dt>
            <dd>{datum.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function TourPreview({ kind }: { kind: TourPreviewKind }) {
  if (kind === "plan") {
    return (
      <div className="w-full border bg-background" aria-hidden="true">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">
            1
          </span>
          <div>
            <p className="ink-label text-primary">Today</p>
            <p className="mt-1 text-sm font-bold">Question types first</p>
          </div>
          <span className="font-mono text-xs text-muted-foreground">7 min</span>
        </div>
        <div className="border-t p-4">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="ink-label text-muted-foreground">My Week</p>
              <p className="mt-1 text-sm font-bold">Three short sessions</p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              36 min
            </span>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, index) => (
              <div
                key={day}
                className={cn(
                  "border px-2 py-3 text-center",
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
                  {index === 2 ? "12m" : index < 2 ? "Done" : "—"}
                </p>
              </div>
            ))}
          </div>
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
        <div className="mt-5 border-t pt-4">
          <div className="flex items-center justify-between gap-4">
            <p className="ink-label text-muted-foreground">Progress</p>
            <p className="text-xs font-semibold text-primary">
              Skill map updated
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full border bg-background" aria-hidden="true">
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
      <div className="flex items-center justify-between gap-4 border-t p-4">
        <div className="flex items-center gap-3">
          <Clock3Icon className="size-7 text-primary" />
          <div>
            <p className="font-bold">Timed Practice</p>
            <p className="mt-1 text-xs text-muted-foreground">Optional timer</p>
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
  const hasSkillEvidence = (skillResults ?? []).some(
    (result) => result.total > 0
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
    const measuredValues = SECTION_ORDER.flatMap((section) =>
      sectionData[section]
        .map((datum) => datum.value)
        .filter((value): value is number => value !== null)
    )
    const overallAverage =
      measuredValues.length > 0
        ? measuredValues.reduce((total, value) => total + value, 0) /
          measuredValues.length
        : null

    return {
      data: [
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
          label: "All measured question types",
          shortLabel: "All measured",
          value: overallAverage,
          detail:
            overallAverage === null
              ? "Not measured yet"
              : `${observedPercent(overallAverage)} average across ${measuredTotal} measured types`,
        },
      ] satisfies ReadonlyArray<PolygonDatum>,
    }
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
    <div
      data-hide-global-footer
      className="min-h-svh bg-[var(--canvas)] text-foreground"
    >
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <span className="font-brand text-lg font-black tracking-[-0.02em]">
            Scout ACT
          </span>
          <span className="text-sm text-muted-foreground">Orientation</span>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto min-h-[calc(100svh-4rem)] max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
        aria-label="New learner orientation"
      >
        {stage === "score" ? (
          <section className="mx-auto flex min-h-[calc(100svh-9rem)] max-w-3xl items-center justify-center py-6 text-center">
            <div className="w-full animate-in duration-300 fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
              <p className="ink-label text-primary">{completionLabel}</p>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className={cn(sharedHeadingClass, "mx-auto mt-4 max-w-3xl")}
              >
                Your starting point is ready.
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                A planning starting point, not a limit. Scout updates it as you
                work.
              </p>

              <div className="mx-auto mt-9 max-w-xl border-y py-7">
                <p className="ink-label text-muted-foreground">
                  Planning score
                </p>
                <div className="mt-2 font-heading text-[8rem] leading-none font-black text-primary tabular-nums sm:text-[10rem]">
                  <ScoreCountUp
                    score={currentScore}
                    reducedMotion={reducedMotion}
                    onReady={setScoreReady}
                  />
                </div>
                <p className="mt-3 text-sm font-semibold text-muted-foreground">
                  Goal: <span className="text-foreground">{targetScore}</span>
                </p>
              </div>

              <p className="sr-only" aria-live="polite">
                {scoreReady
                  ? `Score reveal complete. Your planning score is ${currentScore}.`
                  : "Preparing your planning score."}
              </p>
              <Button
                type="button"
                size="xl"
                className="mt-8 w-full max-w-sm"
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
          <section className="mx-auto max-w-4xl animate-in duration-300 fade-in slide-in-from-right-2 motion-reduce:animate-none">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="ink-label text-primary">
                Tour · {tourIndex + 1} of {TOUR_STEPS.length}
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
                <div className="mt-7 text-center">
                  <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-secondary text-primary">
                    <StepIcon className="size-5" aria-hidden="true" />
                  </div>
                  <p className="ink-label mt-4 text-muted-foreground">
                    {step.label}
                  </p>
                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="mx-auto mt-2 max-w-3xl font-heading text-4xl leading-[1.04] font-black tracking-[-0.035em] outline-none sm:text-5xl"
                  >
                    {step.title}
                  </h1>
                  <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                    {step.copy}
                  </p>

                  <div className="paper-panel mx-auto mt-7 flex min-h-64 max-w-2xl items-center border p-5 text-left sm:p-7">
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
          <section className="mx-auto max-w-5xl animate-in duration-300 fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
            <div className="text-center">
              <p className="ink-label text-primary">Your starting profile</p>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className={cn(sharedHeadingClass, "mx-auto mt-4 max-w-4xl")}
              >
                {hasSkillEvidence
                  ? "Your question-type map."
                  : "No skill map yet."}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                {hasSkillEvidence
                  ? `These four shapes use only what your ${sourceLabel} measured. Blank points were not tested.`
                  : "Scout will build these four views from your first scored questions."}
              </p>
            </div>

            {hasSkillEvidence ? (
              <div className="mt-8 grid gap-px overflow-hidden border bg-border sm:grid-cols-2">
                {SECTION_ORDER.map((section) => (
                  <SkillPolygon
                    key={section}
                    title={SECTION_LABELS[section]}
                    subtitle={
                      sectionScores
                        ? `Planning score ${normalizeActScore(sectionScores[section])}`
                        : "Question types"
                    }
                    data={sectionData[section]}
                  />
                ))}
                <SkillPolygon
                  title="Overall"
                  subtitle={`${currentScore} now · ${targetScore} goal`}
                  data={overallData.data}
                />
              </div>
            ) : (
              <div className="mx-auto mt-8 max-w-2xl border-y bg-background px-4 py-8 text-center sm:px-8">
                <h2 className="font-heading text-2xl font-black">
                  Your first lessons will create it.
                </h2>
                <p className="mt-3 leading-7 text-muted-foreground">
                  You’ll still learn all 12 question types. Scout adds the
                  English, Math, Reading, and overall shapes as you answer.
                </p>
              </div>
            )}

            <div className="mt-8 flex justify-center">
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
          <section className="mx-auto flex min-h-[calc(100svh-9rem)] max-w-4xl items-center justify-center py-6 text-center">
            <div className="w-full animate-in duration-300 fade-in slide-in-from-right-2 motion-reduce:animate-none">
              <ScoutMark
                mood="ready"
                className="mx-auto size-28 motion-reduce:animate-none sm:size-36"
              />
              <p className="ink-label mt-5 text-[var(--scout-coral-text)]">
                Mr. Kim · Scout’s in-app coach
              </p>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className={cn(sharedHeadingClass, "mx-auto mt-4 max-w-3xl")}
              >
                Want a quick question-type preview?
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
                See the 12 types now, or start lesson one. Round one teaches all
                of them either way.
              </p>

              <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  className="group min-h-36 border-2 border-primary bg-background p-5 text-left transition-[background-color,transform] hover:bg-secondary focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring active:translate-y-px motion-reduce:transition-none"
                  onClick={() => {
                    setExplainerIndex(0)
                    setStage("explain")
                  }}
                >
                  <BrainCircuitIcon className="size-7 text-primary" />
                  <span className="mt-4 block font-heading text-xl font-black">
                    Show me the question types
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                    Preview English, Math, and Reading.
                  </span>
                </button>

                <button
                  type="button"
                  className="group min-h-36 border-2 border-foreground bg-foreground p-5 text-left text-background transition-[transform,opacity] hover:opacity-90 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring active:translate-y-px motion-reduce:transition-none"
                  onClick={() => finish("start-lessons")}
                >
                  <BookOpenCheckIcon className="size-7 text-[var(--scout-sun)]" />
                  <span className="mt-4 block font-heading text-xl font-black">
                    Start lesson one
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-background/75">
                    Skip the preview and begin.
                  </span>
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {stage === "explain" ? (
          <section className="mx-auto max-w-4xl animate-in duration-300 fade-in slide-in-from-right-2 motion-reduce:animate-none">
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

                  <div className="mt-8 text-center">
                    <h1
                      ref={headingRef}
                      tabIndex={-1}
                      className={cn(sharedHeadingClass, "mx-auto")}
                    >
                      {SECTION_LABELS[section]} question types
                    </h1>
                    <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                      These four patterns make up your first{" "}
                      {SECTION_LABELS[section]} lessons.
                    </p>
                  </div>

                  <ol className="mt-8 grid gap-px overflow-hidden border bg-border sm:grid-cols-2">
                    {skills.map((skill, index) => (
                      <li key={skill.slug} className="bg-background p-5 sm:p-6">
                        <span className="font-mono text-xs font-black text-primary">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <h2 className="mt-3 font-heading text-xl font-black">
                          {skill.label}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {skill.explanation}
                        </p>
                      </li>
                    ))}
                  </ol>

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
                        ? "Start lessons"
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
