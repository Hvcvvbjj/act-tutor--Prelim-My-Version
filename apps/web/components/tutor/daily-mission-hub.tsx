"use client"

import { useState } from "react"
import type {
  LearningSessionPayload,
  MasteryState,
  MissionStep,
} from "@act-tutor/core"
import {
  ArrowRightIcon,
  BookOpenCheckIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  Clock3Icon,
  FlameIcon,
  GaugeIcon,
  ListChecksIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Settings2Icon,
  SparklesIcon,
  StarIcon,
  TimerResetIcon,
} from "lucide-react"

import { ScoutMark } from "@/components/tutor/scout"
import type { GeneratedPlan } from "@/components/tutor/types"
import { Button } from "@/components/ui/button"
import { formatCalendarDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

interface DailyMissionHubProps {
  plan: GeneratedPlan
  learning: LearningSessionPayload
  busy: boolean
  onOpenWorkspace: () => void
  onStartNext: () => void
  onStartSkill: (skill: string) => void
  onStartRepair: (mistakeId: string) => void
  onStartCheckpoint: () => void
  onStartRetention: (skill: string) => void
  onStartChallenge: (skill?: string) => void
  onStartMicro: (skill?: string) => void
  onStartRecovery: () => void
}

const STEP_META = {
  learn: {
    label: "Learn",
    short: "See the rule",
    icon: BookOpenCheckIcon,
  },
  practice: {
    label: "Practice",
    short: "Try it yourself",
    icon: ListChecksIcon,
  },
  repair: {
    label: "Fix mistakes",
    short: "Review and improve",
    icon: RotateCcwIcon,
  },
  checkpoint: {
    label: "Quick quiz",
    short: "Lock it in",
    icon: GaugeIcon,
  },
} as const

const SECTION_LABEL = {
  english: "English",
  math: "Math",
  reading: "Reading",
} as const

const SECTION_COLOR = {
  english: "var(--primary)",
  math: "var(--scout-coral)",
  reading: "var(--scout-sun)",
} as const

const SKILL_LEVEL_LABEL = {
  new: "Just starting",
  building: "Learning",
  steady: "Getting there",
  secure: "Strong",
} as const

function getMissionCopy(learning: LearningSessionPayload) {
  switch (learning.mode) {
    case "repair":
      return {
        label: "Retry",
        title: `Retry: ${learning.mastery.label}`,
        description:
          "Try the question again without looking at the explanation.",
      }
    case "checkpoint":
      return {
        label: "Quick quiz",
        title: "Mixed three-question quiz",
        description: "One question from each of three weak skills. No hints.",
      }
    case "retention":
      return {
        label: "Memory check",
        title: `Do you still remember ${learning.mastery.label}?`,
        description:
          "Two questions check whether the skill held up after time away.",
      }
    case "challenge":
      return {
        label: "Mastery challenge",
        title: `Prove you own ${learning.mastery.label}`,
        description:
          "Three harder questions can prove this skill needs less repetition.",
      }
    case "micro":
      return {
        label: "3-minute study",
        title: `One useful step in ${learning.mastery.label}`,
        description:
          "A short lesson and one question keep your plan moving on a busy day.",
      }
    case "recovery":
      return {
        label: "Recovery session",
        title: "Get the plan moving again",
        description:
          "Two priority questions rebuild momentum without adding extra work.",
      }
    default:
      return {
        label: "Today’s mission",
        title: learning.lesson.title,
        description: learning.lesson.concept,
      }
  }
}

function MissionAction(props: DailyMissionHubProps) {
  const { learning } = props
  if (learning.status === "complete") {
    const nextLabel =
      learning.mission.skillMap.find(
        (skill) => skill.skill === learning.nextSkill
      )?.label ?? "next skill"
    return (
      <Button
        type="button"
        size="xl"
        onClick={props.onStartNext}
        disabled={props.busy}
        className="w-full sm:w-auto sm:min-w-72"
      >
        Continue to {nextLabel}
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    )
  }

  const current = learning.mission.steps.find((step) => step.state === "current")
  if (!current) return null
  if (current.id === "learn" || current.id === "practice") {
    return (
      <Button
        type="button"
        size="xl"
        onClick={props.onOpenWorkspace}
        disabled={props.busy}
        className="w-full sm:w-auto sm:min-w-72"
      >
        {current.id === "learn" ? (
          <SparklesIcon data-icon="inline-start" />
        ) : null}
        {current.id === "learn" ? "Start today’s lesson" : "Continue practice"}
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    )
  }
  if (current.id === "repair") {
    const mistake = learning.mission.mistakes.find(
      (item) => item.resolvedAt === null
    )
    return mistake ? (
      <Button
        type="button"
        size="xl"
        onClick={() => props.onStartRepair(mistake.id)}
        disabled={props.busy}
        className="w-full sm:w-auto sm:min-w-72"
      >
        <RefreshCwIcon data-icon="inline-start" />
        Retry one missed question
      </Button>
    ) : null
  }
  return (
    <Button
      type="button"
      size="xl"
      onClick={props.onStartCheckpoint}
      disabled={props.busy}
      className="w-full sm:w-auto sm:min-w-72"
    >
      <TimerResetIcon data-icon="inline-start" />
      Start the quick quiz
    </Button>
  )
}

function MissionProgress({ steps }: { steps: ReadonlyArray<MissionStep> }) {
  return (
    <ol
      className="mt-7 grid gap-3 border-t pt-6 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Daily mission steps"
    >
      {steps.map((step, index) => {
        const meta = STEP_META[step.id]
        const Icon = meta.icon
        return (
          <li
            key={step.id}
            className={cn(
              "relative rounded-lg border p-4",
              step.state === "current" && "border-primary bg-secondary",
              step.state === "done" && "border-primary/40",
              step.state === "queued" && "text-muted-foreground"
            )}
            aria-current={step.state === "current" ? "step" : undefined}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border bg-background",
                  step.state === "current" && "border-primary text-primary",
                  step.state === "done" &&
                    "border-primary bg-primary text-primary-foreground"
                )}
              >
                {step.state === "done" ? (
                  <CheckCircle2Icon className="size-4" />
                ) : (
                  <Icon className="size-4" />
                )}
              </span>
              <div>
                <p className="text-sm font-bold">
                  {index + 1}. {meta.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {step.total > 1 && step.progress > 0
                    ? `${step.progress}/${step.total} · `
                    : ""}
                  {meta.short}
                </p>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function LaterToday(props: DailyMissionHubProps) {
  const review = props.learning.mission.dueReviews[0]
  return (
    <section className="mt-6 border-t pt-5" aria-labelledby="later-title">
      <p
        id="later-title"
        className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
      >
        Later today
      </p>
      {review ? (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg bg-muted px-4 py-3">
          <RefreshCwIcon className="size-5 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Review: {review.label}</p>
            <p className="text-xs text-muted-foreground">
              Two-question memory check · due {formatCalendarDate(review.dueAt.slice(0, 10))}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => props.onStartRetention(review.skill)}
            disabled={props.busy || props.learning.status !== "complete"}
          >
            Review
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No review is due yet. Scout will schedule one after you practice.
        </p>
      )}
    </section>
  )
}

function PaceControls(props: DailyMissionHubProps) {
  const [energy, setEnergy] = useState<"low" | "normal" | "challenge">(
    "normal"
  )
  const ready = props.learning.status === "complete" && !props.busy
  return (
    <details className="group border-t">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <span className="flex items-center gap-3">
          <Settings2Icon className="size-5 text-muted-foreground" />
          Change today&apos;s pace
        </span>
        <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
      </summary>
      <div className="pb-5">
        <p className="text-sm leading-6 text-muted-foreground">
          Pick how today feels. Scout will protect unfinished work.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["low", "Low energy"],
              ["normal", "Normal"],
              ["challenge", "Challenge me"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={energy === value ? "secondary" : "outline"}
              onClick={() => setEnergy(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="mt-4 grid gap-2">
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            disabled={!ready}
            onClick={() => props.onStartMicro()}
          >
            3-minute study
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            disabled={!ready}
            onClick={() => props.onStartChallenge()}
          >
            Mastery challenge
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            disabled={!ready}
            onClick={props.onStartRecovery}
          >
            Recovery session
          </Button>
        </div>
        {!ready ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Finish the current mission before switching formats.
          </p>
        ) : null}
      </div>
    </details>
  )
}

function WeeklySummary(props: DailyMissionHubProps) {
  const { plan, learning } = props
  const provisional = plan.evidence.source === "rapid_diagnostic"
  return (
    <aside className="rounded-xl border bg-background p-5 lg:sticky lg:top-24">
      <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
        This week
      </p>
      <dl className="mt-4 divide-y">
        <div className="flex items-center gap-4 py-4 first:pt-0">
          <CalendarDaysIcon className="size-6 text-primary" aria-hidden="true" />
          <div>
            <dt className="font-bold">
              {plan.intensity.studyDaysPerWeek} study days
            </dt>
            <dd className="text-sm text-muted-foreground">Planned</dd>
          </div>
        </div>
        <div className="flex items-center gap-4 py-4">
          <Clock3Icon className="size-6 text-primary" aria-hidden="true" />
          <div>
            <dt className="font-bold">
              {plan.intensity.minutesPerSession} min each
            </dt>
            <dd className="text-sm text-muted-foreground">Daily target</dd>
          </div>
        </div>
        <div className="flex items-center gap-4 py-4">
          <FlameIcon
            className="size-6 text-[var(--scout-coral)]"
            aria-hidden="true"
          />
          <div>
            <dt className="font-bold">
              {learning.mission.progress.currentStreak} day streak
            </dt>
            <dd className="text-sm text-muted-foreground">Keep it going</dd>
          </div>
        </div>
      </dl>

      <div className="border-t py-5">
        <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
          Your score route
        </p>
        {provisional ? (
          <div className="mt-4">
            <p className="text-3xl font-black text-primary tabular-nums">
              Goal {plan.draft.goal}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Finish the Quick Check for a stronger starting range.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-black tabular-nums">
                {plan.currentComposite}
              </p>
              <p className="text-sm text-muted-foreground">Now</p>
            </div>
            <div className="mb-5 h-px flex-1 border-t border-dashed" />
            <div className="text-right">
              <p className="text-3xl font-black text-primary tabular-nums">
                {plan.draft.goal}
              </p>
              <p className="text-sm text-muted-foreground">Goal</p>
            </div>
          </div>
        )}
      </div>

      <details className="group border-t">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          Why this mission?
          <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
        </summary>
        <p className="pb-5 text-sm leading-6 text-muted-foreground">
          {learning.lesson.whyAssigned}
        </p>
      </details>
      <PaceControls {...props} />
    </aside>
  )
}

function SkillRow({
  mastery,
  props,
}: {
  mastery: MasteryState
  props: DailyMissionHubProps
}) {
  const percent = Math.round(mastery.mastery * 100)
  const current = props.learning.todaySkill === mastery.skill
  return (
    <button
      type="button"
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_3rem] items-center gap-4 border-b py-3 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed",
        current && "bg-secondary"
      )}
      onClick={() => props.onStartSkill(mastery.skill)}
      disabled={props.busy || props.learning.status !== "complete" || current}
    >
      <span className="min-w-0 px-2">
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-semibold">{mastery.label}</span>
          <span className="text-[0.65rem] font-bold text-muted-foreground uppercase">
            {SKILL_LEVEL_LABEL[mastery.band]}
          </span>
        </span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${percent}%`,
              background: SECTION_COLOR[mastery.section],
            }}
          />
        </span>
      </span>
      <span className="text-xl font-black tabular-nums">{percent}</span>
    </button>
  )
}

function ExpandedStudyDetails(props: DailyMissionHubProps) {
  const reviews = props.learning.mission.dueReviews.slice(0, 4)
  const mistakes = props.learning.mission.mistakes.slice(0, 5)
  return (
    <details className="group rounded-xl border bg-background">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-6">
        <span>
          Reviews, saved mistakes, and all skills
          <span className="mt-1 block text-sm font-normal text-muted-foreground">
            Open the detailed study tools only when you need them.
          </span>
        </span>
        <ChevronRightIcon className="size-5 transition-transform group-open:rotate-90" />
      </summary>
      <div className="grid gap-10 border-t px-5 py-7 sm:px-6 xl:grid-cols-2">
        <section aria-labelledby="reviews-title">
          <h2 id="reviews-title" className="text-xl font-bold">
            Due for review
          </h2>
          {reviews.length ? (
            <ol className="mt-4 divide-y border-y">
              {reviews.map((review) => (
                <li
                  key={review.skill}
                  className="flex items-center gap-4 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{review.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {review.explanation}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => props.onStartRetention(review.skill)}
                    disabled={props.busy || props.learning.status !== "complete"}
                  >
                    Review
                  </Button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Nothing is overdue.
            </p>
          )}
        </section>

        <section aria-labelledby="mistakes-title">
          <h2 id="mistakes-title" className="text-xl font-bold">
            Saved mistakes
          </h2>
          {mistakes.length ? (
            <div className="mt-4 divide-y border-y">
              {mistakes.map((mistake) => (
                <details key={mistake.id} className="py-4">
                  <summary className="cursor-pointer list-none font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    {mistake.skillLabel} · {mistake.resolvedAt ? "Fixed" : "Try again"}
                  </summary>
                  <p className="mt-3 text-sm leading-6">{mistake.prompt}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {mistake.rationale}
                  </p>
                  {!mistake.resolvedAt ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => props.onStartRepair(mistake.id)}
                      disabled={props.busy || props.learning.status !== "complete"}
                    >
                      Try again
                    </Button>
                  ) : null}
                </details>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No mistakes saved yet.
            </p>
          )}
        </section>
      </div>

      <section className="border-t px-5 py-7 sm:px-6" aria-labelledby="skills-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="skills-title" className="text-xl font-bold">
            All 12 skills
          </h2>
          <p className="text-sm text-muted-foreground">
            Finish today&apos;s work before switching skills.
          </p>
        </div>
        <div className="mt-5 grid gap-7 lg:grid-cols-3">
          {(["english", "math", "reading"] as const).map((section) => (
            <div key={section}>
              <h3 className="flex items-center gap-2 border-b pb-3 font-bold">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: SECTION_COLOR[section] }}
                  aria-hidden="true"
                />
                {SECTION_LABEL[section]}
              </h3>
              {props.learning.mission.skillMap
                .filter((mastery) => mastery.section === section)
                .map((mastery) => (
                  <SkillRow
                    key={mastery.skill}
                    mastery={mastery}
                    props={props}
                  />
                ))}
            </div>
          ))}
        </div>
      </section>
    </details>
  )
}

export function DailyMissionHub(props: DailyMissionHubProps) {
  const { learning, plan } = props
  const missionCopy = getMissionCopy(learning)
  return (
    <div className="space-y-6 pb-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="min-w-0 rounded-xl border bg-background p-5 sm:p-7 lg:p-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-xs font-bold tracking-[0.12em] text-primary uppercase">
              {missionCopy.label}
            </p>
            <span className="text-sm font-semibold text-muted-foreground">
              {SECTION_LABEL[learning.mastery.section]}
            </span>
          </div>

          <h1 className="mt-4 max-w-3xl font-heading text-4xl leading-[1.02] font-black tracking-[-0.025em] sm:text-5xl">
            {missionCopy.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            {missionCopy.description}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Clock3Icon className="size-4" aria-hidden="true" />
              {plan.intensity.minutesPerSession} min
            </span>
            <span className="inline-flex items-center gap-2">
              <CalendarDaysIcon className="size-4" aria-hidden="true" />
              {plan.intensity.daysUntilTest} days to ACT
            </span>
          </div>

          <div className="mt-6">
            <MissionAction {...props} />
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-lg border border-primary/25 bg-[var(--info-surface)] p-4">
            <ScoutMark className="mt-0.5 size-9 shrink-0" />
            <p className="text-sm leading-6">
              {learning.status === "complete"
                ? "Your answers changed what Scout recommends next."
                : learning.lesson.tutorOpening}
            </p>
          </div>

          <MissionProgress steps={learning.mission.steps} />
          <LaterToday {...props} />

          {learning.status === "complete" ? (
            <div className="mt-5 flex items-center gap-3 rounded-lg bg-[var(--coach-surface)] px-4 py-3">
              <StarIcon className="size-5 text-[var(--scout-coral)]" />
              <p className="text-sm font-semibold">
                Plan updated from your latest answers.
              </p>
            </div>
          ) : null}
        </section>

        <WeeklySummary {...props} />
      </div>

      <ExpandedStudyDetails {...props} />
    </div>
  )
}
