"use client"

import { useState } from "react"
import type {
  KnowledgeState,
  LearningSessionPayload,
  LearningTwinForecast,
  RecommendationContribution,
} from "@act-tutor/core"
import {
  ActivityIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BrainCircuitIcon,
  DatabaseZapIcon,
  FlaskConicalIcon,
  GaugeIcon,
  LockKeyholeIcon,
  PrinterIcon,
  CopyIcon,
  RouteIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { ScoutCoach } from "@/components/tutor/scout"
import type { GeneratedPlan } from "@/components/tutor/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface LearningTwinLabProps {
  plan: GeneratedPlan
  learning: LearningSessionPayload | null
  onOpenLesson: () => void
}

const SECTION_LABELS = {
  english: "English",
  math: "Math",
  reading: "Reading",
} as const

const PRIOR_LABELS = {
  diagnostic: "Based on your diagnostic",
  "score-estimate": "Based on your score",
  "neutral-prior": "Needs more answers",
} as const

const CONTRIBUTION_COPY = {
  "knowledge-gap": {
    label: "Needs work",
    explanation: "Scout thinks this is one of your weaker skills right now.",
  },
  uncertainty: {
    label: "Needs a clearer answer",
    explanation: "Scout is not fully sure about this skill yet.",
  },
  "evidence-scarcity": {
    label: "Not many questions answered",
    explanation: "You have answered fewer questions for this skill.",
  },
  "recent-lapse": {
    label: "Recent miss",
    explanation: "A recent wrong answer moved this skill up the list.",
  },
} as const

function percent(value: number) {
  return `${Math.round(value * 100)}%`
}

function signedPoints(value: number) {
  const points = Math.round(value * 100)
  return `${points > 0 ? "+" : ""}${points} pts`
}

function ProbabilityMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: number
  detail: string
}) {
  return (
    <div className="border-t-2 border-foreground pt-4">
      <p className="ink-label text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-5xl leading-none font-black tabular-nums">
        {percent(value)}
      </p>
      <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
        {detail}
      </p>
    </div>
  )
}

const SCORE_IMPACT: Record<string, "high" | "medium"> = {
  "sentence-boundaries": "high",
  "punctuation-and-commas": "high",
  "linear-equations": "high",
  "functions-and-modeling": "high",
  "central-ideas-and-details": "high",
  "supported-inference": "high",
}

const PREREQUISITE_ORDER: Record<string, number> = {
  "sentence-boundaries": 1,
  "punctuation-and-commas": 2,
  "concision-and-redundancy": 3,
  "logical-transitions": 4,
  "ratios-and-percent": 1,
  "linear-equations": 2,
  "functions-and-modeling": 3,
  "geometry-and-measurement": 4,
  "central-ideas-and-details": 1,
  "textual-evidence-and-details": 2,
  "supported-inference": 3,
  "author-purpose-and-structure": 4,
}

