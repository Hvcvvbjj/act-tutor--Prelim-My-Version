"use client"

import { useState } from "react"
import type {
  KnowledgeState,
  LearningSessionPayload,
  LearningTwinForecast,
} from "@act-tutor/core"
import {
  ActivityIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BrainCircuitIcon,
  CircleDotDashedIcon,
  DatabaseZapIcon,
  FlaskConicalIcon,
  GaugeIcon,
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
  diagnostic: "Direct diagnostic",
  "score-estimate": "Score prior",
  "neutral-prior": "Neutral prior",
} as const

function percent(value: number) {
  return `${Math.round(value * 100)}%`
}

function signedPoints(value: number) {
  const points = Math.round(value * 100)
  return `${points > 0 ? "+" : ""}${points} pts`
}

function confidenceLabel(state: KnowledgeState) {
  if (state.confidence === "stable") return "Stable signal"
  if (state.confidence === "forming") return "Signal forming"
  return "Still exploring"
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

function SkillModelRow({
  state,
  selected,
  recommended,
  onSelect,
}: {
  state: KnowledgeState
  selected: boolean
  recommended: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b px-1 py-4 text-left transition-colors outline-none first:border-t focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "bg-[var(--info-surface)] px-3",
        !selected && "hover:bg-muted/55"
      )}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold">{state.label}</span>
          {recommended ? (
            <span className="font-mono text-[0.58rem] font-bold tracking-[0.1em] text-primary uppercase">
              Next
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {SECTION_LABELS[state.section]} · {state.evidenceCount} evidence ·{" "}
          {confidenceLabel(state)}
        </span>
        <span
          className="mt-3 block h-1.5 overflow-hidden bg-muted"
          aria-hidden="true"
        >
          <span
            className={cn(
              "block h-full transition-[width] duration-500 motion-reduce:transition-none",
              recommended ? "bg-[var(--scout-coral)]" : "bg-primary"
            )}
            style={{ width: percent(state.predictedCorrectProbability) }}
          />
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-right">
          <span className="block font-heading text-3xl leading-none font-black tabular-nums">
            {percent(state.predictedCorrectProbability)}
          </span>
          <span className="mt-1 block text-[0.65rem] text-muted-foreground">
            P(correct)
          </span>
        </span>
        <ArrowRightIcon
          className={cn(
            "size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5",
            selected && "text-primary"
          )}
          aria-hidden="true"
        />
      </span>
    </button>
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
  const contributions = isRecommended
    ? recommendation.contributions
    : [
        {
          id: "knowledge-gap",
          label: "Knowledge gap",
          points: Math.round((1 - selected.predictedCorrectProbability) * 52),
          explanation: "Lower predicted next-answer accuracy raises priority.",
        },
        {
          id: "uncertainty",
          label: "Model uncertainty",
          points: Math.round(selected.uncertainty * 24),
          explanation:
            "Uncertain skills receive probes that teach the model faster.",
        },
        {
          id: "evidence-scarcity",
          label: "Evidence scarcity",
          points: Math.round((1 / (selected.evidenceCount + 1)) * 14),
          explanation:
            "Thin evidence is sampled before the route becomes overconfident.",
        },
        {
          id: "recent-lapse",
          label: "Recent lapse",
          points: selected.lastUpdate && !selected.lastUpdate.correct ? 10 : 0,
          explanation: "A recent miss creates short-term repair pressure.",
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
          <p className="ink-label text-primary">Selected skill model</p>
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
          <p className="ink-label text-muted-foreground">Priority</p>
          <p className="mt-1 font-heading text-5xl leading-none font-black text-[var(--scout-coral)] tabular-nums">
            {total}
          </p>
          <p className="text-xs text-muted-foreground">of 100</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        <ProbabilityMetric
          label="P(Learned)"
          value={selected.learnedProbability}
          detail="The model’s latent estimate that this skill is acquired."
        />
        <ProbabilityMetric
          label="P(Correct next)"
          value={selected.predictedCorrectProbability}
          detail="Expected correctness on a fresh medium-difficulty item."
        />
        <ProbabilityMetric
          label="Uncertainty"
          value={selected.uncertainty}
          detail="Binary entropy: higher values mean Scout needs more evidence."
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
              Latest evidence moved P(Learned){" "}
              {signedPoints(selected.lastUpdate.delta)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selected.lastUpdate.correct ? "Correct" : "Missed"} ·{" "}
              {selected.lastUpdate.difficulty} item · transition applied after
              the evidence update
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 border-y py-4 text-sm text-muted-foreground">
          No direct practice update yet. The first server-scored answer will
          replace part of this prior with observed evidence.
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-heading text-2xl font-bold">
            Why this priority score?
          </h3>
          <span className="font-mono text-[0.62rem] font-bold text-muted-foreground uppercase">
            Interpretable features
          </span>
        </div>
        <ol className="mt-4 divide-y border-y">
          {contributions.map((contribution) => (
            <li
              key={contribution.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3"
            >
              <div>
                <p className="text-sm font-bold">{contribution.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {contribution.explanation}
                </p>
              </div>
              <span className="font-heading text-3xl font-black tabular-nums">
                +{contribution.points}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 border-t-2 border-foreground pt-4 text-center">
        {[
          ["P(Guess)", selected.parameters.guess],
          ["P(Slip)", selected.parameters.slip],
          ["P(Transition)", selected.parameters.transition],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <p className="ink-label text-muted-foreground">{label}</p>
            <p className="mt-1 font-heading text-2xl font-black tabular-nums">
              {percent(Number(value))}
            </p>
          </div>
        ))}
      </div>
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
          <p className="ink-label text-primary">Counterfactual lab</p>
          <h2
            id="forecast-title"
            className="mt-2 max-w-3xl font-heading text-4xl leading-[0.98] font-black sm:text-5xl"
          >
            What if you add more evidence-rich sessions?
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            This projects model readiness—not an ACT score—by applying each
            skill’s learning transition. It makes the planner’s assumption
            inspectable before it changes your route.
          </p>
          <div
            className="mt-6 flex flex-wrap gap-2"
            role="group"
            aria-label="Projected evidence sessions"
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
                {item.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-l-4 border-[var(--scout-sun)] bg-[var(--coach-surface)] p-5 shadow-[4px_4px_0_var(--coach-shadow)]">
          <div>
            <p className="ink-label text-muted-foreground">Avg. readiness</p>
            <p className="mt-2 font-heading text-5xl leading-none font-black tabular-nums">
              {percent(selected.averageReadiness)}
            </p>
          </div>
          <div>
            <p className="ink-label text-muted-foreground">Secure models</p>
            <p className="mt-2 font-heading text-5xl leading-none font-black tabular-nums">
              {selected.projectedSecureSkills}/{skillCount}
            </p>
          </div>
          <div className="col-span-2 border-t border-foreground/20 pt-4">
            <p className="text-sm font-semibold">
              Average uncertainty {percent(selected.averageUncertainty)}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Actual updates still depend on the learner’s answers. This is a
              counterfactual, not a promise.
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
  return (
    <section className="mt-12" aria-labelledby="ledger-title">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground pb-4">
        <div>
          <p className="ink-label text-primary">Audit trail</p>
          <h2
            id="ledger-title"
            className="mt-2 font-heading text-4xl font-black"
          >
            Evidence ledger
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
            <p className="ink-label text-muted-foreground">Calibration</p>
            <p className="font-heading text-2xl font-black tabular-nums">
              {twin.evidence.calibration}
            </p>
          </div>
        </div>
      </div>

      {twin.events.length ? (
        <ol className="divide-y border-b">
          {twin.events.slice(0, 6).map((event) => (
            <li
              key={event.id}
              className="grid gap-3 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center border-2",
                  event.correct
                    ? "border-primary bg-secondary text-primary"
                    : "border-[var(--scout-coral)] bg-[color-mix(in_srgb,var(--scout-coral),transparent_91%)] text-[var(--scout-coral)]"
                )}
              >
                {event.correct ? (
                  <ArrowUpIcon className="size-4" aria-hidden="true" />
                ) : (
                  <ArrowDownIcon className="size-4" aria-hidden="true" />
                )}
              </span>
              <div>
                <p className="text-sm font-bold">{event.skillLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.source === "calibration"
                    ? "IRT calibration"
                    : "Practice"}
                  {" · "}
                  {event.correct ? "Correct" : "Missed"} · {event.difficulty}
                  {" item · "}P(L) {percent(event.learnedBefore)} →{" "}
                  {percent(event.learnedAfter)}
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-muted-foreground uppercase">
                P(C) {percent(event.predictedCorrectAfter)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-6 max-w-3xl">
          <ScoutCoach
            mood="thinking"
            message="The twin has a prior, but no practice update yet. Answer one server-scored question and this ledger will show the probability change."
            detail="Diagnostic evidence seeds individual skills. Submitted scores create a cautious prior until direct skill evidence replaces it."
          />
          <Button
            type="button"
            size="xl"
            className="mt-6"
            onClick={onOpenLesson}
          >
            <GaugeIcon data-icon="inline-start" />
            Run a live model update
          </Button>
        </div>
      )}
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
          message="Scout is assembling the learner model from your trusted score evidence."
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
            <p className="ink-label text-primary">Scout Learning Twin</p>
          </div>
          <h1 className="mt-4 max-w-5xl font-heading text-5xl leading-[0.92] font-black tracking-[-0.035em] sm:text-7xl">
            {recommendation.label} is the next best bet.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            {recommendation.reason} The recommendation updates only from
            server-scored diagnostic, calibration, and practice evidence.
          </p>
        </div>
        <aside className="border-l-4 border-[var(--scout-coral)] bg-background px-5 py-5 shadow-[5px_5px_0_rgb(20_35_58_/_0.12)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="ink-label text-muted-foreground">
                Model in control
              </p>
              <p className="mt-2 font-heading text-3xl font-black">
                {learning.learningTwin.model.shortName} v1
              </p>
            </div>
            <p className="font-heading text-6xl leading-none font-black text-[var(--scout-coral)] tabular-nums">
              {recommendation.priorityScore}
            </p>
          </div>
          <p className="mt-4 border-t pt-4 text-sm leading-6 text-muted-foreground">
            Bayesian Knowledge Tracing estimates latent skill acquisition. The
            LLM writes the lesson around this decision; it does not invent the
            score or answer key.
          </p>
        </aside>
      </section>

      <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.5fr)]">
        <section aria-labelledby="skill-models-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="ink-label text-muted-foreground">
                Twelve live models
              </p>
              <h2
                id="skill-models-title"
                className="mt-2 font-heading text-3xl font-black"
              >
                Skill probability map
              </h2>
            </div>
            <CircleDotDashedIcon className="text-primary" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Select any row to inspect the exact probability, uncertainty, and
            feature contributions behind its route priority.
          </p>
          <div className="mt-5">
            {skills.map((state) => (
              <SkillModelRow
                key={state.skill}
                state={state}
                selected={state.skill === selected.skill}
                recommended={state.skill === recommendation.skill}
                onSelect={() => setSelectedSkill(state.skill)}
              />
            ))}
          </div>
        </section>
        <ContributionInspector learning={learning} selected={selected} />
      </div>

      <ForecastLab
        forecast={learning.learningTwin.forecast}
        skillCount={skills.length}
      />
      <EvidenceLedger learning={learning} onOpenLesson={onOpenLesson} />

      <section className="mt-12 grid gap-5 border-t-2 border-foreground pt-7 md:grid-cols-4">
        {[
          {
            icon: DatabaseZapIcon,
            title: "Trusted input",
            text: "Only server-scored answers become model evidence.",
          },
          {
            icon: ActivityIcon,
            title: "BKT update",
            text: "Guess, slip, and transition update P(Learned).",
          },
          {
            icon: RouteIcon,
            title: "Planner decision",
            text: "Gap, uncertainty, scarcity, and lapse rank the next skill.",
          },
          {
            icon: FlaskConicalIcon,
            title: "AI lesson",
            text: "The lesson composer teaches the selected decision at the right depth.",
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
        <AlertTitle>Transparent by design</AlertTitle>
        <AlertDescription>
          This model estimates practice readiness, not an official ACT score.
          Current route: {plan.currentComposite} → {plan.draft.goal}; every
          recommendation remains inspectable and reversible.
        </AlertDescription>
      </Alert>
    </main>
  )
}
