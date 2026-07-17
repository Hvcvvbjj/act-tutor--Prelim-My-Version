"use client"

import type { ExamLabSessionPayload } from "@act-tutor/core"
import {
  ArrowLeftIcon,
  BookmarkIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  SendIcon,
} from "lucide-react"

import { ScoutCoach } from "@/components/tutor/scout"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ExamLabReviewProps {
  session: ExamLabSessionPayload
  busy: boolean
  onReturn: (index: number) => void
  onSubmit: () => void
}

export function ExamLabReview({
  session,
  busy,
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
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)] lg:gap-16">
        <section>
          <p className="ink-label text-primary">Final review</p>
          <h1 className="mt-3 font-heading text-5xl leading-[0.94] font-black tracking-[-0.035em] sm:text-7xl">
            Check every answer.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            The correct answers are still hidden. Reopen anything blank,
            flagged, or marked as a guess before you submit.
          </p>

          <dl className="mt-8 grid grid-cols-3 divide-x-2 divide-foreground border-y-2 border-foreground py-5 text-center">
            <div>
              <dt className="ink-label text-muted-foreground">Answered</dt>
              <dd className="mt-2 font-heading text-4xl font-black">
                {answered}
              </dd>
            </div>
            <div>
              <dt className="ink-label text-muted-foreground">Flagged</dt>
              <dd className="mt-2 font-heading text-4xl font-black text-[var(--scout-coral)]">
                {flagged}
              </dd>
            </div>
            <div>
              <dt className="ink-label text-muted-foreground">Blank</dt>
              <dd className="mt-2 font-heading text-4xl font-black">
                {unanswered}
              </dd>
            </div>
          </dl>

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
                        {response?.choiceId
                          ? `Answered · ${response.confidence}`
                          : "Unanswered"}
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
        </section>

        <aside className="lg:pt-8">
          <ScoutCoach
            mood={unanswered ? "repair" : "ready"}
            message={
              unanswered
                ? `${unanswered} unanswered question${unanswered === 1 ? " remains" : "s remain"}. Blank answers count as wrong.`
                : "Every question has an answer. Submit when your sure, unsure, and guess labels feel honest."
            }
            detail="After you submit, Scout shows what you missed, where you ran out of time, and when you felt sure but were wrong."
          />
          <div className="mt-8 border-y-2 border-foreground py-6">
            <p className="flex items-center gap-2 font-semibold">
              <CheckCircle2Icon className="text-primary" /> Answer keys stayed
              hidden
            </p>
            <p className="mt-3 flex items-center gap-2 font-semibold">
              <CircleAlertIcon className="text-[var(--scout-coral)]" />{" "}
              Submission cannot be edited
            </p>
          </div>
          <Button
            type="button"
            size="xl"
            className="mt-7 w-full"
            onClick={onSubmit}
            disabled={busy}
          >
            {busy ? "Building your report…" : "Score this practice test"}
            <SendIcon data-icon="inline-end" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full"
            onClick={() => onReturn(session.progress.currentIndex)}
            disabled={busy}
          >
            <ArrowLeftIcon data-icon="inline-start" /> Return to questions
          </Button>
        </aside>
      </div>
    </main>
  )
}
