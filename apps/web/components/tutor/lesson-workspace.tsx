"use client"

import type { LearningSessionPayload } from "@act-tutor/core"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  Clock3Icon,
  SparklesIcon,
  XIcon,
} from "lucide-react"

import { ScoutCoach, type ScoutMood } from "@/components/tutor/scout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { formatCalendarDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

interface LessonWorkspaceProps {
  learning: LearningSessionPayload
  activeSection: number
  selectedChoice: string
  submitting: boolean
  onSectionChange: (index: number) => void
  onChoiceChange: (choice: string) => void
  onCompleteLesson: () => void
  onSubmitAnswer: () => void
  onClose: () => void
}

const SECTION_SHORT_LABELS = ["Model", "Example", "Rule", "Transfer"] as const

function GenerationStamp({ learning }: { learning: LearningSessionPayload }) {
  const ai = learning.lesson.generation.mode === "ai"
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
        {ai ? <SparklesIcon aria-hidden="true" /> : <CheckCircle2Icon aria-hidden="true" />}
        {ai ? "AI-personalized lesson" : "Reviewed personalized fallback"}
      </span>
      <span>
        {ai
          ? `${learning.lesson.generation.provider} · ${learning.lesson.generation.model}`
          : "Runs without an AI key"}
      </span>
    </div>
  )
}

function LessonStage({
  learning,
  activeSection,
  submitting,
  onSectionChange,
  onCompleteLesson,
}: Pick<
  LessonWorkspaceProps,
  "learning" | "activeSection" | "submitting" | "onSectionChange" | "onCompleteLesson"
>) {
  const section = learning.lesson.sections[activeSection]
  const isLast = activeSection === learning.lesson.sections.length - 1

  return (
    <div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <section className="min-w-0 px-5 py-7 sm:px-8 sm:py-9">
        <div className="flex flex-wrap items-center gap-3">
          <span className="ink-label text-primary">
            Stage {activeSection + 1} / {learning.lesson.sections.length}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock3Icon aria-hidden="true" />
            {Math.max(2, Math.round(learning.lesson.minutes / 4))} min
          </span>
        </div>
        <h2 className="mt-4 max-w-2xl font-heading text-4xl leading-none font-black tracking-[-0.025em] sm:text-5xl">
          {section.title}
        </h2>
        <p className="mt-5 max-w-3xl text-base leading-8 sm:text-lg">
          {section.explanation}
        </p>

        {section.id === "guided-example" ? (
          <div className="paper-panel mt-7 border-2 border-foreground px-5 py-5 sm:px-6">
            <p className="ink-label text-muted-foreground">Reviewed worked example</p>
            <p className="mt-3 text-lg font-semibold leading-7">
              {learning.lesson.workedExample.prompt}
            </p>
            <p className="mt-4 border-l-4 border-[var(--scout-sun)] pl-4 text-sm leading-7 text-muted-foreground">
              {learning.lesson.workedExample.explanation.join(" ")}
            </p>
            <p className="mt-4 font-semibold">Answer: {learning.lesson.workedExample.answer}</p>
          </div>
        ) : null}

        {section.id === "decision-rule" ? (
          <ol className="mt-7 border-y-2 border-foreground">
            {learning.lesson.strategyChecklist.map((step, index) => (
              <li
                key={step}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start border-b border-border py-4 last:border-0"
              >
                <span className="font-mono text-sm font-bold text-primary">0{index + 1}</span>
                <span className="text-sm leading-6 sm:text-base">{step}</span>
              </li>
            ))}
          </ol>
        ) : null}

        {section.id === "transfer" ? (
          <div className="mt-7 border-2 border-dashed border-foreground p-5">
            <p className="ink-label">Transfer cue</p>
            <p className="mt-3 text-lg leading-7 font-semibold">
              {learning.lesson.transferPrompt}
            </p>
          </div>
        ) : null}

        <ScoutCoach
          className="mt-8"
          mood={activeSection === 1 ? "thinking" : "ready"}
          message={section.coachPrompt}
          detail={learning.lesson.evidenceSummary}
        />

        <div className="mt-8 flex flex-wrap gap-3 border-t pt-6">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={activeSection === 0}
            onClick={() => onSectionChange(activeSection - 1)}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Previous stage
          </Button>
          {isLast ? (
            <Button type="button" size="lg" onClick={onCompleteLesson} disabled={submitting}>
              <CheckCircle2Icon data-icon="inline-start" />
              {submitting ? "Saving lesson…" : "Start focused practice"}
            </Button>
          ) : (
            <Button type="button" size="lg" onClick={() => onSectionChange(activeSection + 1)}>
              Next stage
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          )}
        </div>
      </section>

      <aside className="border-t bg-[var(--rail)] px-5 py-7 lg:border-t-0 lg:border-l lg:px-6">
        <p className="ink-label text-muted-foreground">Why this lesson</p>
        <p className="mt-3 text-sm leading-6">{learning.lesson.whyAssigned}</p>
        <div className="mt-6 border-y py-5">
          <p className="ink-label text-muted-foreground">Lesson depth</p>
          <p className="mt-2 font-heading text-2xl font-bold capitalize">
            {learning.lesson.depth}
          </p>
        </div>
        <p className="mt-6 ink-label text-muted-foreground">Common trap</p>
        <p className="mt-3 text-sm leading-6">{learning.lesson.trap}</p>
        <div className="mt-6">
          <GenerationStamp learning={learning} />
        </div>
      </aside>
    </div>
  )
}

