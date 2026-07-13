"use client"

import type { ExamLabSessionPayload } from "@act-tutor/core"
import {
  ArrowRightIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  Clock3Icon,
  GaugeIcon,
  RotateCcwIcon,
  SparklesIcon,
  TargetIcon,
} from "lucide-react"

import { ScoutCoach } from "@/components/tutor/scout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ExamLabReportProps {
  session: ExamLabSessionPayload
  onNewRun: () => void
}

const SECTION_LABEL = { english: "English", math: "Math", reading: "Reading" } as const
const CONFIDENCE_LABEL = { guess: "Guess", unsure: "Unsure", sure: "Sure" } as const

function MetricBar({ value, color = "var(--primary)" }: { value: number; color?: string }) {
  return (
    <span className="mt-2 block h-2 overflow-hidden bg-muted" aria-hidden="true">
      <span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </span>
  )
}

export function ExamLabReport({ session, onNewRun }: ExamLabReportProps) {
  const result = session.result
  if (!result) return null
  const questionMap = new Map(session.questions.map((question) => [question.id, question]))
  const estimateLabel = result.practiceEstimate.composite ? "Practice Composite estimate" : "Practice section estimate"
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
      <section className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.7fr)] lg:gap-16">
        <div>
          <p className="ink-label text-primary">Test Day Lab report</p>
          <h1 className="mt-3 font-heading text-6xl leading-[0.9] font-black tracking-[-0.04em] sm:text-8xl">The clock changed the evidence.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">This report separates what you knew, how you spent time, and how accurately you judged your own certainty.</p>

          <div className="mt-9 grid border-y-2 border-foreground sm:grid-cols-[1.2fr_0.8fr] sm:divide-x-2 sm:divide-foreground">
            <div className="py-6 sm:pr-8">
              <p className="ink-label text-muted-foreground">{estimateLabel}</p>
              <p className="mt-2 font-heading text-7xl font-black text-primary tabular-nums">
                {result.practiceEstimate.low}–{result.practiceEstimate.high}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Midpoint {result.practiceEstimate.estimate} · original practice content</p>
            </div>
            <div className="border-t-2 border-foreground py-6 sm:border-t-0 sm:pl-8">
              <p className="ink-label text-muted-foreground">Decisions correct</p>
              <p className="mt-2 font-heading text-6xl font-black tabular-nums">{Math.round(result.accuracy * 100)}%</p>
              <p className="mt-2 text-sm text-muted-foreground">{result.correct}/{result.total} · {result.unanswered} unanswered</p>
            </div>
          </div>
        </div>
        <aside className="lg:pt-8">
          <ScoutCoach mood="correct" message={result.debrief.headline} detail={result.debrief.summary} />
          <div className="mt-7 border-y-2 border-foreground py-5 text-sm leading-6">
            <p className="inline-flex items-center gap-2 font-semibold">
              {result.debrief.generation.mode === "ai" ? <SparklesIcon className="text-primary" /> : <CheckCircle2Icon className="text-primary" />}
              {result.debrief.generation.mode === "ai" ? `AI debrief · ${result.debrief.generation.model}` : "Reviewed fallback debrief"}
            </p>
            <p className="mt-2 text-muted-foreground">The model received aggregate metrics only—not answer keys or question text.</p>
          </div>
        </aside>
      </section>

      <section className="mt-14 border-t-2 border-foreground pt-7" aria-labelledby="section-results-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="ink-label text-primary">Score evidence</p>
            <h2 id="section-results-title" className="mt-2 font-heading text-4xl font-bold">Section breakdown</h2>
          </div>
          <TargetIcon className="text-primary" aria-hidden="true" />
        </div>
        <div className="mt-6 grid border-t lg:grid-cols-3 lg:divide-x">
          {result.sections.map((section) => (
            <div key={section.section} className="border-b px-0 py-5 lg:px-6 first:pl-0 last:pr-0">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-heading text-3xl font-bold">{SECTION_LABEL[section.section]}</h3>
                <span className="font-heading text-4xl font-black text-primary">{section.practiceEstimate}</span>
              </div>
              <MetricBar value={section.accuracy * 100} />
              <p className="mt-3 text-sm text-muted-foreground">{section.correct}/{section.total} correct · {Math.round(section.averageSeconds)}s average</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
        <section className="border-t-2 border-foreground pt-7" aria-labelledby="pacing-title">
          <div className="flex items-end justify-between gap-4">
            <div><p className="ink-label text-[var(--scout-coral)]">Execution</p><h2 id="pacing-title" className="mt-2 font-heading text-4xl font-bold">Pacing diagnosis</h2></div>
            <Clock3Icon className="text-[var(--scout-coral)]" />
          </div>
          <p className="mt-5 font-heading text-3xl font-bold capitalize">{result.pacing.diagnosis.replace("-", " ")}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{Math.round(result.pacing.averageSeconds)}s actual average compared with {Math.round(result.pacing.expectedAverageSeconds)}s expected.</p>
          <dl className="mt-6 grid grid-cols-3 divide-x-2 divide-foreground border-y-2 border-foreground py-5 text-center">
            <div><dt className="ink-label text-muted-foreground">Rushed</dt><dd className="mt-2 font-heading text-3xl font-black">{result.pacing.rushed}</dd></div>
            <div><dt className="ink-label text-muted-foreground">On pace</dt><dd className="mt-2 font-heading text-3xl font-black text-primary">{result.pacing.onPace}</dd></div>
            <div><dt className="ink-label text-muted-foreground">Overtime</dt><dd className="mt-2 font-heading text-3xl font-black text-[var(--scout-coral)]">{result.pacing.overtime}</dd></div>
          </dl>
        </section>

        <section className="border-t-2 border-foreground pt-7" aria-labelledby="confidence-title">
          <div className="flex items-end justify-between gap-4">
            <div><p className="ink-label text-primary">Self-knowledge</p><h2 id="confidence-title" className="mt-2 font-heading text-4xl font-bold">Confidence calibration</h2></div>
            <GaugeIcon className="text-primary" />
          </div>
          <div className="mt-5 border-t">
            {result.confidence.map((bucket) => (
              <div key={bucket.confidence} className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-4 border-b py-4">
                <span className="font-semibold">{CONFIDENCE_LABEL[bucket.confidence]}</span>
                <MetricBar value={(bucket.accuracy ?? 0) * 100} color={bucket.confidence === "sure" ? "var(--scout-coral)" : "var(--primary)"} />
                <span className="font-mono text-xs font-bold">{bucket.total ? `${bucket.correct}/${bucket.total}` : "—"}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{result.overconfidentMisses} confident misses · {result.luckyGuesses} correct guesses</p>
        </section>
      </div>

      <section className="mt-14 border-t-2 border-foreground pt-7" aria-labelledby="skills-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="ink-label text-primary">Twelve-skill evidence</p><h2 id="skills-title" className="mt-2 font-heading text-4xl font-bold">Skill pressure map</h2></div>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">Weakness combines accuracy, time investment, and confident misses—not accuracy alone.</p>
        </div>
        <div className="mt-6 grid gap-x-10 lg:grid-cols-2">
          {result.skills.map((skill) => (
            <div key={skill.skill} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b py-4">
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="font-semibold">{skill.label}</p>
                  <span className="font-mono text-[0.65rem] font-bold uppercase text-muted-foreground">{skill.section}</span>
                </div>
                <MetricBar value={skill.accuracy * 100} color={skill.overconfidentMisses ? "var(--scout-coral)" : "var(--primary)"} />
                <p className="mt-2 text-xs text-muted-foreground">{Math.round(skill.averageSeconds)}s average · {skill.overconfidentMisses} confident misses</p>
              </div>
              <span className="font-heading text-3xl font-black">{Math.round(skill.accuracy * 100)}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-8 border-y-2 border-foreground bg-[var(--coach-surface)] px-5 py-7 lg:grid-cols-2 lg:px-8" aria-labelledby="debrief-title">
        <div>
          <p className="ink-label text-primary">Scout’s debrief</p>
          <h2 id="debrief-title" className="mt-2 font-heading text-4xl font-bold">{result.debrief.headline}</h2>
          <p className="mt-4 text-base leading-7">{result.debrief.summary}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div><p className="ink-label text-muted-foreground">Wins</p><ul className="mt-3 space-y-3 text-sm leading-6">{result.debrief.wins.map((win) => <li key={win} className="flex gap-2"><CheckCircle2Icon className="mt-1 size-4 shrink-0 text-primary" />{win}</li>)}</ul></div>
          <div><p className="ink-label text-muted-foreground">Priorities</p><ul className="mt-3 space-y-3 text-sm leading-6">{result.debrief.priorities.map((priority) => <li key={priority} className="flex gap-2"><CircleAlertIcon className="mt-1 size-4 shrink-0 text-[var(--scout-coral)]" />{priority}</li>)}</ul></div>
        </div>
        <Alert className="lg:col-span-2 bg-background">
          <BrainCircuitIcon />
          <AlertTitle>Next action</AlertTitle>
          <AlertDescription>{result.debrief.nextAction}</AlertDescription>
        </Alert>
      </section>

      <section className="mt-14 border-t-2 border-foreground pt-7" aria-labelledby="review-title">
        <div className="flex items-end justify-between gap-4">
          <div><p className="ink-label text-primary">Answer evidence</p><h2 id="review-title" className="mt-2 font-heading text-4xl font-bold">Review every decision</h2></div>
          <RotateCcwIcon className="text-primary" />
        </div>
        <div className="mt-6 border-t">
          {result.review.map((review, index) => {
            const question = questionMap.get(review.questionId)
            const selectedText = question?.choices.find((choice) => choice.id === review.selectedChoiceId)?.text ?? "No answer"
            const correctText = question?.choices.find((choice) => choice.id === review.correctChoiceId)?.text ?? "Reviewed answer"
            return (
              <details key={review.questionId} className="group border-b py-4">
                <summary className="grid cursor-pointer list-none grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  <span className={cn("flex size-9 items-center justify-center border-2 border-foreground font-mono text-xs font-bold", review.correct ? "bg-secondary" : "bg-[var(--coach-surface)]")}>{index + 1}</span>
                  <div className="min-w-0"><p className="truncate font-semibold">{review.skillLabel}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{review.section} · {review.confidence ?? "unanswered"} · {review.elapsedSeconds}s</p></div>
                  {review.correct ? <CheckCircle2Icon className="text-primary" /> : <CircleAlertIcon className="text-[var(--scout-coral)]" />}
                </summary>
                <div className="mt-5 grid gap-6 border-l-4 border-foreground pl-5 text-sm leading-6 lg:grid-cols-2">
                  <div><p className="ink-label text-muted-foreground">Question</p><p className="mt-2 font-semibold">{question?.prompt}</p><p className="mt-3"><strong>Your answer:</strong> {selectedText}</p><p className="mt-1"><strong>Correct answer:</strong> {correctText}</p></div>
                  <div><p className="ink-label text-muted-foreground">Reviewed reasoning</p><p className="mt-2">{review.rationale}</p></div>
                </div>
              </details>
            )
          })}
        </div>
      </section>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-y-2 border-foreground py-5">
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">Estimated practice evidence only. Use multiple simulations and daily skill work before treating a trend as stable.</p>
        <Button type="button" size="lg" onClick={onNewRun}>Run another simulation <ArrowRightIcon data-icon="inline-end" /></Button>
      </div>
    </main>
  )
}
