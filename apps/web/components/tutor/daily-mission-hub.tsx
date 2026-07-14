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
  BrainCircuitIcon,
  CheckCircle2Icon,
  FlameIcon,
  GaugeIcon,
  ListChecksIcon,
  LockKeyholeIcon,
  NotebookPenIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SparklesIcon,
  StarIcon,
  TimerResetIcon,
  TrophyIcon,
} from "lucide-react"

import { ScoutCoach } from "@/components/tutor/scout"
import type { GeneratedPlan } from "@/components/tutor/types"
import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel } from "@/components/ui/progress"
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
    number: "01",
    icon: BookOpenCheckIcon,
    description: "Learn one rule and see it used in a real example.",
  },
  practice: {
    number: "02",
    icon: ListChecksIcon,
    description: "Use the rule on five ACT-style questions.",
  },
  repair: {
    number: "03",
    icon: RotateCcwIcon,
    description: "Retry one question you missed without looking at the answer.",
  },
  checkpoint: {
    number: "04",
    icon: GaugeIcon,
    description: "Answer three mixed questions without hints.",
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
        description: "Try the question again without looking at the explanation.",
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
        description: "Two questions check whether the skill held up after time away.",
      }
    case "challenge":
      return {
        label: "Mastery challenge",
        title: `Prove you own ${learning.mastery.label}`,
        description: "Three harder questions can prove this skill is ready for less repetition.",
      }
    case "micro":
      return {
        label: "3-minute study",
        title: `One useful step in ${learning.mastery.label}`,
        description: "A short lesson and one question keep your plan moving on a busy day.",
      }
    case "recovery":
      return {
        label: "Recovery session",
        title: "Get the plan moving again",
        description: "Two priority questions rebuild momentum without pretending you have extra time.",
      }
    default:
      return {
        label: "Today’s focus",
        title: learning.lesson.title,
        description: learning.lesson.whyAssigned,
      }
  }
}

const STEP_LABEL = {
  learn: "learn",
  practice: "practice",
  repair: "retry",
  checkpoint: "quiz",
} as const

function stepAction(
  step: MissionStep,
  learning: LearningSessionPayload,
  props: DailyMissionHubProps
) {
  if (step.state !== "current") return null
  if (step.id === "learn" || step.id === "practice") {
    return (
      <Button
        type="button"
        size="lg"
        onClick={props.onOpenWorkspace}
        disabled={props.busy}
      >
        {step.id === "learn" ? (
          <SparklesIcon data-icon="inline-start" />
        ) : (
          <ArrowRightIcon data-icon="inline-start" />
        )}
        {step.id === "learn" ? "Start lesson" : "Continue practice"}
      </Button>
    )
  }
  if (step.id === "repair") {
    const mistake = learning.mission.mistakes.find(
      (item) => item.resolvedAt === null
    )
    return mistake ? (
      <Button
        type="button"
        size="lg"
        onClick={() => props.onStartRepair(mistake.id)}
        disabled={props.busy}
      >
        <RefreshCwIcon data-icon="inline-start" />
        Retry a missed question
      </Button>
    ) : null
  }
  return (
    <Button
      type="button"
      size="lg"
      onClick={props.onStartCheckpoint}
      disabled={props.busy}
    >
      <TimerResetIcon data-icon="inline-start" />
      Start mixed quiz
    </Button>
  )
}

