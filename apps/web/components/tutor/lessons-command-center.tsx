"use client"

import type { LearningSessionPayload } from "@act-tutor/core"
import {
  ArrowRightIcon,
  BookOpenCheckIcon,
  CalendarClockIcon,
  FlameIcon,
  RefreshCwIcon,
  SparklesIcon,
  TimerResetIcon,
  TrophyIcon,
} from "lucide-react"

import {
  buildLessonPathItems,
  type LessonPathItem,
} from "@/components/tutor/lesson-path"
import {
  currentRoundLessonCheck,
  historicalLessonRounds,
} from "@/components/tutor/lesson-history"
import { LearningRoundRewardSummary } from "@/components/tutor/learning-reward-summary"
import { LessonTimeline } from "@/components/tutor/lesson-timeline"
import { Button } from "@/components/ui/button"
import { formatCalendarDate } from "@/lib/dates"

interface LessonsCommandCenterProps {
  learning: LearningSessionPayload
  goalScore: number
  testDate: string
  busy: boolean
  onOpenWorkspace: () => void
  onReviewLesson: (lessonCheckId: string) => void
  onStartNext: () => void
  onStartSkill: (skill: string) => void
  onStartRepair: (mistakeId: string) => void
  onStartRetention: (skill: string) => void
  onStartChallenge: (skill?: string) => void
  onStartMicro: (skill?: string) => void
  onStartRecovery: () => void
  onStartProgressCheck: () => void
  onContinueRoundAssessment: () => void
  onOpenBadges: () => void
  onOpenWeek: () => void
}

