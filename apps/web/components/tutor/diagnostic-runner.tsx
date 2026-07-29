"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  AssessmentRemediationProgress,
  CoreSection,
  DiagnosticAnswer,
  DiagnosticFormPublic,
  DiagnosticQuestionPublic,
  DiagnosticResult,
  DiagnosticSessionPayload,
} from "@act-tutor/core"
import { UNANSWERED_DIAGNOSTIC_CHOICE_ID } from "@act-tutor/core"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  Clock3Icon,
  LoaderCircleIcon,
  ShieldCheckIcon,
} from "lucide-react"

import {
  assessmentSecondsRemaining,
  diagnosticTimerStorageKey,
  formatAssessmentTime,
  resolveAssessmentDeadline,
} from "@/components/tutor/assessment-display"
import {
  AssessmentRemediation,
  type AssessmentRemediationItem,
} from "@/components/tutor/assessment-remediation"
import {
  RapidAnswerCoachDialog,
  useRapidAnswerCoach,
} from "@/components/tutor/rapid-answer-coach"
import { ScoutMark } from "@/components/tutor/scout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  RadioGroup,
  VisuallyHiddenRadioGroupItem,
} from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

interface DiagnosticRunnerProps {
  onBack: () => void
  onComplete: (result: DiagnosticResult, attemptId: string) => void
  canViewTechnicalDetails: boolean
  purpose: "baseline" | "round"
  onAskMrKim?: (questionId: string) => void
}

type RunnerPhase = "questions" | "review" | "results" | "remediation"
type RunnerStatus = "loading" | "ready" | "submitting" | "error"
type SaveStatus = "saved" | "saving" | "error"

const SECTION_LABELS: Record<CoreSection, string> = {
  english: "English",
  math: "Math",
  reading: "Reading",
}

function restoreDiagnosticDeadline(session: DiagnosticSessionPayload) {
  const storageKey = diagnosticTimerStorageKey(session.attemptId)
  let storedDeadline: string | null = null
  try {
    storedDeadline = window.localStorage.getItem(storageKey)
  } catch {
    // Private browsing can deny storage. The in-memory deadline still works.
  }
  const deadline = resolveAssessmentDeadline(
    storedDeadline,
    Date.now(),
    session.form.estimatedMinutes * 60
  )
  const parsedStoredDeadline = Number(storedDeadline)
  if (
    storedDeadline === null ||
    !Number.isFinite(parsedStoredDeadline) ||
    parsedStoredDeadline <= 0
  ) {
    try {
      window.localStorage.setItem(storageKey, String(deadline))
    } catch {
      // Keep the current attempt timed even when persistence is unavailable.
    }
  }
  return deadline
}

function QuestionView({
  form,
  question,
  currentIndex,
  answers,
  returnToReview,
  onAnswer,
  onPrevious,
  onNext,
}: {
  form: DiagnosticFormPublic
  question: DiagnosticQuestionPublic
  currentIndex: number
  answers: Record<string, string>
  returnToReview: boolean
  onAnswer: (choiceId: string) => void
  onPrevious: () => void
  onNext: () => void
}) {
  const questionHeadingRef = useRef<HTMLHeadingElement>(null)
  const isLast = currentIndex === form.questions.length - 1
  const progress = ((currentIndex + 1) / form.questions.length) * 100
  const sectionQuestions = form.questions.filter(
    (item) => item.section === question.section
  )
  const sectionIndex = sectionQuestions.findIndex(
    (item) => item.id === question.id
  )

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      questionHeadingRef.current?.focus({ preventScroll: true })
      questionHeadingRef.current?.scrollIntoView({
        block: "start",
        behavior: "auto",
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [question.id])

  const answerPanel = (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="ink-label text-primary">
          {SECTION_LABELS[question.section]} · {sectionIndex + 1}/
          {sectionQuestions.length}
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
      <h1
        ref={questionHeadingRef}
        tabIndex={-1}
        className="mt-4 max-w-3xl scroll-mt-6 font-heading text-3xl leading-tight font-bold tracking-[-0.02em] outline-none sm:text-4xl"
      >
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
              "grid cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)] items-start border-2 border-border bg-background p-4 text-sm leading-6 transition-[transform,background-color,border-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 hover:-translate-y-0.5 hover:border-foreground sm:text-base",
              answers[question.id] === choice.id &&
                "border-primary bg-secondary"
            )}
          >
            <VisuallyHiddenRadioGroupItem value={choice.id} />
            <strong className="col-start-1 row-start-1 font-mono text-primary">
              {String.fromCharCode(65 + index)}
            </strong>
            <span className="col-start-2 row-start-1 min-w-0">
              {choice.text}
            </span>
          </label>
        ))}
      </RadioGroup>

      <div className="mt-8 flex gap-3 border-t-2 border-foreground pt-6">
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
          {returnToReview
            ? "Back to review"
            : isLast
              ? "Review answers"
              : "Next question"}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </div>
  )

  return (
    <section
      key={question.id}
      className="animate-in duration-200 fade-in motion-reduce:animate-none"
    >
      <Progress
        value={progress}
        aria-label={`Diagnostic question ${currentIndex + 1} of ${form.questions.length}`}
      />
      {question.format === "passage" && question.stimulus ? (
        <div className="paper-panel mt-6 grid overflow-hidden border-2 border-foreground bg-background lg:grid-cols-[minmax(0,1.12fr)_minmax(25rem,0.88fr)]">
          <article className="border-b-2 border-foreground bg-[var(--rail)] px-5 py-7 lg:max-h-[70svh] lg:overflow-y-auto lg:border-r-2 lg:border-b-0 lg:px-8">
            <p className="ink-label text-primary">
              {question.section === "english" ? "Passage to revise" : "Passage"}
            </p>
            <h2 className="mt-2 font-heading text-3xl font-bold">
              {question.passageTitle}
            </h2>
            <div className="mt-6 text-[0.98rem] leading-8 whitespace-pre-line sm:text-base">
              {question.stimulus}
            </div>
          </article>
          <div className="px-5 py-7 lg:px-8">{answerPanel}</div>
        </div>
      ) : (
        <div className="mx-auto mt-8 max-w-4xl border-y-2 border-foreground py-8">
          {answerPanel}
        </div>
      )}
    </section>
  )
}

