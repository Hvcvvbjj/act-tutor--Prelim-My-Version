"use client"

import { useRef } from "react"
import type {
  KnowledgeState,
  LearningTwinRecommendation,
  RecommendationContribution,
} from "@act-tutor/core"
import {
  actScoreEquivalentFromPoints,
  pointsProgressToNextActPoint,
} from "@act-tutor/core"

import { cn } from "@/lib/utils"

const SECTION_ORDER = ["english", "math", "reading"] as const

const SECTION_LABELS = {
  english: "English",
  math: "Math",
  reading: "Reading",
} as const

const SKILL_ORDER = [
  "sentence-boundaries",
  "punctuation-and-commas",
  "concision-and-redundancy",
  "logical-transitions",
  "ratios-and-percent",
  "linear-equations",
  "functions-and-modeling",
  "geometry-and-measurement",
  "central-ideas-and-details",
  "textual-evidence-and-details",
  "supported-inference",
  "author-purpose-and-structure",
] as const

const SHORT_LABELS: Record<string, string> = {
  "sentence-boundaries": "Sentences",
  "punctuation-and-commas": "Commas",
  "concision-and-redundancy": "Concision",
  "logical-transitions": "Transition",
  "ratios-and-percent": "Ratios",
  "linear-equations": "Equations",
  "functions-and-modeling": "Functions",
  "geometry-and-measurement": "Geometry",
  "central-ideas-and-details": "Main ideas",
  "textual-evidence-and-details": "Evidence",
  "supported-inference": "Inference",
  "author-purpose-and-structure": "Purpose",
}

const CONFIDENCE_COPY = {
  exploring: "Early estimate · fewer than 3 answers",
  forming: "Developing estimate · more evidence will help",
  stable: "Steadier estimate · at least 7 answers",
} as const

function percent(value: number) {
  return `${Math.round(value * 100)}%`
}

