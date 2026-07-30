"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type {
  CoreSection,
  CoreSectionScores,
  DiagnosticSkillResult,
} from "@act-tutor/core"
import { REVIEWED_ACT_QUESTION_EXAMPLES } from "@act-tutor/content"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenCheckIcon,
  BrainCircuitIcon,
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
  startAtProfile?: boolean
  onStartDashboardTour?: () => boolean
  onComplete: (choice: LearnerOrientationChoice) => void
}

type OrientationStage = "score" | "profile" | "choice" | "explain"

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

const QUESTION_TYPE_SLIDES = SECTION_ORDER.flatMap((section) =>
  SECTION_SKILLS[section].map((skill) => {
    const example = REVIEWED_ACT_QUESTION_EXAMPLES.find(
      (question) => question.skill === skill.slug
    )

    if (!example) {
      throw new Error(`Missing reviewed example for ${skill.slug}.`)
    }

    return { section, skill, example }
  })
)

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
      <span className="sr-only">Your current starting score is {score}.</span>
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

export function LearnerOrientation({
  currentComposite,
  targetComposite,
  skillResults = [],
  sectionScores = null,
  evidenceSource,
  startAtProfile = false,
  onStartDashboardTour,
  onComplete,
}: LearnerOrientationProps) {
  const [stage, setStage] = useState<OrientationStage>(
    startAtProfile ? "profile" : "score"
  )
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
  }, [explainerIndex, reducedMotion, stage])

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
            AlexACT
          </span>
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
            <div className="w-full">
              <p className="ink-label text-primary">{completionLabel}</p>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className={cn(sharedHeadingClass, "mx-auto mt-4 max-w-3xl")}
              >
                Your starting score is ready.
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                AlexACT updates it as you complete scored work.
              </p>

              <div className="mx-auto mt-9 max-w-xl border-y py-7">
                <p className="ink-label text-muted-foreground">
                  Starting score
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
                  ? `Score reveal complete. Your starting score is ${currentScore}.`
                  : "Preparing your starting score."}
              </p>
              <Button
                type="button"
                size="xl"
                className="mt-8 w-full max-w-sm"
                disabled={!scoreReady}
                onClick={() => {
                  if (!onStartDashboardTour?.()) setStage("profile")
                }}
              >
                Continue
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </div>
          </section>
        ) : null}

        {stage === "profile" ? (
          <section className="mx-auto max-w-5xl">
            <div className="text-center">
              <p className="ink-label text-primary">Your starting profile</p>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className={cn(sharedHeadingClass, "mx-auto mt-4 max-w-4xl")}
              >
                {hasSkillEvidence
                  ? "Your question-type map."
                  : "Your score is set. The skill map starts empty."}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                {hasSkillEvidence
                  ? `Based only on your ${sourceLabel} answers. Untested skills stay blank.`
                  : "Your reported score sets the starting point. Diagnostic and practice answers fill in each question type without inventing detail."}
              </p>
            </div>

            <div className="mt-8 grid gap-px overflow-hidden border bg-border sm:grid-cols-2">
              {SECTION_ORDER.map((section) => (
                <SkillPolygon
                  key={section}
                  title={SECTION_LABELS[section]}
                  subtitle={
                    sectionScores
                      ? `Starting score ${normalizeActScore(sectionScores[section])}`
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
            <div className="w-full">
              <ScoutMark
                mood="ready"
                className="mx-auto size-28 motion-reduce:animate-none sm:size-36"
              />
              <p className="ink-label mt-5 text-[var(--scout-coral-text)]">
                Mr. Kim · AlexACT’s in-app coach
              </p>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className={cn(sharedHeadingClass, "mx-auto mt-4 max-w-3xl")}
              >
                Want me to teach the 12 question types first?
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
                See one reviewed example for each type, or start lesson one.
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
                    Teach me the question types
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                    12 focused slides with an example and answer.
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
                    Go straight to the first foundation lesson.
                  </span>
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {stage === "explain" ? (
          <section className="mx-auto max-w-6xl">
            {(() => {
              const slide = QUESTION_TYPE_SLIDES[explainerIndex]
              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="ink-label text-primary">
                      Question type · {explainerIndex + 1} of{" "}
                      {QUESTION_TYPE_SLIDES.length}
                    </p>
                    <div
                      className="flex max-w-sm flex-wrap justify-end gap-1.5"
                      aria-hidden="true"
                    >
                      {QUESTION_TYPE_SLIDES.map((item, index) => (
                        <span
                          key={item.skill.slug}
                          className={cn(
                            "h-2 rounded-full",
                            index === explainerIndex
                              ? "w-8 bg-primary"
                              : index < explainerIndex
                                ? "w-2 bg-[var(--scout-sun)]"
                                : "w-2 bg-border"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-7">
                    <p className="font-mono text-xs font-black tracking-[0.12em] text-muted-foreground uppercase">
                      {SECTION_LABELS[slide.section]}
                    </p>
                    <h1
                      ref={headingRef}
                      tabIndex={-1}
                      className="mt-2 max-w-4xl font-heading text-4xl leading-[1.02] font-black tracking-[-0.04em] outline-none sm:text-5xl"
                    >
                      {slide.skill.label}
                    </h1>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                      {slide.skill.explanation}
                    </p>
                  </div>

                  <div className="mt-7 grid overflow-hidden rounded-2xl border bg-border lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:gap-px">
                    <article className="bg-background p-5 sm:p-7">
                      <p className="ink-label text-primary">
                        Reviewed ACT-style example
                      </p>
                      {slide.example.stimulus ? (
                        <p className="mt-4 border-l-2 border-primary/40 pl-4 text-sm leading-6">
                          {slide.example.stimulus}
                        </p>
                      ) : null}
                      <h2 className="mt-5 text-lg leading-7 font-black">
                        {slide.example.prompt}
                      </h2>
                      <ol className="mt-5 grid gap-2">
                        {slide.example.choices.map((choice) => {
                          const correct =
                            choice.id === slide.example.correctChoiceId
                          return (
                            <li
                              key={choice.id}
                              className={cn(
                                "grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-xl border px-4 py-3 text-sm leading-6",
                                correct
                                  ? "border-primary bg-secondary"
                                  : "border-border bg-muted/35"
                              )}
                            >
                              <span
                                className={cn(
                                  "font-mono font-black",
                                  correct
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                )}
                              >
                                {choice.id}
                              </span>
                              <span className={correct ? "font-semibold" : ""}>
                                {choice.text}
                              </span>
                            </li>
                          )
                        })}
                      </ol>
                    </article>

                    <aside className="bg-[var(--info-surface)] p-5 sm:p-7">
                      <div className="flex items-center gap-3">
                        <ScoutMark className="size-14" />
                        <div>
                          <p className="font-heading text-xl font-black">
                            Mr. Kim explains
                          </p>
                          <p className="text-xs font-bold text-primary">
                            Answer {slide.example.correctChoiceId}
                          </p>
                        </div>
                      </div>
                      <p className="mt-5 text-sm leading-7">
                        {slide.example.rationale}
                      </p>
                      <p className="mt-6 border-t border-foreground/15 pt-5 text-sm leading-6 text-muted-foreground">
                        <strong className="text-foreground">
                          What to notice:
                        </strong>{" "}
                        {slide.example.difficultyEvidence[0]}
                      </p>
                    </aside>
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
                        if (
                          explainerIndex ===
                          QUESTION_TYPE_SLIDES.length - 1
                        ) {
                          finish("explain-types")
                          return
                        }
                        setExplainerIndex((index) => index + 1)
                      }}
                    >
                      {explainerIndex === QUESTION_TYPE_SLIDES.length - 1
                        ? "Start lessons"
                        : "Next example"}
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