function MissionTrail(props: DailyMissionHubProps) {
  return (
    <ol className="mt-8 max-w-3xl" aria-label="Daily mission steps">
      {props.learning.mission.steps.map((step) => {
        const meta = STEP_META[step.id]
        const Icon = meta.icon
        const action = stepAction(step, props.learning, props)
        return (
          <li
            key={step.id}
            className={cn(
              "mission-step relative grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-4 pb-9 last:pb-0",
              step.state === "queued" && "text-muted-foreground"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-13 bottom-0 left-[1.6rem] border-l-2",
                step.state === "done"
                  ? "border-primary"
                  : "border-dashed border-border"
              )}
            />
            <span
              className={cn(
                "relative flex size-13 items-center justify-center border-2 border-foreground bg-background shadow-[3px_3px_0_var(--foreground)]",
                step.state === "done" &&
                  "border-primary bg-primary text-primary-foreground shadow-none",
                step.state === "current" && "bg-[var(--coach-surface)]"
              )}
            >
              {step.state === "done" ? (
                <CheckCircle2Icon />
              ) : step.state === "queued" ? (
                <LockKeyholeIcon />
              ) : (
                <Icon />
              )}
            </span>
            <div className="min-w-0 pt-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="ink-label">
                  {meta.number} · {STEP_LABEL[step.id]}
                </p>
                {step.total > 1 ? (
                  <span className="font-mono text-xs font-bold text-muted-foreground">
                    {step.progress}/{step.total}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-1 font-heading text-2xl leading-tight font-bold tracking-[-0.015em]">
                {step.label}
              </h3>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                {meta.description}
              </p>
              {action ? <div className="mt-4">{action}</div> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function ProgressRail({ learning }: { learning: LearningSessionPayload }) {
  const progress = learning.mission.progress
  const xpPercent = Math.round(
    (progress.xpIntoLevel / progress.xpForNextLevel) * 100
  )
  const accuracy = progress.totalAnswered
    ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
    : null
  return (
    <aside className="min-w-0 xl:pt-4">
      <ScoutCoach
        mood={learning.status === "complete" ? "correct" : "ready"}
        message={
          learning.status === "complete"
            ? "Nice work. Your answers have already changed what Scout recommends next."
            : learning.lesson.tutorOpening
        }
        detail={learning.mission.recommendedReason}
      />

      <section
        className="mt-8 border-y-2 border-foreground py-6"
        aria-labelledby="progress-title"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="ink-label text-muted-foreground">
              Level {progress.level}
            </p>
            <h2
              id="progress-title"
              className="mt-1 font-heading text-3xl font-bold"
            >
              Your progress
            </h2>
          </div>
          <TrophyIcon
            className="size-8 text-[var(--scout-coral)]"
            aria-hidden="true"
          />
        </div>
        <div className="mt-5 flex items-baseline justify-between gap-4">
          <span className="font-heading text-5xl font-black tabular-nums">
            {progress.xp}
          </span>
          <span className="font-mono text-xs font-bold text-muted-foreground">
            TOTAL XP
          </span>
        </div>
        <Progress value={xpPercent} className="mt-3 h-3 bg-muted">
          <ProgressLabel className="sr-only">Level progress</ProgressLabel>
        </Progress>
        <p className="mt-2 text-xs text-muted-foreground">
          {progress.xpIntoLevel} of {progress.xpForNextLevel} XP toward level{" "}
          {progress.level + 1}
        </p>
        <dl className="mt-6 grid grid-cols-3 divide-x border-t pt-5 text-center">
          <div>
            <dt className="ink-label text-muted-foreground">Streak</dt>
            <dd className="mt-2 inline-flex items-center gap-1 font-heading text-2xl font-black">
              <FlameIcon
                className="size-5 text-[var(--scout-coral)]"
                aria-hidden="true"
              />
              {progress.currentStreak}d
            </dd>
          </div>
          <div>
            <dt className="ink-label text-muted-foreground">Accuracy</dt>
            <dd className="mt-2 font-heading text-2xl font-black">
              {accuracy === null ? "—" : `${accuracy}%`}
            </dd>
          </div>
          <div>
            <dt className="ink-label text-muted-foreground">Sets</dt>
            <dd className="mt-2 font-heading text-2xl font-black">
              {progress.completedSets}
            </dd>
          </div>
        </dl>
      </section>
    </aside>
  )
}

function DueReviews(props: DailyMissionHubProps) {
  const reviews = props.learning.mission.dueReviews.slice(0, 4)
  return (
    <section
      className="border-t-2 border-foreground pt-6"
      aria-labelledby="reviews-title"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="ink-label text-primary">Scheduled review</p>
          <h2
            id="reviews-title"
            className="mt-2 font-heading text-4xl font-bold"
          >
            Due for review
          </h2>
        </div>
        <RefreshCwIcon className="text-primary" aria-hidden="true" />
      </div>
      {reviews.length ? (
        <ol className="mt-5 border-t">
          {reviews.map((review) => (
            <li
              key={review.skill}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b py-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">{review.label}</p>
                <p className="mt-1 text-sm text-muted-foreground capitalize">
                  {review.urgency} · {Math.round(review.mastery * 100)}% skill
                  level · {formatCalendarDate(review.dueAt.slice(0, 10))}
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground normal-case">
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
        <div className="mt-5 border-y py-5">
          <p className="font-semibold">Nothing is overdue.</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            After you practice a skill, Scout will bring it back before you
            forget it.
          </p>
        </div>
      )}
    </section>
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
        "group grid w-full grid-cols-[minmax(0,1fr)_3rem] items-center gap-4 border-b py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed",
        current && "bg-secondary"
      )}
      onClick={() => props.onStartSkill(mastery.skill)}
      disabled={props.busy || props.learning.status !== "complete" || current}
    >
      <span className="min-w-0 px-2">
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-semibold">
            {mastery.label}
          </span>
          <span className="font-mono text-[0.65rem] font-bold text-muted-foreground uppercase">
            {SKILL_LEVEL_LABEL[mastery.band]}
          </span>
        </span>
        <span className="mt-2 block h-1.5 overflow-hidden bg-muted">
          <span
            className="block h-full transition-[width] duration-300"
            style={{
              width: `${percent}%`,
              background: SECTION_COLOR[mastery.section],
            }}
          />
        </span>
      </span>
      <span className="font-heading text-2xl font-black tabular-nums">
        {percent}
      </span>
    </button>
  )
}

function SkillMap(props: DailyMissionHubProps) {
  return (
    <section
      className="border-t-2 border-foreground pt-6"
      aria-labelledby="skill-map-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="ink-label text-primary">All 12 skills</p>
          <h2
            id="skill-map-title"
            className="mt-2 font-heading text-4xl font-bold"
          >
            Skill map
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          Finish today&apos;s work, then choose any skill. Weak skills and
          recent misses move higher on the list.
        </p>
      </div>
      <div className="mt-6 grid gap-x-8 gap-y-7 lg:grid-cols-3">
        {(["english", "math", "reading"] as const).map((section) => (
          <div key={section}>
            <h3 className="flex items-center gap-2 border-b-2 border-foreground pb-3 font-heading text-2xl font-bold">
              <span
                className="size-3"
                style={{ background: SECTION_COLOR[section] }}
                aria-hidden="true"
              />
              {SECTION_LABEL[section]}
            </h3>
            {props.learning.mission.skillMap
              .filter((mastery) => mastery.section === section)
              .map((mastery) => (
                <SkillRow key={mastery.skill} mastery={mastery} props={props} />
              ))}
          </div>
        ))}
      </div>
    </section>
  )
}

function MistakeNotebook(props: DailyMissionHubProps) {
  const mistakes = props.learning.mission.mistakes.slice(0, 5)
  return (
    <section
      className="border-t-2 border-foreground pt-6"
      aria-labelledby="mistakes-title"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="ink-label text-[var(--scout-coral)]">
            Nothing gets thrown away
          </p>
          <h2
            id="mistakes-title"
            className="mt-2 font-heading text-4xl font-bold"
          >
            Mistake notebook
          </h2>
        </div>
        <NotebookPenIcon
          className="text-[var(--scout-coral)]"
          aria-hidden="true"
        />
      </div>
      {mistakes.length ? (
        <div className="mt-5 border-t">
          {mistakes.map((mistake) => (
            <details key={mistake.id} className="group border-b py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{mistake.skillLabel}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {mistake.resolvedAt
                      ? "Fixed"
                      : `Try again · ${mistake.attempts} attempt${mistake.attempts === 1 ? "" : "s"}`}
                  </p>
                </div>
                {mistake.resolvedAt ? (
                  <CheckCircle2Icon className="text-primary" />
                ) : (
                  <RotateCcwIcon className="text-[var(--scout-coral)]" />
                )}
              </summary>
              <div className="mt-5 grid gap-5 border-l-4 border-[var(--scout-coral)] pl-5 text-sm leading-6 sm:grid-cols-2">
                <div>
                  <p className="ink-label text-muted-foreground">Question</p>
                  <p className="mt-2">{mistake.prompt}</p>
                  <p className="mt-3">
                    <strong>Your choice:</strong> {mistake.selectedChoiceText}
                  </p>
                  <p className="mt-1">
                    <strong>Reviewed answer:</strong>{" "}
                    {mistake.correctChoiceText}
                  </p>
                </div>
                <div>
                  <p className="ink-label text-muted-foreground">
                    Why this answer works
                  </p>
                  <p className="mt-2">{mistake.rationale}</p>
                  {mistake.misconception ? (
                    <p className="mt-3 border-l-2 border-[var(--scout-coral)] pl-3">
                      <strong>Misconception:</strong> {mistake.misconception}
                    </p>
                  ) : null}
                  {!mistake.resolvedAt ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4"
                      onClick={() => props.onStartRepair(mistake.id)}
                      disabled={
                        props.busy || props.learning.status !== "complete"
                      }
                    >
                      Try again without notes
                    </Button>
                  ) : null}
                </div>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="mt-5 border-y py-5">
          <p className="font-semibold">Your notebook is clean—for now.</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            When you miss a question, Scout saves it so you can try it again
            later.
          </p>
        </div>
      )}
    </section>
  )
}

function StudyModeControls(props: DailyMissionHubProps) {
  const [energy, setEnergy] = useState<"low" | "normal" | "challenge">(
    "normal"
  )
  const ready = props.learning.status === "complete" && !props.busy
  return (
    <section className="grid border-y-2 border-foreground lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:divide-x-2 lg:divide-foreground">
      <div className="py-6 lg:pr-7">
        <p className="ink-label text-primary">Session preference</p>
        <h2 className="mt-2 font-heading text-3xl font-black">
          Keep the plan honest.
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This choice only changes the suggestion on the right. Your mission changes after you select a study option, and unfinished work stays protected.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
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
      </div>
      <div className="py-6 lg:pl-7">
        <p className="ink-label text-muted-foreground">Choose a safe shortcut</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-20 flex-col items-start"
            disabled={!ready}
            onClick={() => props.onStartMicro()}
          >
            <span>3-minute study</span>
            <span className="text-xs font-normal">One rule + one question</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-20 flex-col items-start"
            disabled={!ready}
            onClick={() => props.onStartChallenge()}
          >
            <span>Mastery challenge</span>
            <span className="text-xs font-normal">Prove it and skip repetition</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-20 flex-col items-start"
            disabled={!ready}
            onClick={props.onStartRecovery}
          >
            <span>Recovery session</span>
            <span className="text-xs font-normal">Two priority questions</span>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Suggested now: {energy === "low" ? "3-minute study" : energy === "challenge" ? "mastery challenge" : "the regular mission"}. Nothing has changed yet.
        </p>
      </div>
    </section>
  )
}

export function DailyMissionHub(props: DailyMissionHubProps) {
  const { learning, plan } = props
  const complete = learning.status === "complete"
  const missionCopy = getMissionCopy(learning)
  return (
    <div className="space-y-14 pb-8">
      <StudyModeControls {...props} />
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.65fr)] xl:gap-16">
        <section className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <p className="ink-label text-primary">Today’s mission</p>
            <span className="font-mono text-xs font-bold text-muted-foreground">
              {plan.intensity.daysUntilTest} days to test day
            </span>
            <span className="font-mono text-xs font-bold text-muted-foreground capitalize">
              {missionCopy.label}
            </span>
            <span className="bg-foreground px-2 py-1 font-mono text-[0.6rem] font-black tracking-wide text-background uppercase">
              {learning.missionPurpose.replaceAll("-", " ")}
            </span>
          </div>
          <h1 className="mt-4 max-w-5xl font-heading text-5xl leading-[0.92] font-black tracking-[-0.04em] sm:text-7xl lg:text-8xl">
            {missionCopy.title}
          </h1>
          <p className="marker-underline mt-6 max-w-3xl text-lg leading-8 font-semibold sm:text-xl">
            {missionCopy.description}
          </p>
          <MissionTrail {...props} />
          {complete ? (
            <div className="mt-9 flex flex-wrap items-center gap-4 border-y-2 border-foreground bg-[var(--coach-surface)] px-5 py-5">
              <StarIcon
                className="text-[var(--scout-coral)]"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="font-heading text-2xl font-bold">
                  Your plan just updated.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Scout used your answers to choose what you should study next.
                </p>
              </div>
              <Button
                type="button"
                onClick={props.onStartNext}
                disabled={props.busy}
              >
                Continue:{" "}
                {learning.mission.skillMap.find(
                  (skill) => skill.skill === learning.nextSkill
                )?.label ?? "next skill"}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </div>
          ) : null}
        </section>
        <ProgressRail learning={learning} />
      </div>

      <div className="grid gap-12 xl:grid-cols-2 xl:gap-16">
        <DueReviews {...props} />
        <MistakeNotebook {...props} />
      </div>
      <SkillMap {...props} />

      <section className="flex flex-wrap items-center justify-between gap-5 border-y-2 border-foreground py-5">
        <div className="flex items-center gap-3">
          <BrainCircuitIcon className="text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold">Your answers control the plan</p>
            <p className="text-sm text-muted-foreground">
              AI can explain a lesson, but only scored answers change your
              progress, reviews, and next skill.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 font-mono text-xs font-bold text-muted-foreground">
          <TrophyIcon className="size-4" /> Longest streak{" "}
          {learning.mission.progress.longestStreak}{" "}
          {learning.mission.progress.longestStreak === 1 ? "day" : "days"}
        </span>
      </section>
    </div>
  )
}
