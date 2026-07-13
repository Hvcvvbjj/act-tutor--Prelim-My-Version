"use client"

import { useEffect, useRef, useState } from "react"
import type {
  CoreSection,
  DiagnosticAnswer,
  DiagnosticFormPublic,
  DiagnosticQuestionPublic,
  DiagnosticResult,
  DiagnosticSessionPayload,
} from "@act-tutor/core"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { ScoutMark } from "@/components/tutor/scout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

interface DiagnosticRunnerProps {
  onBack: () => void
  onComplete: (result: DiagnosticResult) => void
}

type RunnerPhase = "questions" | "review" | "results"
type RunnerStatus = "loading" | "ready" | "submitting" | "error"
type SaveStatus = "saved" | "saving" | "error"

const SECTION_LABELS: Record<CoreSection, string> = {
  english: "English",
  math: "Math",
  reading: "Reading",
}

function SectionProgress({
  form,
  answers,
  currentSection,
}: {
  form: DiagnosticFormPublic
  answers: Record<string, string>
  currentSection: CoreSection | null
}) {
  return (
    <aside className="border-b-2 border-foreground pb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="ink-label text-muted-foreground">Section progress</p>
        <p className="text-xs text-muted-foreground">
          Correctness hidden until final submission
        </p>
      </div>
      <ol className="mt-4 grid grid-cols-3 divide-x-2 divide-foreground border-y-2 border-foreground">
        {Object.entries(SECTION_LABELS).map(([section, label]) => {
          const sectionQuestions = form.questions.filter(
            (question) => question.section === section
          )
          const answered = sectionQuestions.filter(
            (question) => answers[question.id]
          ).length
          const active = currentSection === section
          const blueprint = form.blueprint.find((item) => item.section === section)
          return (
            <li
              key={section}
              className={cn(
                "min-w-0 px-3 py-4 sm:px-5",
                active && "bg-[var(--coach-surface)]"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-3 border-2",
                    answered === sectionQuestions.length
                      ? "border-primary bg-primary"
                      : active
                        ? "border-primary bg-background"
                        : "border-border bg-background"
                  )}
                />
                <span className={cn("truncate font-heading text-xl font-bold sm:text-2xl", active && "text-primary")}>{label}</span>
              </div>
              <p className="mt-1 pl-5 font-mono text-xs text-muted-foreground tabular-nums">
                {answered}/{sectionQuestions.length}
                {blueprint ? ` · ${blueprint.diagnosticMinutes} min target` : ""}
              </p>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}

function QuestionView({
  form,
  question,
  currentIndex,
  answers,
  onAnswer,
  onPrevious,
  onNext,
}: {
  form: DiagnosticFormPublic
  question: DiagnosticQuestionPublic
  currentIndex: number
  answers: Record<string, string>
  onAnswer: (choiceId: string) => void
  onPrevious: () => void
  onNext: () => void
}) {
  const isLast = currentIndex === form.questions.length - 1
  const progress = ((currentIndex + 1) / form.questions.length) * 100
  const sectionQuestions = form.questions.filter((item) => item.section === question.section)
  const sectionIndex = sectionQuestions.findIndex((item) => item.id === question.id)

  const answerPanel = (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="ink-label text-primary">
          {SECTION_LABELS[question.section]} · {sectionIndex + 1}/{sectionQuestions.length}
        </p>
        <p className="font-mono text-xs font-bold text-muted-foreground tabular-nums">
          Overall {currentIndex + 1}/{form.questions.length}
        </p>
      </div>
      {question.lineReference ? (
        <p className="mt-5 font-mono text-xs font-bold text-muted-foreground uppercase">
          {question.lineReference}
        </p>
      ) : null}
      <h1 className="mt-4 max-w-3xl font-heading text-3xl leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
        {question.prompt}
      </h1>

      <RadioGroup
        value={answers[question.id] ?? ""}
        onValueChange={onAnswer}
        aria-label={`Answer choices for question ${currentIndex + 1}`}
        className="mt-7 gap-3"
      >
        {question.choices.map((choice, index) => (
          <label
            key={choice.id}
            className={cn(
              "grid cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)] items-start border-2 border-border bg-background p-4 text-sm leading-6 transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-foreground sm:text-base",
              answers[question.id] === choice.id && "border-primary bg-secondary"
            )}
          >
            <RadioGroupItem value={choice.id} className="sr-only" />
            <strong className="col-start-1 row-start-1 font-mono text-primary">{String.fromCharCode(65 + index)}</strong>
            <span className="col-start-2 row-start-1 min-w-0">{choice.text}</span>
          </label>
        ))}
      </RadioGroup>

      <div className="mt-8 flex gap-3 border-t-2 border-foreground pt-6">
        <Button type="button" variant="outline" size="xl" onClick={onPrevious} disabled={currentIndex === 0}>
          <ArrowLeftIcon data-icon="inline-start" />
          Previous
        </Button>
        <Button type="button" size="xl" className="flex-1" onClick={onNext} disabled={!answers[question.id]}>
          {isLast ? "Review answers" : "Next question"}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </div>
  )

  return (
    <section key={question.id} className="animate-in duration-200 fade-in motion-reduce:animate-none">
      <Progress value={progress} aria-label={`Diagnostic question ${currentIndex + 1} of ${form.questions.length}`} />
      {question.format === "passage" && question.stimulus ? (
        <div className="paper-panel mt-6 grid overflow-hidden border-2 border-foreground bg-background lg:grid-cols-[minmax(0,1.12fr)_minmax(25rem,0.88fr)]">
          <article className="max-h-[70svh] overflow-y-auto border-b-2 border-foreground bg-[var(--rail)] px-5 py-7 lg:border-r-2 lg:border-b-0 lg:px-8">
            <p className="ink-label text-primary">{question.section === "english" ? "Passage to revise" : "Passage"}</p>
            <h2 className="mt-2 font-heading text-3xl font-bold">{question.passageTitle}</h2>
            <div className="mt-6 whitespace-pre-line text-[0.98rem] leading-8 sm:text-base">
              {question.stimulus}
            </div>
          </article>
          <div className="px-5 py-7 lg:px-8">{answerPanel}</div>
        </div>
      ) : (
        <div className="mx-auto mt-8 max-w-4xl border-y-2 border-foreground py-8">{answerPanel}</div>
      )}
    </section>
  )
}

function ReviewView({
  form,
  answers,
  status,
  error,
  onEdit,
  onSubmit,
}: {
  form: DiagnosticFormPublic
  answers: Record<string, string>
  status: RunnerStatus
  error: string | null
  onEdit: (index: number) => void
  onSubmit: () => void
}) {
  const unanswered = form.questions.filter((question) => !answers[question.id])

  return (
    <section>
      <h1 className="text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
        Review your answers.
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-7 text-muted-foreground">
        Correctness is still hidden. Check every response, then submit once to
        create your estimated baseline.
      </p>

      <ol className="mt-9 border-y">
        {form.questions.map((question, index) => (
          <li
            key={question.id}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b py-4 last:border-0"
          >
            <span className="flex size-8 items-center justify-center rounded-full border text-sm font-semibold">
              {index + 1}
            </span>
            <div>
              <p className="font-semibold">
                {SECTION_LABELS[question.section]}
              </p>
              <p className="text-sm text-muted-foreground">
                {answers[question.id] ? "Answered" : "Needs an answer"}
              </p>
            </div>
            <Button type="button" variant="ghost" onClick={() => onEdit(index)}>
              Edit
            </Button>
          </li>
        ))}
      </ol>

      {error ? (
        <Alert variant="destructive" className="mt-6">
          <CircleAlertIcon />
          <AlertTitle>Could not submit</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          size="xl"
          onClick={onSubmit}
          disabled={unanswered.length > 0 || status === "submitting"}
        >
          {status === "submitting" ? (
            <LoaderCircleIcon
              data-icon="inline-start"
              className="animate-spin"
            />
          ) : (
            <ShieldCheckIcon data-icon="inline-start" />
          )}
          {status === "submitting" ? "Scoring…" : "Submit diagnostic"}
        </Button>
        <p className="text-sm text-muted-foreground">
          {unanswered.length === 0
            ? `All ${form.questions.length} questions answered.`
            : `${unanswered.length} question${unanswered.length === 1 ? "" : "s"} still unanswered.`}
        </p>
      </div>
    </section>
  )
}

function ResultsView({
  result,
  onComplete,
}: {
  result: DiagnosticResult
  onComplete: () => void
}) {
  const hasStrengths = result.strengths.length > 0
  const hasFocusSkills = result.focusSkills.length > 0

  return (
    <section>
      <p className="text-sm font-semibold text-primary">Baseline complete</p>
      <h1 className="mt-2 text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
        Your estimated range is {result.compositeRange.low}–
        {result.compositeRange.high}.
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-7 text-muted-foreground">
        We&apos;ll plan from a midpoint of {result.compositeRange.estimate}{" "}
        while continuing to strengthen this half-length estimate with practice
        evidence.
      </p>

      <dl className="mt-10 grid grid-cols-3 divide-x border-y py-6 text-center">
        {result.sectionResults.map((section) => (
          <div key={section.section} className="px-2">
            <dt className="text-sm text-muted-foreground">
              {SECTION_LABELS[section.section]}
            </dt>
            <dd className="mt-2 text-2xl font-bold text-primary tabular-nums sm:text-3xl">
              {section.range.low}–{section.range.high}
            </dd>
            <dd className="mt-1 text-xs text-muted-foreground">
              {section.correct}/{section.total} correct
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-xl font-bold">
            {hasStrengths ? "Early strengths" : "Best current signals"}
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {(hasStrengths
              ? result.strengths
              : result.skillResults.slice(-2)
            ).map((skill) => (
              <li
                key={skill.skill}
                className="flex items-center gap-3 border-b pb-3"
              >
                <CheckCircle2Icon className="text-primary" aria-hidden="true" />
                <span>{skill.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-xl font-bold">
            {hasFocusSkills ? "First focus skills" : "Skills to confirm next"}
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {(hasFocusSkills
              ? result.focusSkills
              : result.skillResults.slice(0, 2)
            ).map((skill) => (
              <li
                key={skill.skill}
                className="flex items-center gap-3 border-b pb-3"
              >
                <CircleAlertIcon className="text-primary" aria-hidden="true" />
                <span>{skill.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Alert className="mt-10 bg-[var(--info-surface)]">
        <ShieldCheckIcon />
        <AlertTitle>
          Estimated practice range—not an official ACT score
        </AlertTitle>
        <AlertDescription>
          This original 66-question half-length form follows the enhanced ACT
          section proportions, but it is not an official ACT administration.
          The planner will keep calibrating from lessons, focused sets, and checkpoints.
        </AlertDescription>
      </Alert>

      <Button type="button" size="xl" className="mt-8" onClick={onComplete}>
        Build my study plan
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    </section>
  )
}

export function DiagnosticRunner({
  onBack,
  onComplete,
}: DiagnosticRunnerProps) {
  const [form, setForm] = useState<DiagnosticFormPublic | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<RunnerPhase>("questions")
  const [status, setStatus] = useState<RunnerStatus>("loading")
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved")
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const saveRevision = useRef(0)

  useEffect(() => {
    const controller = new AbortController()

    fetch("/api/diagnostic", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the diagnostic form.")
        return (await response.json()) as DiagnosticSessionPayload
      })
      .then((session) => {
        setForm(session.form)
        setAnswers(session.progress.answers)
        setCurrentIndex(session.progress.currentIndex)
        if (session.status === "completed" && session.result) {
          setResult(session.result)
          setPhase("results")
        } else {
          setPhase(session.progress.phase)
        }
        setStatus("ready")
      })
      .catch((caught) => {
        if (controller.signal.aborted) return
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load the diagnostic form."
        )
        setStatus("error")
      })

    return () => controller.abort()
  }, [])

  function persistProgress(
    nextAnswers: Record<string, string>,
    nextIndex: number,
    nextPhase: "questions" | "review"
  ) {
    if (!form) return Promise.resolve()
    const revision = ++saveRevision.current
    setSaveStatus("saving")
    const operation = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        const response = await fetch("/api/diagnostic", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formId: form.id,
            formVersion: form.version,
            progress: {
              answers: nextAnswers,
              currentIndex: nextIndex,
              phase: nextPhase,
            },
          }),
        })
        const body = (await response.json()) as { error?: string }
        if (!response.ok) {
          throw new Error(body.error ?? "Could not save diagnostic progress.")
        }
      })
    saveQueue.current = operation
    operation.then(
      () => {
        if (saveRevision.current === revision) setSaveStatus("saved")
      },
      () => {
        if (saveRevision.current === revision) setSaveStatus("error")
      }
    )
    return operation
  }

  function moveToQuestion(index: number) {
    setCurrentIndex(index)
    setPhase("questions")
    persistProgress(answers, index, "questions")
  }

  async function submitDiagnostic() {
    if (!form || status === "submitting") return
    setStatus("submitting")
    setError(null)

    try {
      await saveQueue.current
      const diagnosticAnswers: DiagnosticAnswer[] = form.questions.map(
        (question) => ({
          questionId: question.id,
          choiceId: answers[question.id],
        })
      )
      const response = await fetch("/api/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId: form.id,
          formVersion: form.version,
          answers: diagnosticAnswers,
        }),
      })
      const body = (await response.json()) as DiagnosticSessionPayload & {
        error?: string
      }
      if (!response.ok) {
        throw new Error(body.error ?? "The diagnostic could not be scored.")
      }
      if (!body.result) throw new Error("The diagnostic result is missing.")

      setResult(body.result)
      setPhase("results")
      setStatus("ready")
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The diagnostic could not be scored."
      )
      setStatus("ready")
    }
  }

  async function saveAndExit() {
    try {
      await saveQueue.current
      onBack()
    } catch {
      setSaveStatus("error")
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-5 text-foreground">
        <p className="flex items-center gap-3 text-lg font-semibold">
          <LoaderCircleIcon
            className="animate-spin text-primary"
            aria-hidden="true"
          />
          Loading reviewed questions…
        </p>
      </div>
    )
  }

  if (!form || status === "error") {
    return (
      <div className="mx-auto flex min-h-svh max-w-xl flex-col justify-center px-5">
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Diagnostic unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          type="button"
          variant="outline"
          className="mt-5"
          onClick={onBack}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Back to setup
        </Button>
      </div>
    )
  }

  const question = form.questions[currentIndex]
  const currentSection = phase === "questions" ? question.section : null

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex min-h-20 items-center justify-between gap-4 border-b-2 border-foreground px-5 py-4 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <ScoutMark className="size-11" />
          <div>
          <p className="font-heading text-xl font-black tracking-tight sm:text-2xl">
            SCOUT ACT
          </p>
          <p className="text-sm text-muted-foreground">{form.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span
            className={cn(
              "hidden items-center gap-2 text-sm sm:flex",
              saveStatus === "error"
                ? "text-destructive"
                : "text-muted-foreground"
            )}
            role="status"
          >
            {saveStatus === "saving" ? (
              <LoaderCircleIcon
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : saveStatus === "saved" ? (
              <CheckCircle2Icon
                className="size-4 text-primary"
                aria-hidden="true"
              />
            ) : (
              <CircleAlertIcon className="size-4" aria-hidden="true" />
            )}
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
                ? "Saved"
                : "Save failed"}
          </span>
          <Button type="button" variant="ghost" onClick={saveAndExit}>
            Save and exit
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-[96rem] flex-col gap-7 px-4 py-7 sm:px-8 lg:py-10">
        <SectionProgress
          form={form}
          answers={answers}
          currentSection={currentSection}
        />

        {phase === "questions" ? (
          <QuestionView
            form={form}
            question={question}
            currentIndex={currentIndex}
            answers={answers}
            onAnswer={(choiceId) => {
              const nextAnswers = { ...answers, [question.id]: choiceId }
              setAnswers(nextAnswers)
              persistProgress(nextAnswers, currentIndex, "questions")
            }}
            onPrevious={() => moveToQuestion(Math.max(0, currentIndex - 1))}
            onNext={() => {
              if (currentIndex === form.questions.length - 1) {
                setPhase("review")
                persistProgress(answers, currentIndex, "review")
                return
              }
              moveToQuestion(currentIndex + 1)
            }}
          />
        ) : phase === "review" ? (
          <ReviewView
            form={form}
            answers={answers}
            status={status}
            error={error}
            onEdit={moveToQuestion}
            onSubmit={submitDiagnostic}
          />
        ) : result ? (
          <ResultsView result={result} onComplete={() => onComplete(result)} />
        ) : null}
      </main>
    </div>
  )
}