function ReviewView({
  form,
  answers,
  timeExpired,
  status,
  error,
  onEdit,
  onSubmit,
}: {
  form: DiagnosticFormPublic
  answers: Record<string, string>
  timeExpired: boolean
  status: RunnerStatus
  error: string | null
  onEdit: (index: number) => void
  onSubmit: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const unanswered = form.questions.filter((question) => !answers[question.id])
  const answered = form.questions.length - unanswered.length

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <section>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-4xl font-bold tracking-[-0.035em] outline-none sm:text-5xl"
      >
        Review your answers.
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-7 text-muted-foreground">
        {timeExpired
          ? "Time ended. Scout is scoring every unanswered question as blank."
          : "Correct answers stay hidden during the test. Fill any blanks, review, then submit."}
      </p>

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-4 border-y-2 border-foreground py-6">
        <p className="font-heading text-3xl font-black">
          {answered} of {form.questions.length} answered
        </p>
        <p className="text-sm font-semibold text-muted-foreground">
          {unanswered.length === 0
            ? "Ready to submit"
            : `${unanswered.length} still blank`}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" className="mt-6">
          <CircleAlertIcon />
          <AlertTitle>Could not submit</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        {unanswered.length > 0 && !timeExpired ? (
          <Button
            type="button"
            size="xl"
            onClick={() =>
              onEdit(
                form.questions.findIndex(
                  (question) => question.id === unanswered[0]?.id
                )
              )
            }
          >
            Answer first blank
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        ) : (
          <Button
            type="button"
            size="xl"
            onClick={onSubmit}
            disabled={status === "submitting"}
          >
            {status === "submitting" ? (
              <LoaderCircleIcon
                data-icon="inline-start"
                className="animate-spin"
              />
            ) : (
              <ShieldCheckIcon data-icon="inline-start" />
            )}
            {status === "submitting"
              ? "Scoring…"
              : timeExpired
                ? "Score timed diagnostic"
                : "Submit diagnostic"}
          </Button>
        )}
        <p className="text-sm text-muted-foreground">
          {timeExpired
            ? "Blank answers count as incorrect."
            : unanswered.length === 0
              ? `All ${form.questions.length} questions answered.`
              : `${unanswered.length} question${unanswered.length === 1 ? "" : "s"} still unanswered.`}
        </p>
      </div>

      <details
        className="group mt-8 border-y-2 border-foreground"
        open={unanswered.length > 0 && !timeExpired}
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-bold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span>
            {unanswered.length > 0
              ? "Finish unanswered questions"
              : "Review individual answers"}
          </span>
          <span className="text-sm text-muted-foreground">
            {form.questions.length} questions
          </span>
        </summary>
        <ol className="border-t-2 border-foreground">
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => onEdit(index)}
                disabled={timeExpired}
              >
                Edit
              </Button>
            </li>
          ))}
        </ol>
      </details>
    </section>
  )
}

