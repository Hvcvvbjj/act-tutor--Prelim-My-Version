"use client"

import type {
  KnowledgeState,
  LearningSessionPayload,
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
  SparklesIcon,
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
    icon: BookOpenCheckIcon,
  },
  practice: {
    icon: ListChecksIcon,
  },
  repair: {
    icon: RotateCcwIcon,
  },
  checkpoint: {
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

function getMissionCopy(learning: LearningSessionPayload) {
  switch (learning.mode) {
    case "repair":
      return {
        label: "Today’s assignment · Retry",
        title: `Retry: ${learning.mastery.label}`,
        description:
          "Answer one question you previously missed. The answer updates this skill and, if correct, marks that saved mistake resolved.",
      }
    case "checkpoint":
      return {
        label: "Today’s assignment · Quick quiz",
        title: "3-question mixed quiz",
        description:
          "Answer one question from each of three currently prioritized skills. Each answer updates only the skill it tests.",
      }
    case "retention":
      return {
        label: "Today’s assignment · Memory check",
        title: `Review ${learning.mastery.label}`,
        description:
          "Answer two questions for this skill. Both answers update its estimate and set its next stored review date.",
      }
    case "challenge":
      return {
        label: "Today’s assignment · Challenge",
        title: `Harder ${learning.mastery.label} questions`,
        description:
          "Answer three hard questions for this skill. The results update this skill and may move its next review date.",
      }
    case "micro":
      return {
        label: "Today’s assignment · 3 minutes",
        title: `3-minute ${learning.mastery.label} lesson`,
        description:
          "Read the short rule, then answer one scored question. That answer updates this skill like regular practice.",
      }
    case "recovery":
      return {
        label: "Today’s assignment · Restart",
        title: "Start again with two questions",
        description:
          "Answer two questions from the skills currently ranked highest. This records normal practice; it does not erase missed assignments.",
      }
    default:
      return {
        label: "Today’s assignment",
        title: learning.lesson.title,
        description: `Read one rule and one worked example, then answer ${learning.questions.length} scored questions. Those answers update ${learning.mastery.label} only.`,
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

  const current = learning.mission.steps.find(
    (step) => step.state === "current"
  )
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
        {current.id === "learn" ? "Start lesson" : "Continue practice"}
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
      aria-label="Today’s assignment steps"
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
                  {index + 1}. {step.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {step.id === "learn"
                    ? step.state === "done"
                      ? "Opened"
                      : step.state === "current"
                        ? "Open this first"
                        : "Not started"
                    : `${step.progress} of ${step.total} answered${step.state === "done" ? " · complete" : ""}`}
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
              Two-question memory check · due{" "}
              {formatCalendarDate(review.dueAt.slice(0, 10))}
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
  const ready = props.learning.status === "complete" && !props.busy
  return (
    <details className="group border-t">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        Choose another study option
        <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
      </summary>
      <div className="pb-5">
        <p className="text-sm leading-6 text-muted-foreground">
          After today&apos;s assignment, choose a shorter session, a harder
          challenge, or an easy restart.
        </p>
        <div className="mt-4 grid gap-2">
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            disabled={!ready}
            onClick={() => props.onStartMicro()}
          >
            3-minute lesson
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            disabled={!ready}
            onClick={() => props.onStartChallenge()}
          >
            Harder 3-question challenge
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            disabled={!ready}
            onClick={props.onStartRecovery}
          >
            Easy 2-question restart
          </Button>
        </div>
        {!ready ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Finish today&apos;s assignment to unlock these options.
          </p>
        ) : null}
      </div>
    </details>
  )
}

function WeeklySummary(props: DailyMissionHubProps) {
  const { plan, learning } = props
  const provisional = plan.adaptiveBaselineRequired === true
  const isInternalProxy =
    plan.evidence.source === "rapid_diagnostic" ||
    plan.evidence.source === "starter_diagnostic"
  return (
    <aside className="rounded-xl border bg-background p-5 lg:sticky lg:top-24">
      <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
        Your week
      </p>
      <dl className="mt-4 divide-y">
        <div className="flex items-center gap-4 py-4 first:pt-0">
          <CalendarDaysIcon
            className="size-6 text-primary"
            aria-hidden="true"
          />
          <div>
            <dt className="font-bold">
              {plan.intensity.studyDaysPerWeek} study days
            </dt>
            <dd className="text-sm text-muted-foreground">
              Exact weekdays are editable in My week
            </dd>
          </div>
        </div>
        <div className="flex items-center gap-4 py-4">
          <Clock3Icon className="size-6 text-primary" aria-hidden="true" />
          <div>
            <dt className="font-bold">
              {plan.intensity.minutesPerSession} min each
            </dt>
            <dd className="text-sm text-muted-foreground">Per study day</dd>
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
          Your ACT goal
        </p>
        {provisional ? (
          <div className="mt-4">
            <p className="text-3xl font-black text-primary tabular-nums">
              Goal {plan.draft.goal}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Finish the starting check to set your baseline.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-black tabular-nums">
                {plan.currentComposite}
              </p>
              <p className="text-sm text-muted-foreground">
                {isInternalProxy
                  ? "Internal planning proxy · not an ACT score"
                  : "Reported planning baseline"}
              </p>
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
          What happens after this?
          <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
        </summary>
        <p className="pb-5 text-sm leading-6 text-muted-foreground">
          Each scored answer updates only its tested skill. Scout then reranks
          all 12 skills with four fixed factors: predicted chance on a medium
          item, estimate entropy, answer count, and a recent miss. The highest
          total becomes the next recommended skill; this does not recalculate an
          ACT score.
        </p>
      </details>
      <PaceControls {...props} />
    </aside>
  )
}

function SkillRow({
  skill,
  props,
}: {
  skill: KnowledgeState
  props: DailyMissionHubProps
}) {
  const percent = Math.round(skill.learnedProbability * 100)
  const current = props.learning.todaySkill === skill.skill
  return (
    <button
      type="button"
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_3rem] items-center gap-4 border-b py-3 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed",
        current && "bg-secondary"
      )}
      onClick={() => props.onStartSkill(skill.skill)}
      disabled={props.busy || props.learning.status !== "complete" || current}
    >
      <span className="min-w-0 px-2">
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-semibold">{skill.label}</span>
          <span className="text-[0.65rem] font-bold text-muted-foreground uppercase">
            {skill.evidenceCount === 0
              ? "Starting estimate"
              : `${skill.evidenceCount} scored ${skill.evidenceCount === 1 ? "answer" : "answers"}`}
          </span>
        </span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${percent}%`,
              background: SECTION_COLOR[skill.section],
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
          Other study tools
          <span className="mt-1 block text-sm font-normal text-muted-foreground">
            Review past work or choose a different skill after today&apos;s
            assignment.
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
                <li key={review.skill} className="flex items-center gap-4 py-4">
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
                    disabled={
                      props.busy || props.learning.status !== "complete"
                    }
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
                    {mistake.skillLabel} ·{" "}
                    {mistake.resolvedAt ? "Fixed" : "Try again"}
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
                      disabled={
                        props.busy || props.learning.status !== "complete"
                      }
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

      <section
        className="border-t px-5 py-7 sm:px-6"
        aria-labelledby="skills-title"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="skills-title" className="text-xl font-bold">
            All 12 skills
          </h2>
          <p className="text-sm text-muted-foreground">
            Finish today&apos;s assignment before switching skills.
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
              {props.learning.learningTwin.skills
                .filter((skill) => skill.section === section)
                .map((skill) => (
                  <SkillRow key={skill.skill} skill={skill} props={props} />
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
  const currentSkill =
    learning.learningTwin.skills.find(
      (skill) => skill.skill === learning.todaySkill
    ) ?? learning.learningTwin.skills[0]
  const currentRecommendation = learning.learningTwin.recommendation
  if (!currentSkill) return null
  const assignmentIsCurrentRecommendation =
    currentRecommendation.skill === learning.todaySkill
  const topFactors = [...currentRecommendation.contributions]
    .filter((factor) => factor.points > 0)
    .sort((left, right) => right.points - left.points)
    .slice(0, 2)
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
              Usual study block: {plan.intensity.minutesPerSession} min
            </span>
            <span className="inline-flex items-center gap-2">
              <CalendarDaysIcon className="size-4" aria-hidden="true" />
              {plan.intensity.daysUntilTest} days to ACT
            </span>
          </div>

          <div className="mt-6">
            <MissionAction {...props} />
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {learning.status === "complete"
                ? `Done. Scout reranked all 12 skills; ${currentRecommendation.label} now has the highest practice-priority total. The dated calendar did not change.`
                : `Finish the steps below. Each scored answer updates ${learning.mastery.label}; after the set, Scout reranks all 12 skills.`}
            </p>
          </div>

          {learning.status !== "complete" ? (
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-primary/25 bg-[var(--info-surface)] p-4">
              <ScoutMark className="mt-0.5 size-9 shrink-0" />
              <div>
                <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
                  Why this is next
                </p>
                <p className="mt-1 text-sm leading-6">
                  {assignmentIsCurrentRecommendation
                    ? `${currentSkill.label} currently has a ${Math.round(currentSkill.learnedProbability * 100)}% BKT estimate from ${currentSkill.evidenceCount} scored ${currentSkill.evidenceCount === 1 ? "answer" : "answers"}. Its priority total is ${currentRecommendation.priorityScore}/100. The largest factors are ${topFactors.map((factor) => `${factor.label.toLowerCase()} (+${factor.points})`).join(" and ") || "the fixed ranking rules"}. Your ACT goal is not part of this ranking.`
                    : `This assignment is already in progress, so Scout will not replace it. The current ranking now places ${currentRecommendation.label} next with a priority total of ${currentRecommendation.priorityScore}/100.`}
                </p>
              </div>
            </div>
          ) : null}

          <MissionProgress steps={learning.mission.steps} />
          <LaterToday {...props} />
        </section>

        <WeeklySummary {...props} />
      </div>

      <ExpandedStudyDetails {...props} />
    </div>
  )
}
