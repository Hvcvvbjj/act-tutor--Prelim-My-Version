"use client"

import { useEffect, useRef, useState } from "react"
import type {
  AssessmentRemediationProgress,
  DiagnosticQuestionPublic,
} from "@act-tutor/core"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  MessageCircleQuestionIcon,
} from "lucide-react"

import { ScoutMark } from "@/components/tutor/scout"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  RadioGroup,
  VisuallyHiddenRadioGroupItem,
} from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

export interface AssessmentRemediationItem {
  question: DiagnosticQuestionPublic
  selectedChoiceId: string | null
  correctChoiceId: string
  rationale: string
}

interface ChoiceDraft {
  questionId: string
  choiceId: string
}

interface MessageDraft {
  questionId: string
  message: string
}

export function AssessmentRemediation({
  assessmentLabel,
  progress,
  items,
  onSubmit,
  onComplete,
  onAskMrKim,
}: {
  assessmentLabel: string
  progress: AssessmentRemediationProgress
  items: ReadonlyArray<AssessmentRemediationItem>
  onSubmit: (
    questionId: string,
    choiceId: string
  ) => Promise<AssessmentRemediationProgress>
  onComplete: () => void
  onAskMrKim?: (questionId: string) => void
}) {
  const [choiceDraft, setChoiceDraft] = useState<ChoiceDraft>({
    questionId: "",
    choiceId: "",
  })
  const [busy, setBusy] = useState(false)
  const [messageDraft, setMessageDraft] = useState<MessageDraft | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const corrected = progress.requiredQuestionIds.filter(
    (questionId) => progress.responses[questionId]?.correctedAt
  ).length
  const currentQuestionId = progress.requiredQuestionIds.find(
    (questionId) => !progress.responses[questionId]?.correctedAt
  )
  const current = items.find((item) => item.question.id === currentQuestionId)
  const lastItem = items.at(-1)
  const choiceId =
    choiceDraft.questionId === currentQuestionId ? choiceDraft.choiceId : ""
  const message =
    messageDraft && messageDraft.questionId === currentQuestionId
      ? messageDraft.message
      : null

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true })
      headingRef.current?.scrollIntoView({ block: "start", behavior: "auto" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [currentQuestionId])

  if (progress.status === "complete" || !currentQuestionId) {
    return (
      <section className="mx-auto max-w-3xl py-10 text-center sm:py-16">
        <ScoutMark mood="correct" className="mx-auto size-16" />
        <p className="ink-label mt-5 text-primary">Mr. Kim</p>
        <h1 className="mt-3 font-heading text-4xl leading-tight font-black tracking-[-0.035em] sm:text-5xl">
          Every missed question is cleared.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
          Ask me anything that still feels unclear, or start the next lesson
          round when you&apos;re ready.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {onAskMrKim && lastItem ? (
            <Button
              type="button"
              variant="outline"
              size="xl"
              onClick={() => onAskMrKim(lastItem.question.id)}
            >
              <MessageCircleQuestionIcon data-icon="inline-start" />
              Ask Mr. Kim
            </Button>
          ) : null}
          <Button type="button" size="xl" onClick={onComplete}>
            Start my next lesson round
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </section>
    )
  }

  if (!current) {
    return (
      <section className="mx-auto max-w-2xl py-12">
        <h1 className="font-heading text-4xl font-black">
          This review item could not load.
        </h1>
        <p className="mt-4 text-muted-foreground">
          Return to the assessment results and try again.
        </p>
      </section>
    )
  }
  const activeItem = current

  const selectedText =
    activeItem.question.choices.find(
      (choice) => choice.id === activeItem.selectedChoiceId
    )?.text ?? "Unanswered"
  const correctText =
    activeItem.question.choices.find(
      (choice) => choice.id === activeItem.correctChoiceId
    )?.text ?? "Correct answer"

  async function checkAnswer() {
    if (!choiceId || busy) return
    setBusy(true)
    setMessageDraft(null)
    try {
      const next = await onSubmit(activeItem.question.id, choiceId)
      if (!next.responses[activeItem.question.id]?.correctedAt) {
        setMessageDraft({
          questionId: activeItem.question.id,
          message:
            "Not quite. Read Mr. Kim’s explanation once more, then choose the answer it supports.",
        })
      }
    } catch (error) {
      setMessageDraft({
        questionId: activeItem.question.id,
        message:
          error instanceof Error
            ? error.message
            : "This answer could not be checked.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto max-w-5xl py-8 sm:py-12">
      <Progress
        value={(corrected / progress.requiredQuestionIds.length) * 100}
        aria-label={`${corrected} of ${progress.requiredQuestionIds.length} missed questions corrected`}
      />
      <div className="mt-6 grid overflow-hidden rounded-2xl border bg-background lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <div className="p-5 sm:p-8">
          <p className="ink-label text-primary">
            {assessmentLabel} review · {corrected + 1}/
            {progress.requiredQuestionIds.length}
          </p>
          {current.question.stimulus ? (
            <details className="mt-5 border-y py-4">
              <summary className="cursor-pointer font-heading text-xl font-black">
                Read the passage
              </summary>
              <p className="mt-4 text-sm leading-7 whitespace-pre-line">
                {current.question.stimulus}
              </p>
            </details>
          ) : null}
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-5 scroll-mt-6 font-heading text-3xl leading-tight font-black tracking-[-0.025em] outline-none sm:text-4xl"
          >
            {current.question.prompt}
          </h1>
          <RadioGroup
            value={choiceId}
            onValueChange={(nextChoiceId) =>
              setChoiceDraft({
                questionId: activeItem.question.id,
                choiceId: nextChoiceId,
              })
            }
            aria-label="Review answer choices"
            className="mt-7 gap-3"
          >
            {current.question.choices.map((choice, index) => (
              <label
                key={choice.id}
                className={cn(
                  "grid cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)] items-start rounded-xl border-2 border-border p-4 text-sm leading-6 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 hover:border-foreground sm:text-base",
                  choiceId === choice.id && "border-primary bg-secondary"
                )}
              >
                <VisuallyHiddenRadioGroupItem value={choice.id} />
                <strong className="font-mono text-primary">
                  {String.fromCharCode(65 + index)}
                </strong>
                <span>{choice.text}</span>
              </label>
            ))}
          </RadioGroup>
          {message ? (
            <p
              className="mt-4 rounded-xl bg-[var(--coach-surface)] p-4 text-sm font-semibold"
              role="status"
            >
              {message}
            </p>
          ) : null}
          <Button
            type="button"
            size="xl"
            className="mt-6 w-full sm:w-auto"
            disabled={!choiceId || busy}
            onClick={() => void checkAnswer()}
          >
            {busy ? "Checking…" : "Check answer"}
            <CheckCircle2Icon data-icon="inline-end" />
          </Button>
        </div>

        <aside className="border-t bg-[var(--coach-surface)] p-5 sm:p-8 lg:border-t-0 lg:border-l">
          <div className="flex items-center gap-3">
            <ScoutMark mood="thinking" className="size-12" />
            <div>
              <p className="ink-label text-primary">Mr. Kim</p>
              <h2 className="mt-1 font-heading text-2xl font-black">
                Let&apos;s fix this one.
              </h2>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 text-sm leading-6">
            <div>
              <dt className="font-bold text-muted-foreground">Your answer</dt>
              <dd className="mt-1">{selectedText}</dd>
            </div>
            <div>
              <dt className="font-bold text-muted-foreground">
                Correct answer
              </dt>
              <dd className="mt-1 font-semibold">{correctText}</dd>
            </div>
          </dl>
          <div className="mt-6 border-t pt-5">
            <p className="font-heading text-xl font-black">Why</p>
            <p className="mt-2 text-sm leading-7">{current.rationale}</p>
          </div>
          {onAskMrKim ? (
            <Button
              type="button"
              variant="outline"
              className="mt-6 w-full"
              onClick={() => onAskMrKim(current.question.id)}
            >
              <MessageCircleQuestionIcon data-icon="inline-start" />
              Ask Mr. Kim about this
            </Button>
          ) : null}
        </aside>
      </div>
    </section>
  )
}