function ResultsView({
  result,
  purpose,
  onComplete,
  canViewTechnicalDetails,
}: {
  result: DiagnosticResult
  purpose: "baseline" | "round"
  onComplete: () => void
  canViewTechnicalDetails: boolean
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const hasStrengths = result.strengths.length > 0
  const hasFocusSkills = result.focusSkills.length > 0
  const primaryFocus = result.focusSkills[0]
  const rangeMargin = result.calibrationVersion === "rapid-v1" ? 2 : 6
  const isBaseline = purpose === "baseline"

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <section>
      <p className="text-sm font-semibold text-primary">Diagnostic complete</p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-4xl font-bold tracking-[-0.035em] outline-none sm:text-5xl"
      >
        {isBaseline ? "Your starting estimate" : "Your new estimate"} is{" "}
        {result.compositeRange.estimate}.
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-7 text-muted-foreground">
        Your practice range is {result.compositeRange.low}–
        {result.compositeRange.high}. I&apos;ll use{" "}
        {`${result.compositeRange.estimate} to build your plan. It isn't an official ACT score or prediction.`}
      </p>

      <div className="mt-9 border-y-2 border-foreground py-6">
        <p className="ink-label text-primary">
          {isBaseline ? "Round 1" : primaryFocus ? "Study next" : "Next round"}
        </p>
        <h2 className="mt-2 font-heading text-3xl font-black">
          {isBaseline
            ? "Start with every ACT question type"
            : (primaryFocus?.label ?? "Keep a balanced mix")}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {isBaseline
            ? "Round 1 teaches all 12 question types. Later rounds focus on what you need most."
            : primaryFocus
              ? "Your next round starts here."
              : "No single question type stands out, so your next round stays balanced."}
        </p>
      </div>

      <Button type="button" size="xl" className="mt-8" onClick={onComplete}>
        Continue
        <ArrowRightIcon data-icon="inline-end" />
      </Button>

      <details className="group mt-9 border-y-2 border-foreground">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-bold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span>See full diagnostic results</span>
          <span className="text-sm text-muted-foreground">
            Sections and skills
          </span>
        </summary>
        <div className="border-t-2 border-foreground py-7">
          <p className="ink-label text-muted-foreground">
            Practice-based section ranges
          </p>
          <dl className="mt-3 grid grid-cols-3 divide-x border-y py-6 text-center">
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

          <div className="mt-9 grid gap-8 sm:grid-cols-2">
            <div>
              <h2 className="text-xl font-bold">
                {hasStrengths
                  ? "Strongest skills so far"
                  : "What looks strongest"}
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
                    <CheckCircle2Icon
                      className="text-primary"
                      aria-hidden="true"
                    />
                    <span>{skill.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {hasFocusSkills
                  ? isBaseline
                    ? "Skills to revisit after Round 1"
                    : "Skills for your next round"
                  : "Skills to confirm later"}
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
                    <CircleAlertIcon
                      className="text-primary"
                      aria-hidden="true"
                    />
                    <span>{skill.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {canViewTechnicalDetails ? (
            <Alert className="mt-9 bg-[var(--info-surface)]">
              <ShieldCheckIcon />
              <AlertTitle>How this planning number is calculated</AlertTitle>
              <AlertDescription>
                <p>
                  For each section, Scout calculates{" "}
                  <code className="font-mono text-xs text-foreground">
                    round(1 + ((correct + 1) / (total + 2)) × 35)
                  </code>
                  , then shows a range of ±{rangeMargin} points, clipped to
                  1–36. The Composite midpoint is the rounded average of the
                  English, Math, and Reading midpoints; its low and high values
                  use the three section lows and highs.
                </p>
                <p className="mt-2">
                  This is an internal conversion from raw correctness on
                  original practice questions. It is not ACT-equated, not a
                  statistical confidence interval, and not an official ACT
                  score.
                </p>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </details>
    </section>
  )
}

export function DiagnosticRunner({
  onBack,
  onComplete,
  onAskMrKim,
  canViewTechnicalDetails,
  purpose,
}: DiagnosticRunnerProps) {
  const [form, setForm] = useState<DiagnosticFormPublic | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<RunnerPhase>("questions")
  const [status, setStatus] = useState<RunnerStatus>("loading")
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [remediation, setRemediation] =
    useState<AssessmentRemediationProgress | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved")
  const [reviewReturnIndex, setReviewReturnIndex] = useState<number | null>(
    null
  )
  const [timerDeadline, setTimerDeadline] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [timeExpired, setTimeExpired] = useState(false)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const saveRevision = useRef(0)
  const timedSubmitAttempted = useRef(false)
  const rapidAnswerCoach = useRapidAnswerCoach(
    attemptId ?? "diagnostic-loading",
    Object.keys(answers)
  )

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
        setAttemptId(session.attemptId)
        setForm(session.form)
        setAnswers(session.progress.answers)
        setCurrentIndex(session.progress.currentIndex)
        if (session.status === "completed" && session.result) {
          setResult(session.result)
          setRemediation(session.remediation)
          setPhase(
            purpose === "round" && session.remediation?.status === "required"
              ? "remediation"
              : "results"
          )
        } else {
          const deadline = restoreDiagnosticDeadline(session)
          setTimerDeadline(deadline)
          setTimeRemaining(assessmentSecondsRemaining(deadline, Date.now()))
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
  }, [purpose])

  useEffect(() => {
    if (
      timerDeadline === null ||
      phase === "results" ||
      phase === "remediation"
    )
      return
    const updateClock = () => {
      const next = assessmentSecondsRemaining(timerDeadline, Date.now())
      setTimeRemaining(next)
      if (next === 0) {
        setTimeExpired(true)
        setPhase((current) => (current === "results" ? current : "review"))
      }
    }
    updateClock()
    const interval = window.setInterval(updateClock, 1_000)
    return () => window.clearInterval(interval)
  }, [phase, timerDeadline])

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

  function editFromReview(index: number) {
    setReviewReturnIndex(index)
    moveToQuestion(index)
  }

  function returnToReview(nextAnswers = answers) {
    setReviewReturnIndex(null)
    setPhase("review")
    persistProgress(nextAnswers, currentIndex, "review")
  }

  const submitDiagnostic = useCallback(
    async (includeTimedOutBlanks = false) => {
      if (!form || status === "submitting") return
      setStatus("submitting")
      setError(null)

      try {
        await saveQueue.current
        const diagnosticAnswers: DiagnosticAnswer[] = form.questions.map(
          (question) => ({
            questionId: question.id,
            choiceId:
              answers[question.id] ??
              (includeTimedOutBlanks ? UNANSWERED_DIAGNOSTIC_CHOICE_ID : ""),
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

        setAttemptId(body.attemptId)
        setResult(body.result)
        setRemediation(body.remediation)
        setPhase("results")
        setStatus("ready")
        try {
          window.localStorage.removeItem(
            diagnosticTimerStorageKey(body.attemptId)
          )
        } catch {
          // A completed attempt no longer needs its local timer key.
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The diagnostic could not be scored."
        )
        setStatus("ready")
      }
    },
    [answers, form, status]
  )

  useEffect(() => {
    if (
      !timeExpired ||
      phase === "results" ||
      phase === "remediation" ||
      status !== "ready" ||
      timedSubmitAttempted.current
    ) {
      return
    }
    timedSubmitAttempted.current = true
    void submitDiagnostic(true)
  }, [phase, status, submitDiagnostic, timeExpired])

  async function saveAndExit() {
    try {
      await saveQueue.current
      onBack()
    } catch {
      setSaveStatus("error")
    }
  }

  async function answerRemediation(
    questionId: string,
    choiceId: string
  ): Promise<AssessmentRemediationProgress> {
    const response = await fetch("/api/diagnostic", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "answer_remediation",
        questionId,
        choiceId,
      }),
    })
    const body = (await response.json()) as DiagnosticSessionPayload & {
      error?: string
    }
    if (!response.ok || !body.remediation) {
      throw new Error(
        body.error ?? "This missed question could not be checked."
      )
    }
    setRemediation(body.remediation)
    return body.remediation
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-5 text-foreground">
        <p className="flex items-center gap-3 text-lg font-semibold">
          <LoaderCircleIcon
            className="animate-spin text-primary"
            aria-hidden="true"
          />
          Loading your diagnostic…
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
          Return to diagnostic overview
        </Button>
      </div>
    )
  }

  const question = form.questions[currentIndex]
  return (
    <>
      <div
        data-hide-global-footer
        className="min-h-svh bg-background text-foreground"
      >
        <header className="flex min-h-20 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-foreground px-5 py-4 sm:px-8 lg:px-12">
          <div className="flex min-w-0 items-center gap-3">
            <ScoutMark className="size-11" />
            <div className="min-w-0">
              <p className="font-brand text-xl font-black tracking-tight sm:text-2xl">
                SCOUT ACT
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {form.title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {(phase === "questions" || phase === "review") &&
            timeRemaining !== null ? (
              <div
                role="timer"
                aria-label={`Diagnostic time remaining: ${formatAssessmentTime(timeRemaining)}`}
                className={cn(
                  "flex min-h-11 items-center gap-2 border-2 border-foreground px-3 py-1.5",
                  timeRemaining <= 300 &&
                    "border-[var(--scout-coral)] bg-[var(--coach-surface)] text-destructive"
                )}
              >
                <Clock3Icon
                  className={cn(
                    "size-4",
                    timeRemaining <= 60 && "animate-pulse"
                  )}
                  aria-hidden="true"
                />
                <span>
                  <span className="hidden text-[0.62rem] font-bold tracking-wide uppercase lg:block">
                    {timeRemaining === 0 ? "Time is up" : "Time remaining"}
                  </span>
                  <span className="block font-mono text-sm font-black tabular-nums sm:text-base">
                    {formatAssessmentTime(timeRemaining)}
                  </span>
                </span>
              </div>
            ) : null}
            <span
              className={cn(
                "hidden items-center gap-2 text-sm sm:flex",
                saveStatus === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
              role={saveStatus === "error" ? "alert" : "status"}
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
            {phase === "results" ? null : (
              <Button type="button" variant="ghost" onClick={saveAndExit}>
                Save and exit
              </Button>
            )}
          </div>
          {saveStatus === "error" ? (
            <p
              className="flex w-full items-center gap-2 text-sm font-semibold text-destructive sm:hidden"
              role="alert"
            >
              <CircleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
              Save failed. Your latest progress may not be saved.
            </p>
          ) : null}
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex max-w-[96rem] flex-col px-4 py-7 sm:px-8 lg:py-10"
        >
          {phase === "questions" ? (
            <QuestionView
              form={form}
              question={question}
              currentIndex={currentIndex}
              answers={answers}
              returnToReview={reviewReturnIndex === currentIndex}
              onAnswer={(choiceId) => {
                rapidAnswerCoach.recordAnswer(question.id)
                const nextAnswers = { ...answers, [question.id]: choiceId }
                setAnswers(nextAnswers)
                if (reviewReturnIndex === currentIndex) {
                  returnToReview(nextAnswers)
                  return
                }
                persistProgress(nextAnswers, currentIndex, "questions")
              }}
              onPrevious={() => {
                setReviewReturnIndex(null)
                moveToQuestion(Math.max(0, currentIndex - 1))
              }}
              onNext={() => {
                if (reviewReturnIndex === currentIndex) {
                  returnToReview()
                  return
                }
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
              timeExpired={timeExpired}
              status={status}
              error={error}
              onEdit={editFromReview}
              onSubmit={() => {
                timedSubmitAttempted.current = true
                void submitDiagnostic(timeExpired)
              }}
            />
          ) : phase === "remediation" && result && remediation ? (
            <AssessmentRemediation
              assessmentLabel="Diagnostic"
              progress={remediation}
              items={remediation.requiredQuestionIds.flatMap(
                (questionId): AssessmentRemediationItem[] => {
                  const question = form.questions.find(
                    (candidate) => candidate.id === questionId
                  )
                  const feedback = result.feedback.find(
                    (candidate) => candidate.questionId === questionId
                  )
                  return question && feedback
                    ? [
                        {
                          question,
                          selectedChoiceId:
                            feedback.selectedChoiceId ===
                            UNANSWERED_DIAGNOSTIC_CHOICE_ID
                              ? null
                              : feedback.selectedChoiceId,
                          correctChoiceId: feedback.correctChoiceId,
                          rationale: feedback.rationale,
                        },
                      ]
                    : []
                }
              )}
              onSubmit={answerRemediation}
              onAskMrKim={onAskMrKim}
              onComplete={() => {
                if (!attemptId) {
                  setError(
                    "This diagnostic attempt is missing its saved identity. Reload it before continuing."
                  )
                  return
                }
                onComplete(result, attemptId)
              }}
            />
          ) : result ? (
            <ResultsView
              result={result}
              purpose={purpose}
              onComplete={() => {
                if (purpose === "round" && remediation?.status === "required") {
                  setPhase("remediation")
                  return
                }
                if (!attemptId) {
                  setError(
                    "This diagnostic attempt is missing its saved identity. Reload it before continuing."
                  )
                  return
                }
                onComplete(result, attemptId)
              }}
              canViewTechnicalDetails={canViewTechnicalDetails}
            />
          ) : null}
        </main>
      </div>
      <RapidAnswerCoachDialog
        open={rapidAnswerCoach.open}
        onDismiss={rapidAnswerCoach.dismiss}
      />
    </>
  )
}