function clampedProbability(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

function pointAt(index: number, value: number, radius: number) {
  const angle = (-90 + index * (360 / SKILL_ORDER.length)) * (Math.PI / 180)
  return {
    x: 320 + Math.cos(angle) * radius * value,
    y: 320 + Math.sin(angle) * radius * value,
  }
}

function pointsFor(value: number, radius = 190) {
  return SKILL_ORDER.map((_, index) => pointAt(index, value, radius))
    .map((point) => `${point.x},${point.y}`)
    .join(" ")
}

function contributionSet(
  state: KnowledgeState,
  recommendation: LearningTwinRecommendation
): ReadonlyArray<RecommendationContribution> {
  if (state.skill === recommendation.skill) return recommendation.contributions
  return [
    {
      id: "knowledge-gap",
      label: "Lower predicted chance on a medium question",
      points: Math.round((1 - state.predictedCorrectProbability) * 52),
      explanation: "(1 − predicted correct) × 52",
    },
    {
      id: "uncertainty",
      label: "Estimate entropy",
      points: Math.round(state.uncertainty * 24),
      explanation: "binary entropy × 24",
    },
    {
      id: "evidence-scarcity",
      label: "Few scored answers",
      points: Math.round((1 / (state.evidenceCount + 1)) * 14),
      explanation: "1 ÷ (answer count + 1) × 14",
    },
    {
      id: "recent-lapse",
      label: "Recent-miss bonus",
      points: state.lastUpdate && !state.lastUpdate.correct ? 10 : 0,
      explanation:
        state.lastUpdate && !state.lastUpdate.correct
          ? "Latest answer was missed, so this adds 10"
          : "Latest answer was not missed, so this adds 0",
    },
  ]
}

function MobileSectionOverview({
  skills,
  selectedSkill,
}: {
  skills: ReadonlyArray<KnowledgeState>
  selectedSkill: string
}) {
  const selectedSection = skills.find(
    (skill) => skill.skill === selectedSkill
  )?.section

  return (
    <section
      data-testid="mobile-mastery-overview"
      className="px-3 pb-3 sm:hidden"
      aria-labelledby="mobile-section-overview-title"
    >
      <h3
        id="mobile-section-overview-title"
        className="font-heading text-xl font-black"
      >
        Section overview
      </h3>
      <p className="mt-1 text-xs leading-5 text-white/65">
        Each bar averages four skill practice estimates. It is not an ACT
        section score.
      </p>
      <ul className="mt-4 grid gap-3">
        {SECTION_ORDER.map((section) => {
          const sectionSkills = skills.filter(
            (skill) => skill.section === section
          )
          const average =
            sectionSkills.reduce(
              (sum, skill) =>
                sum + clampedProbability(skill.learnedProbability),
              0
            ) / Math.max(sectionSkills.length, 1)
          const measuredCount = sectionSkills.filter(
            (skill) => skill.evidenceCount > 0
          ).length
          const selected = section === selectedSection

          return (
            <li
              key={section}
              className={cn(
                "rounded-xl border border-white/20 bg-white/5 p-4",
                selected && "border-[var(--scout-sun)] bg-[var(--scout-sun)]/8"
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading text-lg font-black">
                    {SECTION_LABELS[section]}
                  </p>
                  {selected ? (
                    <p className="mt-0.5 text-[0.68rem] font-bold tracking-wide text-[var(--scout-sun)] uppercase">
                      Selected skill is here
                    </p>
                  ) : null}
                </div>
                <p className="font-heading text-3xl font-black tabular-nums">
                  {percent(average)}
                </p>
              </div>
              <span
                className="mt-3 block h-2 overflow-hidden rounded-full bg-white/15"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-[var(--scout-mint)]"
                  style={{ width: percent(average) }}
                />
              </span>
              <p className="mt-2 text-xs leading-5 text-white/65">
                {measuredCount === 0
                  ? "Starting estimates only · no scored answers yet"
                  : `${measuredCount} of ${sectionSkills.length} skills have scored evidence`}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function MasteryRadar({
  skills,
  selectedSkill,
}: {
  skills: ReadonlyArray<KnowledgeState>
  selectedSkill: string
}) {
  const bySlug = new Map(skills.map((skill) => [skill.skill, skill]))
  const ordered = SKILL_ORDER.map((slug) => bySlug.get(slug) ?? null)
  const outer = pointsFor(1)
  const actualPoints = ordered.map((skill, index) =>
    skill
      ? pointAt(index, clampedProbability(skill.learnedProbability), 190)
      : null
  )
  const completePolygon = actualPoints.every(
    (point): point is { x: number; y: number } => point !== null
  )

  return (
    <svg
      data-testid="mastery-radar"
      viewBox="0 0 640 640"
      className="mx-auto hidden aspect-square w-full max-w-[42rem] sm:block"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="mastery-profile-glow">
          <stop offset="0%" stopColor="var(--scout-sun)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="320" cy="320" r="245" fill="url(#mastery-profile-glow)" />
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <polygon
          key={level}
          points={pointsFor(level)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={level === 1 ? 0.55 : 0.25}
          strokeWidth={level === 1 ? 2 : 1}
        />
      ))}
      {SKILL_ORDER.map((slug, index) => {
        const edge = pointAt(index, 1, 190)
        const selected = slug === selectedSkill
        return (
          <line
            key={slug}
            x1="320"
            y1="320"
            x2={edge.x}
            y2={edge.y}
            stroke="currentColor"
            strokeOpacity={selected ? 0.55 : 0.28}
            strokeWidth={selected ? 2 : 1}
            strokeDasharray={selected ? "4 6" : undefined}
          />
        )
      })}
      {completePolygon ? (
        <polygon
          points={actualPoints
            .map((point) => `${point.x},${point.y}`)
            .join(" ")}
          fill="var(--scout-mint)"
          fillOpacity="0.15"
          stroke="none"
        />
      ) : null}
      {actualPoints.map((point, index) => {
        const state = ordered[index]
        const nextPoint = actualPoints[(index + 1) % actualPoints.length]
        const nextState = ordered[(index + 1) % ordered.length]
        if (!point || !state || !nextPoint || !nextState) return null
        return (
          <line
            key={`${state.skill}-segment`}
            x1={point.x}
            y1={point.y}
            x2={nextPoint.x}
            y2={nextPoint.y}
            stroke="var(--scout-mint)"
            strokeWidth="4"
            strokeDasharray={
              state.evidenceCount === 0 || nextState.evidenceCount === 0
                ? "8 7"
                : undefined
            }
          />
        )
      })}
      {actualPoints.map((point, index) => {
        const state = ordered[index]
        if (!point || !state) return null
        const selected = state.skill === selectedSkill
        return (
          <g key={`${state.skill}-point`}>
            {selected ? (
              <circle
                cx={point.x}
                cy={point.y}
                r="11"
                fill="none"
                stroke="var(--scout-coral)"
                strokeWidth="4"
              />
            ) : null}
            <circle
              cx={point.x}
              cy={point.y}
              r="6"
              fill={state.evidenceCount > 0 ? "var(--scout-mint)" : "#10243d"}
              stroke="#f7fbff"
              strokeWidth={state.evidenceCount > 0 ? 2 : 3}
            />
          </g>
        )
      })}
      {[25, 50, 75, 100].map((value) => {
        const point = pointAt(0, value / 100, 190)
        return (
          <text
            key={value}
            x="327"
            y={point.y + 4}
            fill="currentColor"
            fillOpacity="0.62"
            className="text-[18px] sm:text-[12px]"
            fontWeight="700"
          >
            {value}
          </text>
        )
      })}
      {SKILL_ORDER.map((slug, index) => {
        const labelPoint = pointAt(index, 1, 215)
        const anchor =
          labelPoint.x < 285 ? "end" : labelPoint.x > 355 ? "start" : "middle"
        const label = SHORT_LABELS[slug] ?? slug
        return (
          <text
            key={`${slug}-label`}
            x={labelPoint.x}
            y={labelPoint.y}
            textAnchor={anchor}
            fill={slug === selectedSkill ? "var(--scout-sun)" : "currentColor"}
            className="text-[19px] sm:text-[13px]"
            fontWeight={slug === selectedSkill ? "800" : "650"}
          >
            {label}
          </text>
        )
      })}
      <polygon points={outer} fill="none" stroke="transparent" />
    </svg>
  )
}

function SkillRows({
  skills,
  selectedSkill,
  onSelect,
}: {
  skills: ReadonlyArray<KnowledgeState>
  selectedSkill: string
  onSelect: (skill: string) => void
}) {
  return (
    <div className="grid gap-7 lg:grid-cols-3">
      {SECTION_ORDER.map((section) => (
        <section key={section} aria-labelledby={`profile-${section}`}>
          <h3
            id={`profile-${section}`}
            className="border-b-2 border-foreground pb-3 font-heading text-xl font-black"
          >
            {SECTION_LABELS[section]}
          </h3>
          <div className="divide-y">
            {skills
              .filter((skill) => skill.section === section)
              .sort(
                (left, right) =>
                  SKILL_ORDER.indexOf(
                    left.skill as (typeof SKILL_ORDER)[number]
                  ) -
                  SKILL_ORDER.indexOf(
                    right.skill as (typeof SKILL_ORDER)[number]
                  )
              )
              .map((skill) => (
                <button
                  key={skill.skill}
                  type="button"
                  onClick={() => onSelect(skill.skill)}
                  aria-pressed={selectedSkill === skill.skill}
                  aria-controls="selected-skill-detail"
                  className={cn(
                    "w-full px-3 py-3 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
                    selectedSkill === skill.skill && "bg-[var(--info-surface)]"
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-bold">{skill.label}</span>
                    <span className="font-heading text-2xl font-black tabular-nums">
                      {percent(skill.learnedProbability)}
                    </span>
                  </span>
                  <span className="mt-2 block h-2 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.round(skill.learnedProbability * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="sr-only">
                    {skill.evidenceCount === 0
                      ? "Starting estimate · no skill-specific answers yet"
                      : `${skill.evidenceCount} scored ${skill.evidenceCount === 1 ? "answer" : "answers"} · ${CONFIDENCE_COPY[skill.confidence]}`}
                  </span>
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function MasteryProfile({
  skills,
  recommendation,
  selectedSkill,
  onSelect,
  canViewTechnicalDetails,
  points,
  startingScore,
}: {
  skills: ReadonlyArray<KnowledgeState>
  recommendation: LearningTwinRecommendation
  selectedSkill: string
  onSelect: (skill: string) => void
  canViewTechnicalDetails: boolean
  points: number
  startingScore: number
}) {
  const selected =
    skills.find((skill) => skill.skill === selectedSkill) ?? skills[0]
  const selectedIsRecommendation = selected.skill === recommendation.skill
  const measured = skills.filter((skill) => skill.evidenceCount > 0)
  const strongest = [...measured]
    .sort(
      (left, right) =>
        right.learnedProbability - left.learnedProbability ||
        right.evidenceCount - left.evidenceCount
    )
    .slice(0, 3)
  const contributions = contributionSet(selected, recommendation)
  const priority = Math.min(
    100,
    contributions.reduce((sum, item) => sum + item.points, 0)
  )
  const pointProgress = pointsProgressToNextActPoint(points)
  const pointScoreEquivalent = actScoreEquivalentFromPoints(
    startingScore,
    points
  )
  const selectedSkillHeadingRef = useRef<HTMLHeadingElement>(null)

  function selectSkill(skill: string) {
    onSelect(skill)
    if (!window.matchMedia("(max-width: 1023px)").matches) return
    window.requestAnimationFrame(() => {
      selectedSkillHeadingRef.current?.focus({ preventScroll: true })
      selectedSkillHeadingRef.current?.scrollIntoView({
        block: "start",
        behavior: "auto",
      })
    })
  }

  return (
    <div className="mt-8">
      <details className="group border-y border-border/80">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-1 text-sm font-semibold text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span>See skill map</span>
          <span className="text-xs font-semibold group-open:hidden">
            Optional
          </span>
          <span className="hidden text-xs font-semibold group-open:inline">
            Hide map
          </span>
        </summary>
        <div className="border-t border-white/15 bg-[#10243d] text-[#f7fbff]">
          <h2 id="mastery-profile-title" className="sr-only">
            Skill map
          </h2>
          <p id="mastery-profile-description" className="sr-only">
            Higher shapes mean stronger current estimates. Choose a skill below
            for its exact value.
          </p>

          <div className="grid items-center gap-2 px-3 py-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:px-7">
            <MobileSectionOverview
              skills={skills}
              selectedSkill={selected.skill}
            />
            <MasteryRadar skills={skills} selectedSkill={selected.skill} />
            <aside className="px-3 pb-5 lg:px-0 lg:pb-0">
              <div className="mb-5 border-y border-white/20 py-3">
                <p className="font-mono text-[0.68rem] font-black tracking-[0.1em] text-[var(--scout-sun)] uppercase">
                  Points score marker
                </p>
                <p className="mt-1 font-heading text-3xl font-black tabular-nums">
                  {pointScoreEquivalent}
                </p>
                <p className="mt-1 text-xs leading-5 text-white/65">
                  {pointProgress.pointsInCurrentActPoint.toLocaleString(
                    "en-US"
                  )}{" "}
                  / 1,000 points toward the next marker. Scored answers shape
                  the polygon; points set this matching ACT-scale marker.
                </p>
              </div>
              <p className="font-mono text-xs font-black tracking-[0.1em] text-white/60 uppercase">
                Highest current estimates
              </p>
              {strongest.length >= 2 ? (
                <ol className="mt-3 divide-y divide-white/15 border-y border-white/20">
                  {strongest.map((skill, index) => (
                    <li
                      key={skill.skill}
                      className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-3"
                    >
                      <span className="font-mono text-xs text-white/50">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-bold">{skill.label}</span>
                      <span className="font-heading text-2xl font-black tabular-nums">
                        {percent(skill.learnedProbability)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 border-y border-white/20 py-4 text-sm leading-6 text-white/75">
                  Your profile is still forming. Answer scored questions in at
                  least two skills before Scout lists current strengths.
                </p>
              )}
              <div className="mt-5 border-l-4 border-[var(--scout-coral)] bg-white/7 p-4">
                <p className="font-mono text-[0.68rem] font-black tracking-[0.1em] text-[var(--scout-sun)] uppercase">
                  Study next
                </p>
                <p className="mt-2 font-heading text-2xl font-black">
                  {recommendation.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  This skill needs the most useful next practice.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </details>

      <section className="mt-8" aria-label="All skills">
        <SkillRows
          skills={skills}
          selectedSkill={selected.skill}
          onSelect={selectSkill}
        />
      </section>

      <section
        id="selected-skill-detail"
        className="mt-8 border-y-2 border-foreground py-6"
        aria-labelledby="selected-skill-title"
      >
        <p className="sr-only" aria-live="polite">
          Selected {selected.label}, {percent(selected.learnedProbability)},{" "}
          {selected.evidenceCount} scored{" "}
          {selected.evidenceCount === 1 ? "answer" : "answers"}.
        </p>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="ink-label text-[var(--scout-coral-text)]">
              Selected skill · {SECTION_LABELS[selected.section]}
            </p>
            <h2
              ref={selectedSkillHeadingRef}
              id="selected-skill-title"
              tabIndex={-1}
              className="mt-2 scroll-mt-28 font-heading text-4xl font-black outline-none"
            >
              {selected.label}
            </h2>
          </div>
          <div className="text-right">
            <p className="font-heading text-6xl leading-none font-black tabular-nums">
              {percent(selected.learnedProbability)}
            </p>
            <p className="mt-1 text-xs font-bold text-muted-foreground">
              Skill practice estimate
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-5 border-t pt-5 sm:grid-cols-2">
          <div>
            <dt className="ink-label text-muted-foreground">Evidence</dt>
            <dd className="mt-2 text-sm leading-6 font-semibold">
              {selected.evidenceCount} scored{" "}
              {selected.evidenceCount === 1 ? "answer" : "answers"}
            </dd>
          </div>
          <div>
            <dt className="ink-label text-muted-foreground">Estimate status</dt>
            <dd className="mt-2 text-sm leading-6 font-semibold">
              {CONFIDENCE_COPY[selected.confidence]}
            </dd>
          </div>
        </dl>

        <div className="mt-6 grid gap-6 border-t pt-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <h3 className="font-heading text-xl font-black">
              Last scored change
            </h3>
            {selected.lastUpdate ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {selected.lastUpdate.correct ? "Correct" : "Missed"} on a{" "}
                {selected.lastUpdate.difficulty} question. The estimate moved
                from {percent(selected.lastUpdate.learnedBefore)} to{" "}
                {percent(selected.lastUpdate.learnedAfterTransition)} (
                {selected.lastUpdate.delta >= 0 ? "+" : ""}
                {Math.round(selected.lastUpdate.delta * 100)} points).
              </p>
            ) : (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                No skill-specific practice or Quick Check answer has changed
                this estimate yet.
              </p>
            )}
          </div>
          {canViewTechnicalDetails ? (
            <details>
              <summary className="cursor-pointer font-heading text-xl font-black outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                {selectedIsRecommendation
                  ? "How Scout chose this skill (technical details)"
                  : "How this skill compares (technical details)"}
              </summary>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {selectedIsRecommendation
                  ? `Ranking score: ${priority}/100.`
                  : `This skill’s current ranking score is ${priority}/100; Scout currently recommends ${recommendation.label}.`}{" "}
                This is not an ACT score or a probability.
              </p>
              <ol className="mt-3 divide-y border-y">
                {contributions.map((item) => (
                  <li
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-bold">{item.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.explanation}
                      </p>
                    </div>
                    <span className="font-heading text-2xl font-black tabular-nums">
                      +{item.points}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          ) : (
            <div>
              <h3 className="font-heading text-xl font-black">
                {selectedIsRecommendation
                  ? "Why this is next"
                  : "What Scout recommends now"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {selectedIsRecommendation
                  ? `${recommendation.label} needs the most useful next practice.`
                  : `Scout currently recommends ${recommendation.label}.`}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
