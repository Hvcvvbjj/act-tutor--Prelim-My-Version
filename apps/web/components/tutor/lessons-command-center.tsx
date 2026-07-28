"use client"

import type { LearningSessionPayload } from "@act-tutor/core"
import {
  ArrowRightIcon,
  BookOpenCheckIcon,
  CalendarClockIcon,
  FlameIcon,
  GaugeIcon,
  RefreshCwIcon,
  SparklesIcon,
  TimerResetIcon,
  TrophyIcon,
} from "lucide-react"

import {
  buildLessonPathItems,
  type LessonPathItem,
} from "@/components/tutor/lesson-path"
import { LessonTimeline } from "@/components/tutor/lesson-timeline"
import { Button } from "@/components/ui/button"

interface LessonsCommandCenterProps {
  learning: LearningSessionPayload
  goalScore: number
  testDate: string
  busy: boolean
  onOpenWorkspace: () => void
  onStartNext: () => void
  onStartSkill: (skill: string) => void
  onStartRepair: (mistakeId: string) => void
  onStartRetention: (skill: string) => void
  onStartChallenge: (skill?: string) => void
  onStartMicro: (skill?: string) => void
  onStartRecovery: () => void
  onStartProgressCheck: () => void
  onOpenBadges: () => void
  onOpenWeek: () => void
}

function primaryAction(
  learning: LearningSessionPayload,
  actions: Pick<
    LessonsCommandCenterProps,
    "onOpenWorkspace" | "onStartNext" | "onStartRepair" | "onStartProgressCheck"
  >
) {
  if (learning.status === "complete") {
    return {
      label: "Start next lesson",
      detail: "Open the next question type in this round.",
      action: actions.onStartNext,
      icon: ArrowRightIcon,
    }
  }

  const current = learning.mission.steps.find(
    (step) => step.state === "current"
  )
  if (current?.id === "repair") {
    const mistake = learning.mission.mistakes.find(
      (item) => item.resolvedAt === null
    )
    if (mistake) {
      return {
        label: "Retry missed question",
        detail: "Fix the saved mistake before the round continues.",
        action: () => actions.onStartRepair(mistake.id),
        icon: RefreshCwIcon,
      }
    }
  }

  if (current?.id === "checkpoint") {
    return {
      label: "Start progress check",
      detail: "Take one timed, full-length ACT section.",
      action: actions.onStartProgressCheck,
      icon: TimerResetIcon,
    }
  }

  return {
    label: current?.id === "practice" ? "Continue practice" : "Open lesson",
    detail:
      current?.id === "practice"
        ? "Resume at the next unanswered question."
        : "See the question type, follow an example, then practice it.",
    action: actions.onOpenWorkspace,
    icon: BookOpenCheckIcon,
  }
}

