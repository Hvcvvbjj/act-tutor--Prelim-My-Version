"use client"

import { useEffect, useRef, useState } from "react"
import type { AnswerConfidence, LearningSessionPayload } from "@act-tutor/core"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  LightbulbIcon,
  Volume2Icon,
} from "lucide-react"

import { useScoutContext } from "@/components/tutor/scout-assistant"
import {
  buildPracticeExplanation,
  lessonSegmentMinutes,
  lessonSectionsForDisplay,
  shouldHoldPracticeFeedback,
} from "@/components/tutor/lesson-workspace-logic"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import {
  RadioGroup,
  VisuallyHiddenRadioGroupItem,
} from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

interface LessonWorkspaceProps {
  learning: LearningSessionPayload
  activeSection: number
  selectedChoice: string
  submitting: boolean
  onSectionChange: (index: number) => void
  onChoiceChange: (choice: string) => void
  onCompleteLesson: () => void
  onSubmitAnswer: (metadata: {
    confidence: AnswerConfidence
    selfCorrected: boolean
    responseSeconds: number
  }) => void
  onClose: () => void
}

const SECTION_SHORT_LABELS = [
  "Type",
  "Idea",
  "Example",
  "Steps",
  "Remember",
] as const

function LessonStage({
  learning,
  activeSection,
  submitting,
  onSectionChange,
  onCompleteLesson,
}: Pick<
  LessonWorkspaceProps,
  | "learning"
  | "activeSection"
  | "submitting"
  | "onSectionChange"
  | "onCompleteLesson"
>) {
  const lessonSections = lessonSectionsForDisplay(learning.lesson.sections)
  const visibleSectionIndex = Math.min(
    activeSection,
    Math.max(0, lessonSections.length - 1)
  )
  const section =
    lessonSections[visibleSectionIndex] ?? learning.lesson.sections[0]!
  const isLast = visibleSectionIndex === lessonSections.length - 1
  const sectionHeadingRef = useRef<HTMLHeadingElement>(null)
  const { accommodations, explanationPreferences } = useScoutContext()
  const useShortExplanation =
    accommodations.simplified ||
    explanationPreferences.depth === "quick" ||
    explanationPreferences.readingLevel === "plain"
  const displayExplanation = useShortExplanation
    ? (section.explanation.split(/(?<=[.!?])\s+/)[0] ?? section.explanation)
    : section.explanation
  const spokenContent =
    section.id === "guided-example"
      ? `${learning.lesson.workedExample.prompt} ${learning.lesson.workedExample.explanation.join(" ")} Answer: ${learning.lesson.workedExample.answer}.`
      : section.id === "decision-rule"
        ? learning.lesson.strategyChecklist.join(" ")
        : displayExplanation

  useEffect(() => {
    sectionHeadingRef.current?.focus()
  }, [visibleSectionIndex])

  return (
    <section className="mx-auto flex min-h-[calc(100svh-9rem)] w-full max-w-3xl flex-col px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex-1">
        <h2
          ref={sectionHeadingRef}
          tabIndex={-1}
          className="max-w-2xl font-heading text-3xl leading-tight font-black tracking-[-0.025em] outline-none sm:text-5xl"
        >
          {section.title}
        </h2>
        {section.id !== "guided-example" && section.id !== "decision-rule" ? (
          <p className="mt-5 max-w-2xl text-lg leading-8 text-foreground/85 sm:text-xl sm:leading-9">
            {displayExplanation}
          </p>
        ) : null}

        {section.id === "guided-example" ? (
          <div className="mt-8 border-y border-border py-6">
            <p className="ink-label text-muted-foreground">Worked example</p>
            <p className="mt-3 text-lg leading-7 font-semibold">
              {learning.lesson.workedExample.prompt}
            </p>
            <p className="mt-4 border-l-4 border-[var(--scout-sun)] pl-4 leading-7 text-muted-foreground">
              {learning.lesson.workedExample.explanation.join(" ")}
            </p>
            <p className="mt-4 font-semibold">
              Answer: {learning.lesson.workedExample.answer}
            </p>
          </div>
        ) : null}

        {section.id === "decision-rule" ? (
          <ol className="mt-8 border-y border-border">
            {learning.lesson.strategyChecklist.map((step, index) => (
              <li
                key={step}
                className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start border-b border-border py-4 last:border-0"
              >
                <span className="font-mono text-sm font-bold text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="leading-7">{step}</span>
              </li>
            ))}
          </ol>
        ) : null}

        {accommodations.readAloud ? (
          <Button
            type="button"
            variant="ghost"
            className="mt-5 px-0 text-primary hover:bg-transparent"
            onClick={() => {
              window.speechSynthesis.cancel()
              window.speechSynthesis.speak(
                new SpeechSynthesisUtterance(spokenContent)
              )
            }}
          >
            <Volume2Icon />
            Read this part aloud
          </Button>
        ) : null}
      </div>

      <div className="mt-10 flex items-center justify-between gap-3 border-t pt-6">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={visibleSectionIndex === 0}
          onClick={() => onSectionChange(visibleSectionIndex - 1)}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Previous
        </Button>
        {isLast ? (
          <Button
            type="button"
            size="lg"
            onClick={onCompleteLesson}
            disabled={submitting}
          >
            {submitting
              ? "Saving…"
              : learning.mode === "micro"
                ? "Start practice"
                : "Start focused practice"}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={() => onSectionChange(visibleSectionIndex + 1)}
          >
            Next
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        )}
      </div>
    </section>
  )
}

