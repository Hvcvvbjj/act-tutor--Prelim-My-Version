"use client"

import {
  examLabInterpretationReadiness,
  type ExamLabSessionPayload,
} from "@act-tutor/core"
import { ArrowLeftIcon, BookmarkIcon, SaveIcon, SendIcon } from "lucide-react"

import { examLabReviewCopy } from "@/components/tutor/exam-lab-review-copy"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ExamLabReviewProps {
  session: ExamLabSessionPayload
  busy: boolean
  assessmentLabel?: string
  onReturn: (index: number) => void
  onSubmit: () => void
}

export function ExamLabReview({
  session,
  busy,
  assessmentLabel = "Timed Practice",
  onReturn,
  onSubmit,
}: ExamLabReviewProps) {
  const answered = session.questions.filter(
    (question) => session.progress.responses[question.id]?.choiceId
  ).length
  const flagged = session.questions.filter(
    (question) => session.progress.responses[question.id]?.flagged
  ).length
  const unanswered = session.questions.length - answered
  const readiness = examLabInterpretationReadiness({
    mode: session.mode,
    total: session.questions.length,
    unanswered,
  })
  const copy = examLabReviewCopy({
    assessmentLabel,
    busy,
    sufficient: readiness.sufficient,
    unanswered,
  })
  return (
    <main
      data-hide-global-footer
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 lg:py-14"
    >
      <section>
        <p className="ink-label text-primary">
          {assessmentLabel} · Final review
        </p>
        <h1 className="mt-3 font-heading text-4xl leading-[1.02] font-black tracking-[-0.03em] sm:text-5xl">
          {copy.heading}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          {copy.description}
        </p>

        <dl className="mt-7 flex flex-wrap gap-x-6 gap-y-2 border-y-2 border-foreground py-4 text-sm">
          <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">Answered</dt>
            <dd className="font-bold tabular-nums">{answered}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">Flagged</dt>
            <dd className="font-bold text-[var(--scout-coral-text)] tabular-nums">
              {flagged}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">Blank</dt>
            <dd className="font-bold tabular-nums">{unanswered}</dd>
          </div>
        </dl>

        <div className="mt-7 flex flex-wrap gap-3">
          <Button type="button" size="xl" onClick={onSubmit} disabled={busy}>
            {copy.submitLabel}
            {readiness.sufficient ? (
              <SendIcon data-icon="inline-end" />
            ) : (
              <SaveIcon data-icon="inline-end" />
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xl"
            onClick={() => onReturn(session.progress.currentIndex)}
            disabled={busy}
          >
            <ArrowLeftIcon data-icon="inline-start" /> Return to questions
          </Button>
        </div>

        <details className="group mt-8 border-y-2 border-foreground">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-bold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <span>Review individual questions</span>
            <span className="text-sm text-muted-foreground">
              {session.questions.length} questions
            </span>
          </summary>
          <ol className="mt-8 border-t-2 border-foreground">
            {session.questions.map((question, index) => {
              const response = session.progress.responses[question.id]
              return (
                <li
                  key={question.id}
                  className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-4 border-b py-4"
                >
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center border-2 border-foreground font-mono text-xs font-bold",
                      response?.choiceId
                        ? "bg-secondary"
                        : "bg-[var(--coach-surface)]"
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {question.skillLabel}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground capitalize">
                      <span>{question.section}</span>
                      <span>
                        {response?.choiceId ? "Answered" : "Unanswered"}
                      </span>
                      {response?.flagged ? (
                        <span className="inline-flex items-center gap-1 text-[var(--destructive)]">
                          <BookmarkIcon className="size-3 fill-current" />{" "}
                          Flagged
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onReturn(index)}
                  >
                    Reopen
                  </Button>
                </li>
              )
            })}
          </ol>
        </details>
      </section>
    </main>
  )
}
