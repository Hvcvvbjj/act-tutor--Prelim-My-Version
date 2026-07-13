"use client"

import type {
  DiagnosticQuestionPublic,
  ExamConfidence,
  ExamLabSessionPayload,
} from "@act-tutor/core"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookmarkIcon,
  CheckCircle2Icon,
  Clock3Icon,
  Grid3X3Icon,
  SaveIcon,
  SendIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

interface ExamLabRunnerProps {
  session: ExamLabSessionPayload
  timeLeft: number
  saveStatus: "saved" | "saving" | "error"
  busy: boolean
  onAnswer: (choiceId: string) => void
  onConfidence: (confidence: ExamConfidence) => void
  onToggleFlag: () => void
  onMove: (index: number) => void
  onEndSection: () => void
}

function formatTime(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  const remainder = Math.max(0, seconds) % 60
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
}

function QuestionNavigator({
  session,
  questions,
  onMove,
}: {
  session: ExamLabSessionPayload
  questions: ReadonlyArray<DiagnosticQuestionPublic>
  onMove: (index: number) => void
}) {
  return (
    <nav aria-label="Question navigator">
      <div className="flex items-center justify-between gap-3">
        <p className="ink-label text-muted-foreground">Question map</p>
        <Grid3X3Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="mt-3 grid grid-cols-6 gap-2 lg:grid-cols-5">
        {questions.map((question) => {
          const globalIndex = session.questions.findIndex(
            (item) => item.id === question.id
          )
          const response = session.progress.responses[question.id]
          const current = globalIndex === session.progress.currentIndex
          return (
            <button
              key={question.id}
              type="button"
              aria-label={`Question ${globalIndex + 1}${response?.flagged ? ", flagged" : response?.choiceId ? ", answered" : ", unanswered"}`}
              aria-current={current ? "step" : undefined}
              className={cn(
                "relative flex aspect-square items-center justify-center border-2 border-border bg-background font-mono text-xs font-bold transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                response?.choiceId && "border-primary bg-secondary",
                current &&
                  "border-foreground bg-[var(--coach-surface)] shadow-[2px_2px_0_var(--foreground)]"
              )}
              onClick={() => onMove(globalIndex)}
            >
              {globalIndex + 1}
              {response?.flagged ? (
                <BookmarkIcon className="absolute -top-1 -right-1 size-3 fill-[var(--scout-coral)] text-[var(--scout-coral)]" />
              ) : null}
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[0.68rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 bg-primary" /> Answered
        </span>
        <span className="inline-flex items-center gap-1">
          <BookmarkIcon className="size-3 text-[var(--scout-coral)]" /> Flagged
        </span>
      </div>
    </nav>
  )
}

export function ExamLabRunner({
  session,
  timeLeft,
  saveStatus,
  busy,
  onAnswer,
  onConfidence,
  onToggleFlag,
  onMove,
  onEndSection,
}: ExamLabRunnerProps) {
  const question = session.questions[session.progress.currentIndex]
  const response = session.progress.responses[question.id]
  const navigationSection =
    session.progress.phase === "review"
      ? question.section
      : session.progress.currentSection
  const sectionQuestions =
    navigationSection === "mixed"
      ? session.questions
      : session.questions.filter((item) => item.section === navigationSection)
  const sectionPosition = sectionQuestions.findIndex(
    (item) => item.id === question.id
  )
  const progress = Math.round(
    ((sectionPosition + 1) / sectionQuestions.length) * 100
  )
  const timeCritical = timeLeft <= 60
  const sectionName =
    navigationSection === "mixed"
      ? "Mixed sprint"
      : `${navigationSection[0].toUpperCase()}${navigationSection.slice(1)}`

  return (
    <main className="min-h-[calc(100svh-5rem)] bg-[var(--rail)]">
      <header className="sticky top-0 z-30 border-b-2 border-foreground bg-background">
        <div className="mx-auto grid max-w-[100rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-7 lg:grid-cols-[1fr_auto_1fr]">
          <div>
            <p className="ink-label text-primary">Test Day Lab</p>
            <p className="mt-1 truncate font-heading text-xl font-bold">
              {session.title}
            </p>
          </div>
          <div
            className={cn(
              "flex items-center gap-3 border-2 border-foreground px-4 py-2",
              timeCritical &&
                "border-[var(--scout-coral)] bg-[var(--coach-surface)] text-[var(--destructive)]"
            )}
          >
            <Clock3Icon
              className={cn("size-5", timeCritical && "animate-pulse")}
              aria-hidden="true"
            />
            <div>
              <p className="ink-label">{sectionName}</p>
              <p className="font-mono text-xl font-black tabular-nums">
                {formatTime(timeLeft)}
              </p>
            </div>
          </div>
          <div className="col-span-2 flex items-center justify-between gap-4 lg:col-span-1 lg:justify-self-end">
            <span
              className={cn(
                "inline-flex items-center gap-2 text-xs font-semibold",
                saveStatus === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {saveStatus === "saved" ? (
                <CheckCircle2Icon className="size-4 text-primary" />
              ) : (
                <SaveIcon className="size-4" />
              )}
              {saveStatus === "saved"
                ? "Saved"
                : saveStatus === "saving"
                  ? "Saving…"
                  : "Save failed"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEndSection}
              disabled={busy}
            >
              {session.progress.phase === "review"
                ? "Return to review"
                : timeLeft === 0
                  ? "Time expired"
                  : "End section"}
              <SendIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
        <Progress value={progress} className="h-1 rounded-none border-0">
          <ProgressLabel className="sr-only">Section progress</ProgressLabel>
        </Progress>
      </header>

      <div className="mx-auto grid max-w-[100rem] lg:grid-cols-[minmax(20rem,0.9fr)_minmax(26rem,1.1fr)_16rem]">
        <section className="hidden min-w-0 border-b bg-background px-5 py-7 sm:px-8 lg:block lg:min-h-[calc(100svh-10rem)] lg:border-r lg:border-b-0">
          {question.stimulus ? (
            <>
              <p className="ink-label text-muted-foreground">
                {question.passageTitle ?? `${sectionName} stimulus`}
              </p>
              <article className="mt-5 text-base leading-8 whitespace-pre-line">
                {question.stimulus}
              </article>
            </>
          ) : (
            <div className="flex min-h-[30rem] items-center justify-center">
              <div className="max-w-xs text-center">
                <p className="font-heading text-4xl font-bold">
                  No passage for this item.
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Use this space to sketch, calculate, or slow down your first
                  step.
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="min-w-0 bg-background px-5 py-7 sm:px-8 sm:py-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="ink-label text-primary">
              Question {session.progress.currentIndex + 1} of{" "}
              {session.questions.length}
            </p>
            <Button
              type="button"
              variant={response?.flagged ? "default" : "outline"}
              size="sm"
              onClick={onToggleFlag}
            >
              <BookmarkIcon
                data-icon="inline-start"
                className={cn(response?.flagged && "fill-current")}
              />
              {response?.flagged ? "Flagged" : "Flag for review"}
            </Button>
          </div>
          {question.stimulus ? (
            <details className="mt-5 border-y-2 border-foreground py-4 lg:hidden">
              <summary className="cursor-pointer font-heading text-xl font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                Read passage: {question.passageTitle ?? "Current passage"}
              </summary>
              <article className="mt-4 text-sm leading-7 whitespace-pre-line">
                {question.stimulus}
              </article>
            </details>
          ) : null}
          {question.lineReference ? (
            <p className="mt-3 font-mono text-xs font-bold text-muted-foreground">
              {question.lineReference}
            </p>
          ) : null}
          <h1 className="mt-5 font-heading text-3xl leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
            {question.prompt}
          </h1>

          <RadioGroup
            value={response?.choiceId ?? ""}
            onValueChange={onAnswer}
            className="mt-7 grid gap-3"
            aria-label="Exam answer choices"
          >
            {question.choices.map((choice, index) => (
              <label
                key={choice.id}
                className={cn(
                  "grid cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)] border-2 border-border bg-background px-4 py-4 text-sm leading-6 transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-foreground sm:text-base",
                  response?.choiceId === choice.id &&
                    "border-primary bg-secondary"
                )}
              >
                <RadioGroupItem value={choice.id} className="sr-only" />
                <span className="col-start-1 row-start-1 font-mono font-bold text-primary">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="col-start-2 row-start-1 min-w-0">
                  {choice.text}
                </span>
              </label>
            ))}
          </RadioGroup>

          <fieldset className="mt-7 border-y py-5">
            <legend className="ink-label text-muted-foreground">
              How sure are you?
            </legend>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["guess", "unsure", "sure"] as const).map((confidence) => (
                <Button
                  key={confidence}
                  type="button"
                  variant={
                    response?.confidence === confidence && response.choiceId
                      ? "default"
                      : "outline"
                  }
                  className="capitalize"
                  onClick={() => onConfidence(confidence)}
                  disabled={!response?.choiceId}
                >
                  {confidence}
                </Button>
              ))}
            </div>
          </fieldset>

          <div className="mt-7 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onMove(
                  session.questions.findIndex(
                    (item) =>
                      item.id === sectionQuestions[sectionPosition - 1]?.id
                  )
                )
              }
              disabled={sectionPosition <= 0 || busy}
            >
              <ArrowLeftIcon data-icon="inline-start" /> Previous
            </Button>
            {session.progress.phase === "review" ? (
              <Button type="button" onClick={onEndSection} disabled={busy}>
                Return to review <ArrowRightIcon data-icon="inline-end" />
              </Button>
            ) : sectionPosition === sectionQuestions.length - 1 ? (
              <Button type="button" onClick={onEndSection} disabled={busy}>
                Review section <ArrowRightIcon data-icon="inline-end" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() =>
                  onMove(
                    session.questions.findIndex(
                      (item) =>
                        item.id === sectionQuestions[sectionPosition + 1]?.id
                    )
                  )
                }
                disabled={busy}
              >
                Next <ArrowRightIcon data-icon="inline-end" />
              </Button>
            )}
          </div>
        </section>

        <aside className="border-t bg-[var(--rail)] px-5 py-6 lg:sticky lg:top-[8.5rem] lg:h-[calc(100svh-8.5rem)] lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <QuestionNavigator
            session={session}
            questions={sectionQuestions}
            onMove={onMove}
          />
          <div className="mt-7 border-t pt-5 text-xs leading-5 text-muted-foreground">
            <p className="font-semibold text-foreground">
              No correctness during the run.
            </p>
            <p className="mt-1">
              Scout waits until you submit before showing the answers.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}