function PracticeStage({
  learning,
  selectedChoice,
  submitting,
  onChoiceChange,
  onSubmitAnswer,
  onClose,
}: Pick<
  LessonWorkspaceProps,
  | "learning"
  | "selectedChoice"
  | "submitting"
  | "onChoiceChange"
  | "onSubmitAnswer"
  | "onClose"
>) {
  const answered = learning.answeredQuestionIds.length
  const currentQuestion = learning.questions[learning.currentQuestionIndex]
  const feedback = learning.lastFeedback
  const feedbackQuestion = feedback
    ? learning.questions.find((question) => question.id === feedback.questionId)
    : null
  const feedbackIdentity = feedback
    ? `${feedback.questionId}:${learning.updatedAt}`
    : undefined
  const [dismissedFeedbackIdentity, setDismissedFeedbackIdentity] = useState<
    string | null
  >(null)
  const showingFeedback = shouldHoldPracticeFeedback({
    status: learning.status,
    currentQuestionId: currentQuestion?.id,
    feedbackQuestionId: feedback?.questionId,
    feedbackIdentity,
    dismissedFeedbackIdentity,
  })
  const visibleFeedback = showingFeedback ? feedback : null
  const displayedQuestion =
    (showingFeedback ? feedbackQuestion : currentQuestion) ?? currentQuestion
  const displayedQuestionIndex = displayedQuestion
    ? learning.questions.findIndex(
        (question) => question.id === displayedQuestion.id
      )
    : learning.currentQuestionIndex
  const currentRecommendation = learning.learningTwin.recommendation
  const roundComplete = learning.cycle.status === "assessment-choice"
  const progress = Math.round((answered / learning.questions.length) * 100)
  const isExitTicket =
    (learning.mode === "foundation" || learning.mode === "focus") &&
    displayedQuestionIndex === learning.questions.length - 1
  const [hintLevel, setHintLevel] = useState(0)
  const startedAt = useRef<number | null>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const explanation =
    visibleFeedback && displayedQuestion
      ? buildPracticeExplanation({
          correct: visibleFeedback.correct,
          rationale: visibleFeedback.rationale,
          selectedChoiceId: visibleFeedback.selectedChoiceId,
          correctChoiceId: visibleFeedback.correctChoiceId,
          choices: displayedQuestion.choices,
          concept: learning.lesson.concept,
          strategyChecklist: learning.lesson.strategyChecklist,
          style: "simple",
        })
      : null

  useEffect(() => {
    startedAt.current = window.performance.now()
  }, [displayedQuestion?.id])

  useEffect(() => {
    if (!showingFeedback) return
    const frame = window.requestAnimationFrame(() => {
      feedbackRef.current?.scrollIntoView({
        behavior: "auto",
        block: "center",
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [feedbackIdentity, showingFeedback])

  if (learning.status === "complete" && !showingFeedback) {
    const completedIncorrectly = feedback?.correct === false
    const needsAnotherTry = completedIncorrectly && learning.mode === "repair"
    return (
      <section className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-3xl flex-col justify-center px-5 py-12 text-center sm:px-8">
        <p className="ink-label text-primary">
          {needsAnotherTry ? "Review saved" : "Lesson complete"}
        </p>
        <h2 className="mt-3 font-heading text-5xl leading-tight font-black tracking-[-0.03em]">
          {needsAnotherTry
            ? "Added to your review list."
            : "Ready for what’s next."}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
          {needsAnotherTry
            ? "You can retry it from Today."
            : roundComplete
              ? "Choose the assessment that will shape your next lesson round."
              : `Next: ${currentRecommendation.label}.`}
        </p>
        <Button
          type="button"
          size="lg"
          className="mx-auto mt-7"
          onClick={onClose}
        >
          {roundComplete ? "Continue" : "Back to Today"}
        </Button>
      </section>
    )
  }

  return (
    <section
      data-practice-workspace
      className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-3xl flex-col px-5 py-8 sm:px-8 sm:py-10"
    >
      <p className="mb-3 text-right text-sm text-muted-foreground tabular-nums">
        Question {displayedQuestionIndex + 1} of {learning.questions.length}
      </p>
      <Progress value={progress}>
        <ProgressLabel className="sr-only">
          Focused practice progress
        </ProgressLabel>
      </Progress>

      <div className="flex-1">
        {displayedQuestion?.stimulus ? (
          <div className="mt-8 border-b border-border pb-6 text-lg leading-8">
            {displayedQuestion.stimulus}
          </div>
        ) : null}
        <h2 className="mt-8 max-w-2xl font-heading text-3xl leading-tight font-black tracking-[-0.02em] sm:text-4xl">
          {displayedQuestion?.prompt}
        </h2>
        {displayedQuestion ? (
          <RadioGroup
            value={
              showingFeedback
                ? (visibleFeedback?.selectedChoiceId ?? "")
                : selectedChoice
            }
            onValueChange={(choice) => {
              if (!showingFeedback) onChoiceChange(choice)
            }}
            disabled={showingFeedback}
            className="mt-7 grid gap-3"
            aria-label={
              showingFeedback
                ? "Scored practice answer choices"
                : "Practice answer choices"
            }
          >
            {displayedQuestion.choices.map((choice, index) => {
              const selected =
                showingFeedback &&
                visibleFeedback?.selectedChoiceId === choice.id
              const correct =
                showingFeedback &&
                visibleFeedback?.correctChoiceId === choice.id
              return (
                <label
                  key={choice.id}
                  className={cn(
                    "grid min-h-16 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center rounded-lg border border-border bg-background px-4 py-3 text-base leading-6 transition-[border-color,background-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
                    showingFeedback
                      ? "cursor-default"
                      : "cursor-pointer hover:border-primary",
                    !showingFeedback &&
                      selectedChoice === choice.id &&
                      "border-primary bg-secondary",
                    correct && "border-primary bg-secondary",
                    selected &&
                      !correct &&
                      "border-[var(--scout-coral)] bg-[var(--coach-surface)]"
                  )}
                >
                  <VisuallyHiddenRadioGroupItem
                    value={choice.id}
                    disabled={showingFeedback}
                  />
                  <span className="font-mono font-bold text-primary">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="min-w-0">{choice.text}</span>
                  {correct ? (
                    <span className="ml-3 text-xs font-bold text-primary">
                      Correct
                    </span>
                  ) : selected ? (
                    <span className="ml-3 text-xs font-bold text-[var(--scout-coral-text)]">
                      Your choice
                    </span>
                  ) : null}
                </label>
              )
            })}
          </RadioGroup>
        ) : null}

        {!showingFeedback && !isExitTicket && hintLevel > 0 ? (
          <div className="mt-5 border-l-4 border-[var(--scout-sun)] bg-[var(--coach-surface)] px-4 py-3">
            <p className="text-sm leading-6">
              {hintLevel === 1
                ? learning.lesson.strategyChecklist[0]
                : learning.lesson.transferPrompt}
            </p>
          </div>
        ) : null}

        {visibleFeedback && explanation ? (
          <div ref={feedbackRef} className="scroll-m-24">
            <Alert
              className="mt-6 border-primary/30 bg-[var(--info-surface)]"
              aria-live="polite"
            >
              {visibleFeedback.correct ? (
                <CheckCircle2Icon />
              ) : (
                <CircleAlertIcon />
              )}
              <AlertTitle>
                {visibleFeedback.correct ? "Correct." : "Not quite."}
              </AlertTitle>
              <AlertDescription>
                {explanation.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 mt-8 flex items-center justify-between gap-3 border-t bg-background/95 py-4 backdrop-blur">
        {!showingFeedback && !isExitTicket ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={hintLevel >= 2}
            onClick={() => setHintLevel((level) => Math.min(2, level + 1))}
          >
            <LightbulbIcon />
            {hintLevel === 0 ? "Hint" : "Another hint"}
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          size="lg"
          onClick={() => {
            if (showingFeedback && visibleFeedback) {
              if (learning.status === "complete") {
                onClose()
                return
              }
              setDismissedFeedbackIdentity(feedbackIdentity ?? null)
              setHintLevel(0)
              onChoiceChange("")
              return
            }
            onSubmitAnswer({
              confidence: "unreported",
              selfCorrected: false,
              responseSeconds: Math.max(
                1,
                Math.round(
                  (window.performance.now() -
                    (startedAt.current ?? window.performance.now())) /
                    1000
                )
              ),
            })
          }}
          disabled={(!showingFeedback && !selectedChoice) || submitting}
        >
          {showingFeedback
            ? learning.status === "complete"
              ? roundComplete
                ? "Choose next assessment"
                : "Back to Today"
              : "Next question"
            : submitting
              ? "Checking…"
              : "Check answer"}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </section>
  )
}

export function LessonWorkspace(props: LessonWorkspaceProps) {
  const lessonSections = lessonSectionsForDisplay(
    props.learning.lesson.sections
  )
  const workspaceTitle =
    props.learning.mode === "checkpoint"
      ? "Mixed quiz"
      : props.learning.mode === "recovery"
        ? "Recovery"
        : props.learning.mastery.label
  const positionLabel = props.learning.lessonComplete
    ? "Practice"
    : `${Math.min(props.activeSection + 1, lessonSections.length)} of ${
        lessonSections.length
      }`
  const segmentMinutes = props.learning.lessonComplete
    ? null
    : lessonSegmentMinutes(
        props.learning.lesson.minutes,
        lessonSections.length,
        props.activeSection
      )

  return (
    <div
      data-hide-global-footer
      className="min-h-[calc(100svh-3.5rem)] bg-background"
    >
      <header className="grid min-h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-border px-4 sm:px-7">
        <Button
          type="button"
          variant="ghost"
          className="justify-self-start px-0 text-primary hover:bg-transparent"
          onClick={props.onClose}
          aria-label="Close lesson workspace"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Back to Today
        </Button>
        <h1 className="max-w-64 truncate text-center text-sm font-bold sm:max-w-md sm:text-base">
          {workspaceTitle}
        </h1>
        <p className="justify-self-end text-sm text-muted-foreground tabular-nums">
          {positionLabel}
          {segmentMinutes === null ? null : (
            <span className="hidden sm:inline"> · {segmentMinutes} min</span>
          )}
        </p>
      </header>

      {!props.learning.lessonComplete ? (
        <nav
          className="mx-auto grid w-full max-w-5xl grid-cols-5 px-3 pt-4 sm:px-7"
          aria-label="Lesson stages"
        >
          {SECTION_SHORT_LABELS.slice(0, lessonSections.length).map(
            (label, index) => (
              <Button
                key={label}
                type="button"
                variant="ghost"
                aria-current={
                  props.activeSection === index ? "step" : undefined
                }
                className={cn(
                  "min-w-0 rounded-none border-b-2 border-border px-1 py-3 text-xs text-muted-foreground sm:text-sm",
                  props.activeSection === index &&
                    "border-primary text-primary hover:text-primary"
                )}
                onClick={() => props.onSectionChange(index)}
              >
                {label}
              </Button>
            )
          )}
        </nav>
      ) : null}

      {props.learning.lessonComplete ? (
        <PracticeStage
          key={
            props.learning.questions[props.learning.currentQuestionIndex]?.id
          }
          {...props}
        />
      ) : (
        <LessonStage {...props} />
      )}
    </div>
  )
}