export function LessonsCommandCenter(props: LessonsCommandCenterProps) {
  const { learning } = props
  const progress = learning.mission.progress
  const lessonPath = buildLessonPathItems({
    requiredSkills: learning.cycle.requiredSkills,
    completedSkills: learning.cycle.completedSkills,
    currentSkill:
      learning.status === "complete" ? learning.nextSkill : learning.todaySkill,
    skills: learning.learningTwin.skills.map((skill) => ({
      skill: skill.skill,
      label: skill.label,
      section: skill.section,
    })),
    currentLessonMinutes: learning.lesson.minutes,
  })
  const action = primaryAction(learning, props)
  const ActionIcon = action.icon
  const nextReview = learning.mission.dueReviews[0]
  const nextMistake = learning.mission.mistakes.find(
    (mistake) => mistake.resolvedAt === null
  )
  const canSwitch = learning.status === "complete" && !props.busy

  function selectLesson(lesson: LessonPathItem) {
    if (props.busy) return
    if (
      learning.status !== "complete" &&
      (lesson.id === learning.todaySkill || lesson.status === "current")
    ) {
      props.onOpenWorkspace()
      return
    }
    if (learning.status === "complete") {
      props.onStartSkill(lesson.id)
      return
    }
    props.onOpenWorkspace()
  }

  return (
    <div
      className="mx-auto w-full max-w-[86rem] px-4 py-7 sm:px-7 lg:py-9"
      data-testid="lessons-command-center"
    >
      <header className="grid gap-6 border-b-2 border-foreground pb-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="ink-label text-primary">
            Round {learning.cycle.roundNumber} · Foundation path
          </p>
          <h1 className="mt-3 max-w-4xl font-heading text-5xl leading-[0.96] font-black tracking-[-0.05em] sm:text-6xl">
            Learn the types. Then sharpen the weak spots.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Round one covers all 12 ACT question types. Later rounds use your
            diagnostic and full-test evidence to change the order.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border text-center">
          <div className="min-w-24 bg-background px-4 py-3">
            <dt className="text-xs font-bold text-muted-foreground">Streak</dt>
            <dd className="mt-1 flex items-center justify-center gap-1.5 font-heading text-xl font-black">
              <FlameIcon
                className="size-4 text-[var(--scout-coral)]"
                aria-hidden="true"
              />
              {progress.currentStreak}
            </dd>
          </div>
          <div className="min-w-24 bg-background px-4 py-3">
            <dt className="text-xs font-bold text-muted-foreground">Points</dt>
            <dd className="mt-1 font-heading text-xl font-black tabular-nums">
              {progress.xp.toLocaleString("en-US")}
            </dd>
          </div>
          <div className="min-w-24 bg-background px-4 py-3">
            <dt className="text-xs font-bold text-muted-foreground">Goal</dt>
            <dd className="mt-1 font-heading text-xl font-black">
              {props.goalScore}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-7 grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div
          data-tour-id="lesson-path"
          className="overflow-hidden rounded-2xl border bg-background"
        >
          <LessonTimeline
            lessons={lessonPath}
            roundNumber={learning.cycle.roundNumber}
            roundLabel={
              learning.cycle.roundNumber === 1
                ? "Foundation round"
                : `Adaptive round ${learning.cycle.roundNumber}`
            }
            title="Your lesson path"
            description="Move down the path in order. Finished lessons stay marked while the next available node opens."
            busy={props.busy}
            className="max-w-none"
            onSelectLesson={selectLesson}
          />
        </div>

        <aside className="grid gap-5 xl:sticky xl:top-24">
          <section
            data-tour-id="lesson-action"
            className="rounded-2xl border-2 border-primary bg-secondary p-5"
          >
            <p className="ink-label text-primary">Up next</p>
            <h2 className="mt-3 font-heading text-2xl leading-tight font-black">
              {learning.status === "complete"
                ? (learning.mission.skillMap.find(
                    (skill) => skill.skill === learning.nextSkill
                  )?.label ?? "Next lesson")
                : learning.lesson.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {action.detail}
            </p>
            <Button
              type="button"
              size="lg"
              className="mt-5 w-full"
              disabled={props.busy}
              onClick={action.action}
            >
              <ActionIcon data-icon="inline-start" />
              {action.label}
            </Button>
          </section>

          <section className="rounded-2xl border bg-background p-5">
            <div className="flex items-center gap-2">
              <CalendarClockIcon className="size-5 text-primary" />
              <h2 className="font-heading text-xl font-black">This week</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Study blocks are spaced toward your {props.testDate} test date.
              Change the exact weekdays and minutes whenever your week changes.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full"
              onClick={props.onOpenWeek}
            >
              Adjust my week
            </Button>
          </section>

          <section className="rounded-2xl border bg-background p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <GaugeIcon className="size-5 text-primary" />
                <h2 className="font-heading text-xl font-black">
                  Session review
                </h2>
              </div>
              <span className="font-mono text-xs font-bold text-muted-foreground">
                {learning.mission.unresolvedMistakes} open
              </span>
            </div>
            {learning.status !== "complete" ? (
              <>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Finish the current lesson first. Your review queue will stay
                  here.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={props.onOpenWorkspace}
                >
                  Continue current lesson
                </Button>
              </>
            ) : nextMistake ? (
              <>
                <p className="mt-3 text-sm leading-6">
                  <strong>{nextMistake.skillLabel}:</strong>{" "}
                  {nextMistake.prompt}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full"
                  disabled={props.busy}
                  onClick={() => props.onStartRepair(nextMistake.id)}
                >
                  <RefreshCwIcon /> Try it again
                </Button>
              </>
            ) : nextReview ? (
              <>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {nextReview.label} is ready for a short retention check.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full"
                  disabled={props.busy}
                  onClick={() => props.onStartRetention(nextReview.skill)}
                >
                  Review {nextReview.label}
                </Button>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Nothing is overdue. Use a full-section check when you want a
                  stronger read on your pacing.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={props.onStartProgressCheck}
                >
                  <TimerResetIcon /> Start progress check
                </Button>
              </>
            )}
          </section>

          <section className="rounded-2xl border bg-background p-5">
            <h2 className="font-heading text-xl font-black">
              More study options
            </h2>
            {canSwitch ? (
              <div className="mt-4 grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={() => props.onStartMicro()}
                >
                  <SparklesIcon /> 3-minute lesson
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={() => props.onStartChallenge()}
                >
                  <TrophyIcon /> Harder challenge
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={props.onStartRecovery}
                >
                  <RefreshCwIcon /> Easy restart
                </Button>
              </div>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Finish the current task before switching formats.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={props.onOpenWorkspace}
                >
                  Finish current task
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="link"
              className="mt-3 h-auto px-0"
              onClick={props.onOpenBadges}
            >
              See points and badges
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </section>
        </aside>
      </div>
    </div>
  )
}