function InteractiveSkillMap({
  skills,
  learning,
  selectedSkill,
  onSelect,
}: {
  skills: ReadonlyArray<KnowledgeState>
  learning: LearningSessionPayload
  selectedSkill: string
  onSelect: (skill: string) => void
}) {
  return (
    <section className="mt-10 border-y-2 border-foreground py-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="ink-label text-primary">Connected skill map</p>
          <h2 className="mt-2 font-heading text-4xl font-black">
            Every mark has a job.
          </h2>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>Fill = mastery</span>
          <span>Border = certainty</span>
          <span>Size = score impact</span>
          <span>Arrow = prerequisite</span>
        </div>
      </div>
      <div className="mt-6 grid gap-6">
        {(["english", "math", "reading"] as const).map((section) => {
          const lane = skills
            .filter((skill) => skill.section === section)
            .sort(
              (left, right) =>
                (PREREQUISITE_ORDER[left.skill] ?? 99) -
                (PREREQUISITE_ORDER[right.skill] ?? 99)
            )
          return (
            <div
              key={section}
              className="grid gap-3 md:grid-cols-[6rem_minmax(0,1fr)] md:items-center"
            >
              <p className="font-heading text-xl font-black">
                {SECTION_LABELS[section]}
              </p>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {lane.map((state, index) => {
                  const certainty =
                    state.confidence === "stable"
                      ? "border-[3px]"
                      : state.confidence === "forming"
                        ? "border-2"
                        : "border border-dashed"
                  const badge =
                    state.skill === learning.todaySkill
                      ? "Today"
                      : state.skill === learning.nextSkill
                        ? "Next"
                        : learning.mission.dueReviews.some(
                              (review) => review.skill === state.skill
                            )
                          ? "Review"
                          : null
                  return (
                    <div
                      key={state.skill}
                      className="flex shrink-0 items-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(state.skill)}
                        aria-pressed={selectedSkill === state.skill}
                        className={cn(
                          "relative w-40 border-foreground px-3 py-3 text-left transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
                          certainty,
                          SCORE_IMPACT[state.skill] === "high"
                            ? "min-h-24"
                            : "min-h-20",
                          selectedSkill === state.skill &&
                            "shadow-[4px_4px_0_var(--foreground)]"
                        )}
                        style={{
                          background: `color-mix(in srgb, var(--scout-mint) ${Math.round(
                            state.learnedProbability * 82
                          )}%, var(--background))`,
                        }}
                      >
                        {badge ? (
                          <span className="absolute -top-2 right-2 bg-foreground px-2 py-0.5 font-mono text-[0.55rem] font-black text-background uppercase">
                            {badge}
                          </span>
                        ) : null}
                        <span className="block text-sm leading-5 font-bold">
                          {state.label}
                        </span>
                        <span className="mt-2 block font-mono text-xs font-black">
                          {percent(state.learnedProbability)} known
                        </span>
                      </button>
                      {index < lane.length - 1 ? (
                        <ArrowRightIcon
                          className="size-5 shrink-0 text-primary"
                          aria-label="is a prerequisite for"
                        />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function PlanChangePanel({ learning }: { learning: LearningSessionPayload }) {
  const change = learning.planCounterfactual
  return (
    <section className="mt-10 grid border-y-2 border-foreground lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:divide-x-2 lg:divide-foreground">
      <div className="py-7 lg:pr-7">
        <div className="flex items-center gap-3 text-primary">
          <LockKeyholeIcon className="size-5" />
          <p className="ink-label">
            {change.status === "held" ? "Plan held" : "Plan changed"}
          </p>
        </div>
        <h2 className="mt-3 font-heading text-4xl font-black">
          What would change the plan?
        </h2>
        <dl className="mt-6 grid grid-cols-2 gap-5 border-t-2 border-foreground pt-5">
          <div>
            <dt className="ink-label text-muted-foreground">
              Current evidence
            </dt>
            <dd className="mt-1 font-heading text-4xl font-black tabular-nums">
              {change.currentEvidence}%
            </dd>
          </div>
          <div>
            <dt className="ink-label text-muted-foreground">Change line</dt>
            <dd className="mt-1 font-heading text-4xl font-black text-primary tabular-nums">
              {change.changeThreshold}%
            </dd>
          </div>
        </dl>
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          Scout needs{" "}
          {change.responsesNeeded === 1 ? "one" : change.responsesNeeded} more
          high-information response{change.responsesNeeded === 1 ? "" : "s"}{" "}
          before it has enough reason to replace the next mission.
        </p>
      </div>
      <div className="py-7 lg:pl-7">
        <p className="font-heading text-2xl font-black">Two possible paths</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="border-l-4 border-primary bg-[var(--info-surface)] p-4">
            <p className="ink-label text-primary">
              If the next answer is right
            </p>
            <p className="mt-2 text-sm leading-6">{change.correctOutcome}</p>
          </div>
          <div className="border-l-4 border-[var(--scout-coral)] bg-[var(--coach-surface)] p-4">
            <p className="ink-label text-[var(--scout-coral)]">
              If it is missed
            </p>
            <p className="mt-2 text-sm leading-6">{change.incorrectOutcome}</p>
          </div>
        </div>
        <p className="mt-5 text-sm font-semibold">{change.explanation}</p>
      </div>
    </section>
  )
}

function ContributionInspector({
  learning,
  selected,
}: {
  learning: LearningSessionPayload
  selected: KnowledgeState
}) {
  const recommendation = learning.learningTwin.recommendation
  const isRecommended = recommendation.skill === selected.skill
  const contributions: ReadonlyArray<RecommendationContribution> = isRecommended
    ? recommendation.contributions
    : [
        {
          id: "knowledge-gap",
          label: "Needs work",
          points: Math.round((1 - selected.predictedCorrectProbability) * 52),
          explanation:
            "Scout thinks this is one of your weaker skills right now.",
        },
        {
          id: "uncertainty",
          label: "Needs a clearer answer",
          points: Math.round(selected.uncertainty * 24),
          explanation: "Scout is not fully sure about this skill yet.",
        },
        {
          id: "evidence-scarcity",
          label: "Not many questions answered",
          points: Math.round((1 / (selected.evidenceCount + 1)) * 14),
          explanation: "You have answered fewer questions for this skill.",
        },
        {
          id: "recent-lapse",
          label: "Recent miss",
          points: selected.lastUpdate && !selected.lastUpdate.correct ? 10 : 0,
          explanation: "A recent wrong answer moved this skill up the list.",
        },
      ]
  const total = Math.min(
    100,
    contributions.reduce((sum, contribution) => sum + contribution.points, 0)
  )

  return (
    <section
      className="border-l-4 border-primary bg-background px-5 py-6 shadow-[5px_5px_0_rgb(20_35_58_/_0.12)] sm:px-7"
      aria-labelledby="model-inspector-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-foreground pb-5">
        <div>
          <p className="ink-label text-primary">Why this skill?</p>
          <h2
            id="model-inspector-title"
            className="mt-2 font-heading text-4xl leading-none font-black"
          >
            {selected.label}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {SECTION_LABELS[selected.section]} ·{" "}
            {PRIOR_LABELS[selected.priorSource]}
          </p>
        </div>
        <div className="text-right">
          <p className="ink-label text-muted-foreground">Practice soon</p>
          <p className="mt-1 font-heading text-5xl leading-none font-black text-[var(--scout-coral)] tabular-nums">
            {total}
          </p>
          <p className="text-xs text-muted-foreground">of 100</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        <ProbabilityMetric
          label="How well you know it"
          value={selected.learnedProbability}
          detail="Scout's estimate of how well you know this skill."
        />
        <ProbabilityMetric
          label="Chance on the next question"
          value={selected.predictedCorrectProbability}
          detail="Your estimated chance on another medium question."
        />
        <ProbabilityMetric
          label="How unsure Scout is"
          value={selected.uncertainty}
          detail="Higher means Scout needs more answers before it can be sure."
        />
      </div>

      {selected.lastUpdate ? (
        <div
          className={cn(
            "mt-6 flex items-start gap-3 border-y py-4",
            selected.lastUpdate.correct
              ? "text-primary"
              : "text-[var(--scout-coral)]"
          )}
          aria-live="polite"
        >
          {selected.lastUpdate.delta >= 0 ? (
            <ArrowUpIcon className="mt-0.5 size-5" aria-hidden="true" />
          ) : (
            <ArrowDownIcon className="mt-0.5 size-5" aria-hidden="true" />
          )}
          <div>
            <p className="font-bold">
              Your last answer changed this estimate by{" "}
              {signedPoints(selected.lastUpdate.delta)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selected.lastUpdate.correct ? "Correct" : "Missed"} ·{" "}
              {selected.lastUpdate.difficulty} question · the skill estimate was
              updated
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 border-y py-4 text-sm text-muted-foreground">
          You have not answered a practice or Quick Check question for this
          skill yet. Your first one will make this estimate more personal.
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-heading text-2xl font-bold">
            Why did Scout pick this?
          </h3>
          <span className="font-mono text-[0.62rem] font-bold text-muted-foreground uppercase">
            Plain-English reasons
          </span>
        </div>
        <ol className="mt-4 divide-y border-y">
          {contributions.map((contribution) => (
            <li
              key={contribution.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3"
            >
              <div>
                <p className="text-sm font-bold">
                  {CONTRIBUTION_COPY[contribution.id].label}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {CONTRIBUTION_COPY[contribution.id].explanation}
                </p>
              </div>
              <span className="font-heading text-3xl font-black tabular-nums">
                +{contribution.points}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <details className="mt-6 border-t-2 border-foreground pt-4 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-bold text-foreground">
          Technical details for judges
        </summary>
        <p className="mt-3 leading-6">
          Scout uses Bayesian Knowledge Tracing. Guess, slip, and learning rates
          update the skill after every scored answer.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            ["Lucky guess", selected.parameters.guess],
            ["Careless miss", selected.parameters.slip],
            ["Learning step", selected.parameters.transition],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <p className="ink-label text-muted-foreground">{label}</p>
              <p className="mt-1 font-heading text-2xl font-black tabular-nums">
                {percent(Number(value))}
              </p>
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}

function ForecastLab({
  forecast,
  skillCount,
}: {
  forecast: ReadonlyArray<LearningTwinForecast>
  skillCount: number
}) {
  const [selectedSessions, setSelectedSessions] = useState(0)
  const selected =
    forecast.find((item) => item.additionalSessions === selectedSessions) ??
    forecast[0]
  if (!selected) return null

  return (
    <section
      className="mt-12 border-y-2 border-foreground py-8"
      aria-labelledby="forecast-title"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)] lg:items-end">
        <div>
          <p className="ink-label text-primary">Practice preview</p>
          <h2
            id="forecast-title"
            className="mt-2 max-w-3xl font-heading text-4xl leading-[0.98] font-black sm:text-5xl"
          >
            What could more practice change?
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Pick a number of future practice rounds to see how your skill
            estimates could improve. This is only a preview, not an ACT score
            promise.
          </p>
          <div
            className="mt-6 flex flex-wrap gap-2"
            role="group"
            aria-label="Future practice rounds"
          >
            {forecast.map((item) => (
              <Button
                key={item.additionalSessions}
                type="button"
                variant={
                  item.additionalSessions === selectedSessions
                    ? "secondary"
                    : "outline"
                }
                size="lg"
                onClick={() => setSelectedSessions(item.additionalSessions)}
                aria-pressed={item.additionalSessions === selectedSessions}
              >
                {item.additionalSessions === 0
                  ? "Today"
                  : `+${item.additionalSessions} practice rounds`}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-l-4 border-[var(--scout-sun)] bg-[var(--coach-surface)] p-5 shadow-[4px_4px_0_var(--coach-shadow)]">
          <div>
            <p className="ink-label text-muted-foreground">
              Average chance on the next question
            </p>
            <p className="mt-2 font-heading text-5xl leading-none font-black tabular-nums">
              {percent(selected.averageReadiness)}
            </p>
          </div>
          <div>
            <p className="ink-label text-muted-foreground">Strong skills</p>
            <p className="mt-2 font-heading text-5xl leading-none font-black tabular-nums">
              {selected.projectedSecureSkills}/{skillCount}
            </p>
          </div>
          <div className="col-span-2 border-t border-foreground/20 pt-4">
            <p className="text-sm font-semibold">
              More answers still needed: {percent(selected.averageUncertainty)}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Your real results will depend on how you answer. This is a
              preview, not a promise.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function EvidenceLedger({
  learning,
  onOpenLesson,
}: {
  learning: LearningSessionPayload
  onOpenLesson: () => void
}) {
  const twin = learning.learningTwin
  const decisions = learning.decisionHistory
  const skillLabel = (slug: string) =>
    twin.skills.find((skill) => skill.skill === slug)?.label ?? slug
  return (
    <section className="mt-12" aria-labelledby="ledger-title">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground pb-4">
        <div>
          <p className="ink-label text-primary">What changed your plan</p>
          <h2
            id="ledger-title"
            className="mt-2 font-heading text-4xl font-black"
          >
            Evidence Timeline
          </h2>
        </div>
        <div className="flex gap-5 text-right">
          <div>
            <p className="ink-label text-muted-foreground">Diagnostic</p>
            <p className="font-heading text-2xl font-black tabular-nums">
              {twin.evidence.diagnostic}
            </p>
          </div>
          <div>
            <p className="ink-label text-muted-foreground">Practice</p>
            <p className="font-heading text-2xl font-black tabular-nums">
              {twin.evidence.practice}
            </p>
          </div>
          <div>
            <p className="ink-label text-muted-foreground">Quick Check</p>
            <p className="font-heading text-2xl font-black tabular-nums">
              {twin.evidence.calibration}
            </p>
          </div>
        </div>
      </div>

      {decisions.length ? (
        <ol className="divide-y border-b">
          {decisions.slice(0, 10).map((event) => (
            <li
              key={event.id}
              className="grid gap-4 py-5 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-start"
            >
              <time className="font-mono text-xs font-black text-muted-foreground uppercase">
                {new Date(event.occurredAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
              <div>
                <p className="text-sm font-bold">
                  {event.planChanged ? "Plan updated" : "Plan held"} ·{" "}
                  {event.skillLabel}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {event.answerSummary} · {event.informationLabel} information ·{" "}
                  skill estimate {percent(event.learnedBefore)} →{" "}
                  {percent(event.learnedAfter)} · confidence{" "}
                  {event.confidenceBefore} → {event.confidenceAfter}
                </p>
                <p className="mt-2 text-sm leading-6">{event.why}</p>
                {event.misconception ? (
                  <p className="mt-2 border-l-2 border-[var(--scout-coral)] pl-3 text-xs text-muted-foreground">
                    Misconception found: {event.misconception}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <span className="block font-mono text-[0.6rem] font-black text-muted-foreground uppercase">
                  {event.modelVersion}
                </span>
                <span className="mt-1 block text-xs font-bold">
                  {skillLabel(event.planBefore)} → {skillLabel(event.planAfter)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-6 max-w-3xl">
          <ScoutCoach
            mood="thinking"
            message="Scout needs one practice answer before it can update this skill."
            detail="Your diagnostic or submitted score gives Scout a rough starting point. Practice answers make it more accurate."
          />
          <Button
            type="button"
            size="xl"
            className="mt-6"
            onClick={onOpenLesson}
          >
            <GaugeIcon data-icon="inline-start" />
            Answer a practice question
          </Button>
        </div>
      )}
    </section>
  )
}

function CoachBriefPanel({ learning }: { learning: LearningSessionPayload }) {
  const brief = learning.coachBrief
  const copy = [
    `Strongest skill: ${brief.strongestSkill}`,
    `Priority misconception: ${brief.priorityMisconception}`,
    `Confidence: ${brief.confidenceLevel}`,
    `Evidence: ${brief.evidenceCollected}`,
    `Current mission: ${brief.currentMission}`,
    `Next mission: ${brief.nextMission}`,
    `Suggested intervention: ${brief.offlineIntervention}`,
    `Still unknown: ${brief.unknowns}`,
  ].join("\n")
  return (
    <section className="coach-brief mt-12 border-2 border-foreground bg-background p-5 shadow-[6px_6px_0_var(--foreground)] sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b-2 border-foreground pb-5">
        <div>
          <p className="ink-label text-primary">
            Share with a teacher or parent
          </p>
          <h2 className="mt-2 font-heading text-4xl font-black">Coach Brief</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            One useful page. No giant analytics dashboard.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={() => void navigator.clipboard?.writeText(copy)}
          >
            <CopyIcon /> Copy
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <PrinterIcon /> Print
          </Button>
        </div>
      </div>
      <dl className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {[
          ["Strongest demonstrated skill", brief.strongestSkill],
          ["Highest-priority misconception", brief.priorityMisconception],
          ["Confidence level", brief.confidenceLevel],
          ["Evidence collected", brief.evidenceCollected],
          [
            "Current and next missions",
            `${brief.currentMission} → ${brief.nextMission}`,
          ],
          ["Suggested offline intervention", brief.offlineIntervention],
          ["What Scout still does not know", brief.unknowns],
        ].map(([label, value]) => (
          <div key={label} className="border-t-2 border-foreground pt-3">
            <dt className="ink-label text-muted-foreground">{label}</dt>
            <dd className="mt-2 text-sm leading-6 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function LearningTwinLab({
  plan,
  learning,
  onOpenLesson,
}: LearningTwinLabProps) {
  const recommendation = learning?.learningTwin?.recommendation
  const skills = learning?.learningTwin?.skills
  const [selectedSkill, setSelectedSkill] = useState<string | null>(
    recommendation?.skill ?? null
  )

  if (
    !learning ||
    !learning.learningTwin ||
    !recommendation ||
    !skills?.length
  ) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8">
        <ScoutCoach
          mood="thinking"
          message="Scout is turning your scores into a simple skill map."
        />
      </main>
    )
  }

  const effectiveSelectedSkill =
    selectedSkill && skills.some((skill) => skill.skill === selectedSkill)
      ? selectedSkill
      : recommendation.skill
  const selected =
    skills.find((skill) => skill.skill === effectiveSelectedSkill) ?? skills[0]

  return (
    <main className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-7 lg:py-10">
      <section className="grid gap-8 border-b-2 border-foreground pb-9 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-end">
        <div>
          <div className="flex items-center gap-3">
            <BrainCircuitIcon
              className="size-6 text-primary"
              aria-hidden="true"
            />
            <p className="ink-label text-primary">Your skill map</p>
          </div>
          <h1 className="mt-4 max-w-5xl font-heading text-5xl leading-[0.92] font-black tracking-[-0.035em] sm:text-7xl">
            Work on {recommendation.label} next.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Scout picked this because it looks like one of your weaker skills
            and still needs more practice. Only your scored answers can change
            this choice.
          </p>
        </div>
        <aside className="border-l-4 border-[var(--scout-coral)] bg-background px-5 py-5 shadow-[5px_5px_0_rgb(20_35_58_/_0.12)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="ink-label text-muted-foreground">
                How Scout decided
              </p>
              <p className="mt-2 font-heading text-3xl font-black">
                How soon to practice it
              </p>
            </div>
            <p className="font-heading text-6xl leading-none font-black text-[var(--scout-coral)] tabular-nums">
              {recommendation.priorityScore}
            </p>
          </div>
          <p className="mt-4 border-t pt-4 text-sm leading-6 text-muted-foreground">
            A higher number means Scout thinks this skill should come sooner.
            Your answers—not the lesson-writing AI—control this score.
          </p>
        </aside>
      </section>

      <PlanChangePanel learning={learning} />
      <InteractiveSkillMap
        skills={skills}
        learning={learning}
        selectedSkill={selected.skill}
        onSelect={setSelectedSkill}
      />
      <div className="mt-8">
        <ContributionInspector learning={learning} selected={selected} />
      </div>

      <ForecastLab
        forecast={learning.learningTwin.forecast}
        skillCount={skills.length}
      />
      <EvidenceLedger learning={learning} onOpenLesson={onOpenLesson} />
      <CoachBriefPanel learning={learning} />

      <section className="mt-12 grid gap-5 border-t-2 border-foreground pt-7 md:grid-cols-4">
        {[
          {
            icon: DatabaseZapIcon,
            title: "Your answer",
            text: "Scout checks it against the real answer key.",
          },
          {
            icon: ActivityIcon,
            title: "Skill update",
            text: "The estimate goes up or down based on that answer.",
          },
          {
            icon: RouteIcon,
            title: "Next lesson",
            text: "Scout chooses the skill that needs the most attention.",
          },
          {
            icon: FlaskConicalIcon,
            title: "Personalized lesson",
            text: "AI explains that skill using your level and study plan.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="border-t pt-4">
            <Icon className="size-5 text-primary" aria-hidden="true" />
            <h3 className="mt-3 font-heading text-xl font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {text}
            </p>
          </div>
        ))}
      </section>

      <Alert className="mt-10 bg-[var(--info-surface)]">
        <ShieldCheckIcon />
        <AlertTitle>You can check Scout&apos;s work</AlertTitle>
        <AlertDescription>
          These percentages guide practice; they are not official ACT scores.
          You are working from {plan.currentComposite} toward {plan.draft.goal},
          and every recommendation can change as you answer more questions.
        </AlertDescription>
      </Alert>
    </main>
  )
}
