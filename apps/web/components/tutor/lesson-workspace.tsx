"use client"

import { useEffect, useRef, useState } from "react"
import type {
  AnswerConfidence,
  LearningSessionPayload,
  LessonCheckResult,
} from "@act-tutor/core"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  LightbulbIcon,
  Volume2Icon,
} from "lucide-react"

import { useScoutContext } from "@/components/tutor/scout-assistant"
import { ScoutMark } from "@/components/tutor/scout"
import {
  PRACTICE_DIFFICULTY_LABELS,
  PRACTICE_DIFFICULTY_STYLES,
} from "@/components/tutor/assessment-display"
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
  onSubmitRemediation: (questionId: string, choiceId: string) => void
  onClose: () => void
}

const SECTION_SHORT_LABELS = [
  "Type",
  "Idea",
  "Example",
  "Method",
  "Need to know",
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

function RemediationStage({
  learning,
  selectedChoice,
  submitting,
  onChoiceChange,
  onSubmitRemediation,
  onClose,
}: Pick<
  LessonWorkspaceProps,
  | "learning"
  | "selectedChoice"
  | "submitting"
  | "onChoiceChange"
  | "onSubmitRemediation"
  | "onClose"
>) {
  const remediation = learning.remediation
  const { openScout } = useScoutContext()
  if (!remediation) return null
  const requiredQuestionIds = remediation.progress.requiredQuestionIds
  const correctedCount = requiredQuestionIds.filter(
    (questionId) =>
      remediation.progress.responses[questionId]?.correctedAt !== null &&
      remediation.progress.responses[questionId]?.correctedAt !== undefined
  ).length
  const currentQuestionId = requiredQuestionIds.find(
    (questionId) => !remediation.progress.responses[questionId]?.correctedAt
  )
  const currentItem = remediation.items.find(
    (item) => item.questionId === currentQuestionId
  )
  const currentQuestion = learning.questions.find(
    (question) => question.id === currentQuestionId
  )
  const currentResponse = currentQuestionId
    ? remediation.progress.responses[currentQuestionId]
    : undefined

  if (remediation.progress.status === "complete") {
    return (
      <section className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-3xl flex-col justify-center px-5 py-12 text-center sm:px-8">
        <ScoutMark className="mx-auto size-20 border-2 border-primary" />
        <p className="ink-label mt-6 text-primary">Review complete</p>
        <h2 className="mt-3 font-heading text-5xl leading-tight font-black tracking-[-0.03em]">
          You fixed every miss.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
          Mr. Kim marked this lesson complete. Your next lesson is ready.
        </p>
        <div className="mx-auto mt-7 flex flex-wrap justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() =>
              openScout(
                `I finished reviewing ${learning.lesson.title}. What should I remember?`,
                requiredQuestionIds.at(-1)
              )
            }
          >
            Ask Mr. Kim
          </Button>
          <Button type="button" size="lg" onClick={onClose}>
            Back to Lessons
          </Button>
        </div>
      </section>
    )
  }

  if (!currentItem || !currentQuestion || !currentQuestionId) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-16">
        <Alert role="alert">
          <CircleAlertIcon />
          <AlertTitle>This review could not load</AlertTitle>
          <AlertDescription>
            Return to Lessons and reopen this review.
          </AlertDescription>
        </Alert>
      </section>
    )
  }

  return (
    <section className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-3xl flex-col px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex items-center gap-4 border-b pb-5">
        <ScoutMark className="size-14 shrink-0 border-2 border-primary" />
        <div>
          <p className="ink-label text-primary">Mr. Kim · Required review</p>
          <h2 className="mt-1 font-heading text-3xl leading-tight font-black">
            Let&apos;s fix each missed question.
          </h2>
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-xl border bg-secondary p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="font-bold">
            Lesson check: {remediation.correct} of {remediation.total}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Your goal requires {remediation.requiredCorrect} of 5. Correct every
            missed item below before the next lesson opens.
          </p>
        </div>
        <p className="font-mono text-sm font-bold text-primary">
          {correctedCount} / {requiredQuestionIds.length} fixed
        </p>
      </div>

      <Progress
        className="mt-5"
        value={(correctedCount / requiredQuestionIds.length) * 100}
      >
        <ProgressLabel className="sr-only">
          Required lesson review progress
        </ProgressLabel>
      </Progress>

      <div className="mt-8 flex-1">
        <p className="ink-label text-muted-foreground">
          Miss {correctedCount + 1} of {requiredQuestionIds.length}
        </p>
        <h3 className="mt-3 font-heading text-3xl leading-tight font-black">
          {currentItem.prompt}
        </h3>

        <div className="mt-6 border-l-4 border-[var(--scout-coral)] bg-[var(--coach-surface)] px-5 py-4">
          <p className="font-bold">
            You chose: {currentItem.selectedChoiceText}
          </p>
          <p className="mt-2 font-bold text-primary">
            Correct answer: {currentItem.correctChoiceText}
          </p>
          <p className="mt-3 leading-7 text-foreground/85">
            {currentItem.rationale}
          </p>
          {currentItem.misconception ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              What went wrong: {currentItem.misconception}
            </p>
          ) : null}
          <Button
            type="button"
            variant="link"
            className="mt-3 h-auto min-h-11 px-0"
            onClick={() =>
              openScout(
                `Explain why the correct answer to this ${currentItem.skillLabel} question works.`,
                currentQuestionId
              )
            }
          >
            Ask Mr. Kim about this question
          </Button>
        </div>

        <p className="mt-7 text-sm font-bold">Now choose the correct answer.</p>
        <RadioGroup
          value={selectedChoice}
          onValueChange={onChoiceChange}
          className="mt-3 grid gap-3"
          aria-label="Required review answer choices"
        >
          {currentQuestion.choices.map((choice, index) => (
            <label
              key={choice.id}
              className={cn(
                "grid min-h-16 cursor-pointer grid-cols-[2.5rem_minmax(0,1fr)] items-center rounded-lg border bg-background px-4 py-3 leading-6 transition-colors focus-within:ring-3 focus-within:ring-ring/50",
                selectedChoice === choice.id
                  ? "border-primary bg-secondary"
                  : "border-border hover:border-primary"
              )}
            >
              <VisuallyHiddenRadioGroupItem value={choice.id} />
              <span className="font-mono font-bold text-primary">
                {String.fromCharCode(65 + index)}
              </span>
              <span>{choice.text}</span>
            </label>
          ))}
        </RadioGroup>

        {currentResponse && !currentResponse.correctedAt ? (
          <Alert
            className="mt-5 border-[var(--scout-coral)] bg-[var(--coach-surface)]"
            aria-live="polite"
          >
            <CircleAlertIcon />
            <AlertTitle>Try this one again.</AlertTitle>
            <AlertDescription>
              Use Mr. Kim&apos;s explanation above, then choose the correct
              answer.
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="sticky bottom-0 mt-8 flex justify-end border-t bg-background/95 py-4 backdrop-blur">
        <Button
          type="button"
          size="lg"
          disabled={!selectedChoice || submitting}
          onClick={() => onSubmitRemediation(currentQuestionId, selectedChoice)}
        >
          {submitting ? "Checking…" : "Check answer"}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
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
            ? "You can retry it from Lessons."
            : roundComplete
              ? "Pick the test that builds your next lesson round."
              : `Next: ${currentRecommendation.label}.`}
        </p>
        <Button
          type="button"
          size="lg"
          className="mx-auto mt-7"
          onClick={onClose}
        >
          {roundComplete ? "Continue" : "Back to Lessons"}
        </Button>
      </section>
    )
  }

  return (
    <section
      data-practice-workspace
      className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-3xl flex-col px-5 py-8 sm:px-8 sm:py-10"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {displayedQuestion ? (
          <span
            data-testid="practice-difficulty"
            data-difficulty={displayedQuestion.difficulty}
            className={cn(
              "inline-flex min-h-7 items-center rounded-full border px-3 font-mono text-[0.68rem] font-bold tracking-wide uppercase",
              PRACTICE_DIFFICULTY_STYLES[displayedQuestion.difficulty]
            )}
            aria-label={`Difficulty: ${PRACTICE_DIFFICULTY_LABELS[displayedQuestion.difficulty]}`}
          >
            {PRACTICE_DIFFICULTY_LABELS[displayedQuestion.difficulty]}
          </span>
        ) : (
          <span />
        )}
        <p className="text-sm text-muted-foreground tabular-nums">
          Question {displayedQuestionIndex + 1} of {learning.questions.length}
        </p>
      </div>
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
                : "Back to Lessons"
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
  const workspaceTitle = props.learning.remediation
    ? "Review with Mr. Kim"
    : props.learning.mode === "checkpoint"
      ? "Mixed quiz"
      : props.learning.mode === "recovery"
        ? "Recovery"
        : props.learning.mastery.label
  const positionLabel = props.learning.remediation
    ? props.learning.remediation.progress.status === "complete"
      ? "Complete"
      : "Required review"
    : props.learning.lessonComplete
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
          Back to Lessons
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

      {!props.learning.lessonComplete && !props.learning.remediation ? (
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

      {props.learning.remediation ? (
        <RemediationStage {...props} />
      ) : props.learning.lessonComplete ? (
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

export function LessonReviewWorkspace({
  review,
  activeSection,
  onSectionChange,
  onClose,
}: {
  review: LessonCheckResult
  activeSection: number
  onSectionChange: (index: number) => void
  onClose: () => void
}) {
  const lessonSections = lessonSectionsForDisplay(review.lesson.sections)
  const visibleSectionIndex = Math.min(
    activeSection,
    Math.max(0, lessonSections.length - 1)
  )
  const section =
    lessonSections[visibleSectionIndex] ?? review.lesson.sections[0]!
  const isLast = visibleSectionIndex === lessonSections.length - 1
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [visibleSectionIndex])

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
          onClick={onClose}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Back to Lessons
        </Button>
        <h1 className="max-w-64 truncate text-center text-sm font-bold sm:max-w-md sm:text-base">
          {review.lesson.title}
        </h1>
        <p className="justify-self-end text-sm text-muted-foreground tabular-nums">
          Review · {review.correct}/5
        </p>
      </header>

      <nav
        className="mx-auto grid w-full max-w-5xl grid-cols-5 px-3 pt-4 sm:px-7"
        aria-label="Completed lesson stages"
      >
        {SECTION_SHORT_LABELS.slice(0, lessonSections.length).map(
          (label, index) => (
            <Button
              key={label}
              type="button"
              variant="ghost"
              aria-current={visibleSectionIndex === index ? "step" : undefined}
              className={cn(
                "min-w-0 rounded-none border-b-2 border-border px-1 py-3 text-xs text-muted-foreground sm:text-sm",
                visibleSectionIndex === index &&
                  "border-primary text-primary hover:text-primary"
              )}
              onClick={() => onSectionChange(index)}
            >
              {label}
            </Button>
          )
        )}
      </nav>

      <section className="mx-auto flex min-h-[calc(100svh-9rem)] w-full max-w-3xl flex-col px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex-1">
          <p className="ink-label text-primary">
            Round {review.roundNumber} · Completed lesson
          </p>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="mt-3 max-w-2xl font-heading text-3xl leading-tight font-black tracking-[-0.025em] outline-none sm:text-5xl"
          >
            {section.title}
          </h2>
          {section.id !== "guided-example" && section.id !== "decision-rule" ? (
            <p className="mt-5 max-w-2xl text-lg leading-8 text-foreground/85 sm:text-xl sm:leading-9">
              {section.explanation}
            </p>
          ) : null}

          {section.id === "guided-example" ? (
            <div className="mt-8 border-y border-border py-6">
              <p className="ink-label text-muted-foreground">Worked example</p>
              <p className="mt-3 text-lg leading-7 font-semibold">
                {review.lesson.workedExample.prompt}
              </p>
              <p className="mt-4 border-l-4 border-[var(--scout-sun)] pl-4 leading-7 text-muted-foreground">
                {review.lesson.workedExample.explanation.join(" ")}
              </p>
              <p className="mt-4 font-semibold">
                Answer: {review.lesson.workedExample.answer}
              </p>
            </div>
          ) : null}

          {section.id === "decision-rule" ? (
            <ol className="mt-8 border-y border-border">
              {review.lesson.strategyChecklist.map((step, index) => (
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
            <Button type="button" size="lg" onClick={onClose}>
              Back to Lessons
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
    </div>
  )
}
