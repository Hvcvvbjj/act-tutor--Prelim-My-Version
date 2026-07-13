"use client"

import { useEffect, useState } from "react"
import type {
  CoreSection,
  DiagnosticAnswer,
  DiagnosticFormPublic,
  DiagnosticQuestionPublic,
  DiagnosticResult,
} from "@act-tutor/core"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldLabel } from "@/components/ui/field"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "ai-act-tutor-diagnostic-v1"

interface DiagnosticRunnerProps {
  onBack: () => void
  onComplete: (result: DiagnosticResult) => void
}

type RunnerPhase = "questions" | "review" | "results"
type RunnerStatus = "loading" | "ready" | "submitting" | "error"

interface SavedDiagnostic {
  version: 1
  formId: string
  formVersion: string
  answers: Record<string, string>
  currentIndex: number
  phase: "questions" | "review"
}

const SECTION_LABELS: Record<CoreSection, string> = {
  english: "English",
  math: "Math",
  reading: "Reading",
}

function readSavedDiagnostic(
  form: DiagnosticFormPublic
): SavedDiagnostic | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const candidate = JSON.parse(stored) as Partial<SavedDiagnostic>
    if (
      candidate.version !== 1 ||
      candidate.formId !== form.id ||
      candidate.formVersion !== form.version ||
      !candidate.answers ||
      typeof candidate.answers !== "object" ||
      !Number.isInteger(candidate.currentIndex) ||
      candidate.currentIndex === undefined ||
      candidate.currentIndex < 0 ||
      candidate.currentIndex >= form.questions.length ||
      (candidate.phase !== "questions" && candidate.phase !== "review")
    ) {
      return null
    }

    const questionsById = new Map(
      form.questions.map((question) => [question.id, question])
    )
    const answers = Object.fromEntries(
      Object.entries(candidate.answers).filter(([questionId, choiceId]) => {
        const question = questionsById.get(questionId)
        return (
          question !== undefined &&
          typeof choiceId === "string" &&
          question.choices.some((choice) => choice.id === choiceId)
        )
      })
    )

    return {
      version: 1,
      formId: form.id,
      formVersion: form.version,
      answers,
      currentIndex: candidate.currentIndex,
      phase: candidate.phase,
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function SectionProgress({
  form,
  answers,
  currentSection,
  submitted,
}: {
  form: DiagnosticFormPublic
  answers: Record<string, string>
  currentSection: CoreSection | null
  submitted: boolean
}) {
  return (
    <aside className="border-t pt-8 lg:border-t-0 lg:border-r lg:pt-2 lg:pr-10">
      <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
        Section progress
      </p>
      <ol className="mt-4 grid grid-cols-3 gap-3 lg:mt-6 lg:flex lg:flex-col lg:gap-5">
        {Object.entries(SECTION_LABELS).map(([section, label]) => {
          const sectionQuestions = form.questions.filter(
            (question) => question.section === section
          )
          const answered = sectionQuestions.filter(
            (question) => answers[question.id]
          ).length
          const active = currentSection === section
          return (
            <li
              key={section}
              className="grid min-w-0 grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 lg:grid-cols-[auto_1fr_auto] lg:gap-3"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-3 rounded-full border-2",
                  answered === sectionQuestions.length
                    ? "border-primary bg-primary"
                    : active
                      ? "border-primary bg-background ring-2 ring-primary/20"
                      : "border-border bg-background"
                )}
              />
              <span
                className={cn("truncate text-sm", active && "font-semibold")}
              >
                {label}
              </span>
              <span className="col-start-2 text-sm text-muted-foreground tabular-nums lg:col-start-auto">
                {answered}/{sectionQuestions.length}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="mt-8 hidden text-sm leading-6 text-muted-foreground lg:block">
        {submitted
          ? "Your diagnostic is submitted. The planner now uses this baseline and its direct skill evidence."
          : "Your answers are saved on this device. Correctness stays hidden until you submit the complete form."}
      </p>
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

  return (
    <section>
      <div className="flex items-center justify-between gap-4 text-sm font-semibold text-primary">
        <span>{SECTION_LABELS[question.section]}</span>
        <span className="tabular-nums">
          {currentIndex + 1} of {form.questions.length}
        </span>
      </div>
      <Progress
        value={progress}
        aria-label={`Diagnostic question ${currentIndex + 1} of ${form.questions.length}`}
        className="mt-3"
      />

      <div
        key={question.id}
        className="mt-10 animate-in duration-200 fade-in motion-reduce:animate-none"
      >
        <p className="text-sm font-semibold text-muted-foreground">
          {question.skillLabel}
        </p>
        {question.stimulus ? (
          <div className="mt-5 border-l-2 border-primary bg-[var(--info-surface)] px-5 py-4 text-base leading-7">
            {question.stimulus}
          </div>
        ) : null}
        <h1 className="mt-6 max-w-3xl text-2xl leading-9 font-bold tracking-[-0.02em] sm:text-3xl sm:leading-10">
          {question.prompt}
        </h1>

        <RadioGroup
          value={answers[question.id] ?? ""}
          onValueChange={onAnswer}
          aria-label={`Answer choices for question ${currentIndex + 1}`}
          className="mt-7 gap-3"
        >
          {question.choices.map((choice, index) => (
            <FieldLabel
              key={choice.id}
              className={cn(
                "cursor-pointer border p-4 text-base transition-colors sm:p-5",
                answers[question.id] === choice.id &&
                  "border-primary bg-primary/5"
              )}
            >
              <Field orientation="horizontal">
                <RadioGroupItem value={choice.id} />
                <FieldContent>
                  <span className="flex gap-3">
                    <strong className="text-primary">
                      {String.fromCharCode(65 + index)}.
                    </strong>
                    <span>{choice.text}</span>
                  </span>
                </FieldContent>
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>

        <div className="mt-8 flex gap-3">
          <Button
            type="button"
            variant="outline"
            size="xl"
            onClick={onPrevious}
            disabled={currentIndex === 0}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Previous
          </Button>
          <Button
            type="button"
            size="xl"
            className="flex-1"
            onClick={onNext}
            disabled={!answers[question.id]}
          >
            {isLast ? "Review answers" : "Next question"}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
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
            ? "All 12 questions answered."
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
        while continuing to replace this wide starter estimate with practice
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
          Twelve questions provide useful direction, not final precision. The
          planner will keep learning from lessons, focused sets, and
          checkpoints.
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

  useEffect(() => {
    const controller = new AbortController()

    fetch("/api/diagnostic", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the diagnostic form.")
        return (await response.json()) as DiagnosticFormPublic
      })
      .then((loadedForm) => {
        const saved = readSavedDiagnostic(loadedForm)
        setForm(loadedForm)
        if (saved) {
          setAnswers(saved.answers)
          setCurrentIndex(saved.currentIndex)
          setPhase(saved.phase)
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
    if (!form) return
    const saved: SavedDiagnostic = {
      version: 1,
      formId: form.id,
      formVersion: form.version,
      answers: nextAnswers,
      currentIndex: nextIndex,
      phase: nextPhase,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
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
      const body = (await response.json()) as DiagnosticResult & {
        error?: string
      }
      if (!response.ok) {
        throw new Error(body.error ?? "The diagnostic could not be scored.")
      }

      window.localStorage.removeItem(STORAGE_KEY)
      setResult(body)
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
      <header className="flex min-h-20 items-center justify-between gap-4 border-b px-5 py-4 sm:px-8 lg:px-12">
        <div>
          <p className="text-lg font-bold tracking-tight sm:text-xl">
            AI ACT Tutor
          </p>
          <p className="text-sm text-muted-foreground">{form.title}</p>
        </div>
        <Button type="button" variant="ghost" onClick={onBack}>
          Save and exit
        </Button>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-5 py-10 sm:px-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-14">
        <SectionProgress
          form={form}
          answers={answers}
          currentSection={currentSection}
          submitted={phase === "results"}
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
