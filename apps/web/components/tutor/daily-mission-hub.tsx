"use client"

import type { KnowledgeState, LearningSessionPayload } from "@act-tutor/core"
import {
  ArrowRightIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  SparklesIcon,
  TimerResetIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DailyMissionHubProps {
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
        label: `Today · ${SECTION_LABEL[learning.mastery.section]}`,
        title: `Retry: ${learning.mastery.label}`,
        description: "Give one missed question another try.",
      }
    case "checkpoint":
      return {
        label: "Today · Quick quiz",
        title: "3-question mixed quiz",
        description: "Answer three questions across today’s priority skills.",
      }
    case "retention":
      return {
        label: `Today · ${SECTION_LABEL[learning.mastery.section]}`,
        title: `Review ${learning.mastery.label}`,
        description: "Use two questions to refresh this skill.",
      }
    case "challenge":
      return {
        label: `Today · ${SECTION_LABEL[learning.mastery.section]}`,
        title: `Harder ${learning.mastery.label} questions`,
        description: "Take on three harder questions in this skill.",
      }
    case "micro":
      return {
        label: `Today · ${SECTION_LABEL[learning.mastery.section]}`,
        title: `3-minute ${learning.mastery.label} lesson`,
        description: "Review the idea, then answer one question.",
      }
    case "recovery":
      return {
        label: "Today · Restart",
        title: "Start again with two questions",
        description: "Ease back in with two priority questions.",
      }
    default:
      const continuingPractice = learning.mission.steps.some(
        (step) => step.id === "practice" && step.state === "current"
      )
      return {
        label: `Today · ${SECTION_LABEL[learning.mastery.section]}`,
        title: learning.lesson.title,
        description: continuingPractice
          ? "Continue the practice questions for this skill."
          : `Learn the question type, then practice it with ${learning.questions.length} questions.`,
      }
  }
}

function MissionAction(props: DailyMissionHubProps) {
  const { learning } = props
  if (learning.status === "complete") {
    return (
      <Button
        type="button"
        size="xl"
        onClick={props.onStartNext}
        disabled={props.busy}
        className="w-full sm:w-auto sm:min-w-72"
      >
        Start lesson
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
        "grid w-full grid-cols-[minmax(0,1fr)_3rem] items-center gap-4 border-b py-3 text-left last:border-b-0 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed",
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
      <span className="text-right text-sm font-bold text-muted-foreground tabular-nums">
        {percent}%
      </span>
    </button>
  )
}

function ExpandedStudyDetails(props: DailyMissionHubProps) {
  const reviews = props.learning.mission.dueReviews.slice(0, 4)
  const mistakes = props.learning.mission.mistakes.slice(0, 5)
  const ready = props.learning.status === "complete" && !props.busy
  return (
    <details className="group mx-auto max-w-4xl border-t">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-1 py-3 text-sm font-semibold text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        More study options
        <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
      </summary>
      <section className="border-t px-1 py-7" aria-labelledby="quick-title">
        <h2 id="quick-title" className="text-lg font-bold">
          Quick sessions
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!ready}
            onClick={() => props.onStartMicro()}
          >
            3-minute lesson
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!ready}
            onClick={() => props.onStartChallenge()}
          >
            Harder challenge
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!ready}
            onClick={props.onStartRecovery}
          >
            Easy restart
          </Button>
        </div>
      </section>

      <div className="grid gap-10 border-t px-1 py-7 xl:grid-cols-2">
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

      <section className="border-t px-1 py-7" aria-labelledby="skills-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="skills-title" className="text-xl font-bold">
            All 12 skills
          </h2>
          <p className="text-sm text-muted-foreground">
            Finish today&apos;s assignment before switching skills.
          </p>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {(["english", "math", "reading"] as const).map((section) => (
            <div
              key={section}
              className="rounded-xl border border-border/80 bg-card p-4"
            >
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
  const { learning } = props
  const upcomingSkill = learning.mission.skillMap.find(
    (skill) => skill.skill === learning.nextSkill
  )
  const missionCopy =
    learning.status === "complete" && upcomingSkill
      ? {
          label: `Next · ${SECTION_LABEL[upcomingSkill.section]}`,
          title: upcomingSkill.label,
          description: `Next question type in round ${learning.cycle.roundNumber}.`,
        }
      : getMissionCopy(learning)
  const roundTotal = learning.cycle.requiredSkills.length
  const roundComplete = learning.cycle.completedSkills.length
  const roundLesson = Math.min(roundComplete + 1, roundTotal)
  const roundProgress =
    roundTotal === 0 ? 0 : Math.round((roundComplete / roundTotal) * 100)
  const currentRecommendation = learning.learningTwin.recommendation
  const currentStep = learning.mission.steps.find(
    (step) => step.state === "current"
  )
  const nextLabel =
    currentStep?.id === "learn"
      ? "Focused practice"
      : currentStep?.id === "practice"
        ? "Finish today’s questions"
        : currentStep?.id === "repair"
          ? "Your next priority"
          : currentRecommendation.label

  return (
    <div className="pb-10">
      <section
        className="mx-auto flex min-h-[calc(100svh-12rem)] max-w-3xl items-center justify-center px-4 py-12 text-center sm:py-16"
        data-testid="today-focus"
      >
        <div className="flex w-full flex-col items-center">
          <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
            {missionCopy.label}
          </p>
          <h1 className="mt-5 max-w-3xl font-heading text-4xl leading-[1.02] font-black tracking-[-0.04em] text-balance sm:text-5xl">
            {missionCopy.title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            {missionCopy.description}
          </p>

          <div className="mt-9 w-full max-w-sm">
            <div className="flex items-center justify-between gap-4 text-xs font-semibold text-muted-foreground">
              <span>
                Round {learning.cycle.roundNumber}
                {learning.status === "complete"
                  ? ""
                  : ` · ${learning.lesson.minutes} min`}
              </span>
              <span>
                {roundLesson} of {roundTotal}
              </span>
            </div>
            <div
              className="mt-2 h-1 overflow-hidden rounded-full bg-border/70"
              role="progressbar"
              aria-label={`Round ${learning.cycle.roundNumber} lesson progress`}
              aria-valuemin={0}
              aria-valuemax={roundTotal}
              aria-valuenow={roundComplete}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
                style={{ width: `${roundProgress}%` }}
              />
            </div>
          </div>

          <div className="mt-10">
            <MissionAction {...props} />
          </div>
          {learning.status === "complete" ? null : (
            <p className="mt-4 text-sm text-muted-foreground">
              Next: {nextLabel}
            </p>
          )}
        </div>
      </section>
      <ExpandedStudyDetails {...props} />
    </div>
  )
}