function primaryAction(
  learning: LearningSessionPayload,
  actions: Pick<
    LessonsCommandCenterProps,
    | "onOpenWorkspace"
    | "onStartNext"
    | "onStartRepair"
    | "onStartProgressCheck"
    | "onContinueRoundAssessment"
  >
) {
  if (learning.cycle.status === "assessment-choice") {
    return {
      label: "Choose the next assessment",
      detail: "Your completed lessons stay open for review.",
      action: actions.onContinueRoundAssessment,
      icon: ArrowRightIcon,
    }
  }

  if (learning.status === "remediation") {
    return {
      label: "Review missed questions",
      detail: "Work through each missed item with Mr. Kim.",
      action: actions.onOpenWorkspace,
      icon: RefreshCwIcon,
    }
  }

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
  const lessonHistory = learning.lessonHistory ?? []
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
  const previousRounds = historicalLessonRounds(
    lessonHistory,
    learning.cycle.roundNumber
  )
  const action = primaryAction(learning, props)
  const ActionIcon = action.icon
  const nextReview = learning.mission.dueReviews[0]
  const nextMistake = learning.mission.mistakes.find(
    (mistake) => mistake.resolvedAt === null
  )
  const canSwitch = learning.status === "complete" && !props.busy

  function selectLesson(lesson: LessonPathItem) {
    if (props.busy) return
    if (lesson.status === "completed") {
      const check = currentRoundLessonCheck(
        lessonHistory,
        learning.cycle.roundNumber,
        lesson.id
      )
      if (check) props.onReviewLesson(check.id)
      return
    }
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
      className="mx-auto w-full max-w-[86rem] px-4 py-6 sm:px-7 lg:py-7"
      data-testid="lessons-command-center"
    >
      <header className="flex flex-col gap-5 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ink-label text-primary">
            Round {learning.cycle.roundNumber} ·{" "}
            {learning.cycle.roundNumber === 1 ? "Foundation" : "Adaptive"}
          </p>
          <h1 className="mt-1.5 font-heading text-3xl leading-tight font-black tracking-[-0.035em] sm:text-4xl">
            Lessons
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {learning.cycle.roundNumber === 1
              ? "Learn each ACT question type in order."
              : "Work through the skills your latest assessment prioritized."}
          </p>
        </div>
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm lg:justify-end">
          <div className="flex items-center gap-2">
            <dt className="font-semibold text-muted-foreground">Streak</dt>
            <dd className="flex items-center gap-1 font-heading font-black">
              <FlameIcon
                className="size-4 text-[var(--scout-coral)]"
                aria-hidden="true"
              />
              {progress.currentStreak}
            </dd>
          </div>
          <div className="flex items-baseline gap-2 border-l pl-5">
            <dt className="font-semibold text-muted-foreground">Points</dt>
            <dd className="font-heading font-black tabular-nums">
              {progress.xp.toLocaleString("en-US")}
            </dd>
          </div>
          <div className="flex items-baseline gap-2 border-l pl-5">
            <dt className="font-semibold text-muted-foreground">Goal</dt>
            <dd className="font-heading font-black">{props.goalScore}</dd>
          </div>
        </dl>
      </header>

      {learning.roundReward?.nextRoundNumber === learning.cycle.roundNumber ? (
        <LearningRoundRewardSummary
          reward={learning.roundReward}
          className="mt-6"
        />
      ) : null}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-2xl border bg-background">
          <LessonTimeline
            lessons={lessonPath}
            roundNumber={learning.cycle.roundNumber}
            roundLabel={
              learning.cycle.roundNumber === 1
                ? "Foundation round"
                : `Adaptive round ${learning.cycle.roundNumber}`
            }
            title="Your lesson path"
            description="The highlighted lesson is ready now."
            busy={props.busy}
            className="max-w-none"
            onSelectLesson={selectLesson}
          />
        </div>

        <aside className="overflow-hidden rounded-2xl border bg-background xl:sticky xl:top-24">
          <div className="bg-secondary p-5">
            <p className="ink-label text-primary">Up next</p>
            <h2 className="mt-2.5 font-heading text-2xl leading-tight font-black">
              {learning.status === "complete"
                ? (learning.mission.skillMap.find(
                    (skill) => skill.skill === learning.nextSkill
                  )?.label ?? "Next lesson")
                : learning.lesson.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {action.detail}
            </p>
            <Button
              type="button"
              size="lg"
              className="mt-4 w-full"
              data-tour-id="lesson-action"
              disabled={props.busy}
              onClick={action.action}
            >
              <ActionIcon data-icon="inline-start" />
              {action.label}
            </Button>
          </div>

          <div className="border-t px-5 py-4">
            <div className="flex items-center gap-3">
              <CalendarClockIcon
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Study week</p>
                <p className="truncate text-xs text-muted-foreground">
                  Test date {formatCalendarDate(props.testDate)}
                </p>
              </div>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto min-h-11 px-0"
                onClick={props.onOpenWeek}
              >
                Adjust
              </Button>
            </div>
          </div>

          {learning.status === "complete" && nextMistake ? (
            <div className="border-t px-5 py-4">
              <div className="flex items-start gap-3">
                <RefreshCwIcon
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Review one mistake</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {nextMistake.skillLabel}: {nextMistake.prompt}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                disabled={props.busy}
                onClick={() => props.onStartRepair(nextMistake.id)}
              >
                Try it again
              </Button>
            </div>
          ) : learning.status === "complete" && nextReview ? (
            <div className="border-t px-5 py-4">
              <p className="text-sm font-bold">Ready to review</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Refresh {nextReview.label} before it fades.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                disabled={props.busy}
                onClick={() => props.onStartRetention(nextReview.skill)}
              >
                Review {nextReview.label}
              </Button>
            </div>
          ) : null}

          {canSwitch ? (
            <details className="group border-t">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">
                More ways to study
                <span className="font-mono text-xs text-primary group-open:hidden">
                  Show
                </span>
                <span className="hidden font-mono text-xs text-primary group-open:inline">
                  Hide
                </span>
              </summary>
              <div className="grid gap-2 border-t px-5 py-4">
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
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={props.onStartProgressCheck}
                >
                  <TimerResetIcon /> Full-section check
                </Button>
              </div>
            </details>
          ) : null}

          <div className="border-t px-5 py-3">
            <Button
              type="button"
              variant="link"
              className="h-auto min-h-11 px-0"
              onClick={props.onOpenBadges}
            >
              Points and badges
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </aside>
      </div>

      {previousRounds.length ? (
        <section
          className="mt-7 border-t pt-6"
          aria-labelledby="completed-lesson-library-title"
          data-testid="completed-lesson-library"
        >
          <p className="ink-label text-primary">Read-only review</p>
          <h2
            id="completed-lesson-library-title"
            className="mt-1.5 font-heading text-2xl font-black tracking-[-0.025em]"
          >
            Earlier lesson rounds
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Reopen any completed lesson. Reviewing an older lesson never changes
            your current round.
          </p>
          <div className="mt-4 grid gap-3">
            {previousRounds.map((round) => (
              <details
                key={round.roundNumber}
                className="group overflow-hidden rounded-xl border bg-background"
              >
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">
                  <span>
                    Round {round.roundNumber} ·{" "}
                    {round.cycleKind === "foundation"
                      ? "Foundation"
                      : "Adaptive"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {round.lessons.length}{" "}
                    {round.lessons.length === 1 ? "lesson" : "lessons"}
                  </span>
                </summary>
                <div className="grid gap-2 border-t p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {round.lessons.map((check) => (
                    <Button
                      key={check.id}
                      type="button"
                      variant="outline"
                      className="h-auto min-h-14 justify-between gap-4 px-4 py-3 text-left"
                      disabled={props.busy}
                      onClick={() => props.onReviewLesson(check.id)}
                      aria-label={`Review ${check.lesson.title} from round ${check.roundNumber}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold">
                          {check.lesson.title}
                        </span>
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          Check score {check.correct}/{check.total}
                        </span>
                      </span>
                      <BookOpenCheckIcon
                        className="size-4 shrink-0"
                        aria-hidden="true"
                      />
                    </Button>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