function PracticeStage({
  learning,
  selectedChoice,
  submitting,
  onChoiceChange,
  onSubmitAnswer,
}: Pick<
  LessonWorkspaceProps,
  "learning" | "selectedChoice" | "submitting" | "onChoiceChange" | "onSubmitAnswer"
>) {
  const answered = learning.answeredQuestionIds.length
  const currentQuestion = learning.questions[learning.currentQuestionIndex]
  const progress = Math.round((answered / learning.questions.length) * 100)
  const feedback = learning.lastFeedback
  const mood: ScoutMood = feedback
    ? feedback.correct
      ? "correct"
      : "repair"
    : "thinking"

  if (learning.status === "complete") {
    return (
      <section className="px-5 py-10 sm:px-8 sm:py-12">
        <ScoutCoach
          mood="correct"
          message="Focused set complete. The next session has already changed from this evidence."
          detail={learning.futureTask.reason}
        />
        <h2 className="mt-8 font-heading text-5xl leading-none font-black tracking-[-0.03em]">
          Evidence banked.
        </h2>
        <p className="mt-5 max-w-2xl text-lg leading-8">
          {learning.mastery.label} is now at {Math.round(learning.mastery.mastery * 100)}% modeled mastery from {learning.mastery.evidence} evidence points.
        </p>
        <dl className="mt-8 grid max-w-3xl border-y-2 border-foreground sm:grid-cols-3 sm:divide-x-2 sm:divide-foreground">
          <div className="px-4 py-5 first:pl-0">
            <dt className="ink-label text-muted-foreground">Mastery band</dt>
            <dd className="mt-2 font-heading text-3xl font-bold capitalize">{learning.mastery.band}</dd>
          </div>
          <div className="px-4 py-5">
            <dt className="ink-label text-muted-foreground">Next review</dt>
            <dd className="mt-2 font-heading text-3xl font-bold">
              {learning.mastery.nextReviewAt
                ? formatCalendarDate(learning.mastery.nextReviewAt.slice(0, 10))
                : "Pending"}
            </dd>
          </div>
          <div className="px-4 py-5 last:pr-0">
            <dt className="ink-label text-muted-foreground">Next priority</dt>
            <dd className="mt-2 text-sm leading-6 font-semibold">{learning.futureTask.reason}</dd>
          </div>
        </dl>
      </section>
    )
  }

  return (
    <section className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 px-5 py-7 sm:px-8 sm:py-9">
        <div className="flex items-center justify-between gap-4">
          <p className="ink-label text-primary">
            Focus set · Question {learning.currentQuestionIndex + 1} of {learning.questions.length}
          </p>
          <span className="font-mono text-sm font-bold">{progress}%</span>
        </div>
        <Progress value={progress} className="mt-3">
          <ProgressLabel className="sr-only">Focused practice progress</ProgressLabel>
        </Progress>

        {currentQuestion?.stimulus ? (
          <div className="mt-7 border-y-2 border-foreground bg-background px-1 py-5 text-base leading-8">
            {currentQuestion.stimulus}
          </div>
        ) : null}
        <h2 className="mt-7 max-w-3xl font-heading text-3xl leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
          {currentQuestion?.prompt}
        </h2>
        {currentQuestion ? (
          <RadioGroup
            value={selectedChoice}
            onValueChange={onChoiceChange}
            className="mt-7 grid gap-3"
            aria-label="Practice answer choices"
          >
            {currentQuestion.choices.map((choice, index) => (
              <label
                key={choice.id}
                className={cn(
                  "grid cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)] items-start border-2 border-border bg-background px-4 py-4 text-sm leading-6 transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-foreground sm:text-base",
                  selectedChoice === choice.id && "border-primary bg-secondary"
                )}
              >
                <RadioGroupItem value={choice.id} className="sr-only" />
                <span className="col-start-1 row-start-1 font-mono font-bold text-primary">{String.fromCharCode(65 + index)}</span>
                <span className="col-start-2 row-start-1 min-w-0">{choice.text}</span>
              </label>
            ))}
          </RadioGroup>
        ) : null}
        <Button
          type="button"
          size="xl"
          className="mt-6"
          onClick={onSubmitAnswer}
          disabled={!selectedChoice || submitting}
        >
          <BrainCircuitIcon data-icon="inline-start" />
          {submitting ? "Checking evidence…" : "Check the reasoning"}
        </Button>
      </div>

      <aside className="border-t bg-[var(--rail)] px-5 py-7 lg:border-t-0 lg:border-l lg:px-6">
        <ScoutCoach
          mood={mood}
          message={
            feedback
              ? feedback.correct
                ? "Correct. Now make the rule explicit so it transfers."
                : "Good miss. Repair the decision before moving on."
              : undefined
          }
          detail={feedback?.rationale ?? learning.lesson.transferPrompt}
        />
        {feedback ? (
          <Alert className="mt-7 bg-background">
            {feedback.correct ? <CheckCircle2Icon /> : <CircleAlertIcon />}
            <AlertTitle>{feedback.correct ? "Evidence confirmed" : "Repair note"}</AlertTitle>
            <AlertDescription>
              {feedback.rationale}
              {feedback.misconception ? ` ${feedback.misconception}` : ""}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="mt-7 border-t pt-5">
          <p className="ink-label text-muted-foreground">Current model</p>
          <p className="mt-2 font-heading text-4xl font-black tabular-nums">
            {Math.round(learning.mastery.mastery * 100)}%
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {learning.mastery.label} · {learning.mastery.band}
          </p>
        </div>
      </aside>
    </section>
  )
}

export function LessonWorkspace(props: LessonWorkspaceProps) {
  return (
    <div className="paper-panel overflow-hidden border-2 border-foreground bg-background">
      <header className="flex min-h-16 flex-wrap items-center gap-x-5 gap-y-3 border-b-2 border-foreground bg-foreground px-4 py-3 text-background sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="ink-label text-[var(--scout-mint)]">Today’s teaching workspace</p>
          <p className="mt-1 truncate font-heading text-xl font-bold sm:text-2xl">
            {props.learning.lesson.title}
          </p>
        </div>
        {!props.learning.lessonComplete ? (
          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto" aria-label="Lesson stages">
            {SECTION_SHORT_LABELS.map((label, index) => (
              <Button
                key={label}
                type="button"
                variant={props.activeSection === index ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "text-background hover:text-foreground",
                  props.activeSection === index && "text-secondary-foreground"
                )}
                onClick={() => props.onSectionChange(index)}
              >
                {index + 1}. {label}
              </Button>
            ))}
          </nav>
        ) : (
          <span className="ink-label text-[var(--scout-mint)]">Focused practice</span>
        )}
        <Button type="button" variant="ghost" size="icon" onClick={props.onClose} aria-label="Close lesson workspace">
          <XIcon />
        </Button>
      </header>

      {props.learning.lessonComplete ? (
        <PracticeStage {...props} />
      ) : (
        <LessonStage {...props} />
      )}
    </div>
  )
}
