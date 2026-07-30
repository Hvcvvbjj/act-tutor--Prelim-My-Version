"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  Clock3Icon,
  FlagIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  RadioGroup,
  VisuallyHiddenRadioGroupItem,
} from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { ScoutMark } from "@/components/tutor/scout"
import type { ReportedOfficialScore } from "@/components/tutor/types"
import {
  isNationalActTestDate,
  upcomingNationalActTestDates,
} from "@/lib/act-test-dates"
import { cn } from "@/lib/utils"
import type { CoreSectionScores } from "@act-tutor/core"

export type TestDayOutcome =
  "score_reported" | "scores_pending" | "did_not_test"

export interface NewOfficialActScore {
  testDate: string
  composite: number
  sections: CoreSectionScores | null
}

export interface TestDayDraftScores {
  composite?: number
  sections?: CoreSectionScores | null
}

export interface TestDayCheckInResult {
  testDate: string
  outcome: TestDayOutcome
  newOfficialScore?: NewOfficialActScore
  nextTestDate?: string
  doneForNow: boolean
}

export interface TestDayCheckInProps {
  testDate: string
  currentComposite: number
  officialScoreHistory: readonly ReportedOfficialScore[]
  baselineOfficialComposite?: number | null
  initialDraftScores?: TestDayDraftScores
  preserveCurrentCycle?: boolean
  onComplete: (result: TestDayCheckInResult) => void | Promise<void>
  onSnooze: () => void
}

type Stage = "outcome" | "score" | "next"
type NextStepChoice = "" | "schedule" | "done"
type ScoreKey = "composite" | keyof CoreSectionScores
type ScoreDraft = Record<ScoreKey, string>
type ScoreErrors = Partial<Record<ScoreKey, string>>

const OUTCOME_OPTIONS: ReadonlyArray<{
  value: TestDayOutcome
  title: string
  detail: string
  icon: typeof CheckCircle2Icon
}> = [
  {
    value: "score_reported",
    title: "I tested and have my scores",
    detail: "Enter the official score you received.",
    icon: CheckCircle2Icon,
  },
  {
    value: "scores_pending",
    title: "I tested; scores aren’t back",
    detail: "Save the check-in without guessing a score.",
    icon: Clock3Icon,
  },
  {
    value: "did_not_test",
    title: "I didn’t test that day",
    detail: "That’s okay. We’ll choose what comes next.",
    icon: FlagIcon,
  },
]

const SECTION_SCORE_FIELDS: ReadonlyArray<{
  key: keyof CoreSectionScores
  label: string
}> = [
  { key: "english", label: "English" },
  { key: "math", label: "Math" },
  { key: "reading", label: "Reading" },
]

function scoreDraftValue(value: number | undefined) {
  return typeof value === "number" ? String(value) : ""
}

function initialScoreDraft(
  initialDraftScores: TestDayDraftScores | undefined
): ScoreDraft {
  return {
    composite: scoreDraftValue(initialDraftScores?.composite),
    english: scoreDraftValue(initialDraftScores?.sections?.english),
    math: scoreDraftValue(initialDraftScores?.sections?.math),
    reading: scoreDraftValue(initialDraftScores?.sections?.reading),
  }
}

function parseActScore(value: string): number | null {
  if (!/^\d{1,2}$/.test(value.trim())) return null
  const score = Number(value)
  return Number.isInteger(score) && score >= 1 && score <= 36 ? score : null
}

function isValidActScore(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 36
}

function isCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function localToday() {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatCalendarDate(value: string) {
  if (!isCalendarDate(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function latestPriorOfficialScore(
  history: readonly ReportedOfficialScore[],
  testDate: string
) {
  const validTestDate = isCalendarDate(testDate)
  const candidates = history.filter(
    (score) =>
      isValidActScore(score.composite) &&
      isCalendarDate(score.testDate) &&
      (!validTestDate || score.testDate < testDate)
  )

  return [...candidates]
    .sort((a, b) => a.testDate.localeCompare(b.testDate))
    .at(-1)
}

function ChoiceCard({
  selected,
  icon: Icon,
  title,
  detail,
  children,
}: {
  selected: boolean
  icon: typeof CheckCircle2Icon
  title: string
  detail: string
  children: React.ReactNode
}) {
  return (
    <label
      className={cn(
        "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl border-2 bg-background p-4 transition-[border-color,background-color,transform,box-shadow] duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40 hover:-translate-y-0.5 hover:border-foreground motion-reduce:transform-none",
        selected &&
          "border-primary bg-secondary shadow-[3px_3px_0_var(--foreground)]"
      )}
    >
      {children}
      <span
        className={cn(
          "col-start-1 row-start-1 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground",
          selected && "bg-primary text-primary-foreground"
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="col-start-2 row-start-1 min-w-0">
        <span className="block font-bold">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">
          {detail}
        </span>
      </span>
    </label>
  )
}

function ScoreInput({
  scoreKey,
  label,
  required,
  value,
  error,
  onChange,
}: {
  scoreKey: ScoreKey
  label: string
  required: boolean
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  const inputId = `test-day-${scoreKey}`
  const helpId = `${inputId}-help`
  const errorId = `${inputId}-error`

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={inputId}>
        {label}
        <span className="font-normal text-muted-foreground">
          {required ? "Required" : "Optional"}
        </span>
      </FieldLabel>
      <Input
        id={inputId}
        name={scoreKey}
        type="number"
        inputMode="numeric"
        min={1}
        max={36}
        step={1}
        required={required}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${helpId} ${errorId}` : helpId}
        className="h-12 text-lg font-bold tabular-nums"
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldDescription id={helpId}>Whole number from 1–36.</FieldDescription>
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  )
}

function officialScoreFeedback(
  composite: number,
  prior: Pick<ReportedOfficialScore, "composite"> | undefined
) {
  if (!prior) {
    return {
      title: "This is our new starting point.",
      message: "I’ll use this official score to build your next study cycle.",
    }
  }

  const difference = composite - prior.composite
  if (difference > 0) {
    return {
      title: `You moved up ${difference} ${difference === 1 ? "point" : "points"}.`,
      message: `Your official composite went from ${prior.composite} to ${composite}. Nice work. I’ll keep what worked and adjust what comes next.`,
    }
  }

  if (difference === 0) {
    return {
      title: "You held your score.",
      message: `Your official composite is still ${composite}. That isn’t a dead end. I’ll target the skills most likely to unlock the next point.`,
    }
  }

  const decrease = Math.abs(difference)
  return {
    title: "One test does not erase your progress.",
    message: `This score was ${decrease} ${decrease === 1 ? "point" : "points"} below your last one (${prior.composite} to ${composite}). That’s okay. I’ll use what this test showed to adjust your next cycle.`,
  }
}

export function TestDayCheckIn({
  testDate,
  officialScoreHistory,
  baselineOfficialComposite,
  initialDraftScores,
  preserveCurrentCycle = false,
  onComplete,
  onSnooze,
}: TestDayCheckInProps) {
  const [stage, setStage] = useState<Stage>("outcome")
  const [outcome, setOutcome] = useState<TestDayOutcome | "">("")
  const [scores, setScores] = useState<ScoreDraft>(() =>
    initialScoreDraft(initialDraftScores)
  )
  const [sectionScoresEnabled, setSectionScoresEnabled] = useState(
    initialDraftScores?.sections != null
  )
  const [scoreErrors, setScoreErrors] = useState<ScoreErrors>({})
  const [nextStepChoice, setNextStepChoice] = useState<NextStepChoice>("")
  const [nextTestDate, setNextTestDate] = useState("")
  const [nextStepError, setNextStepError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [saving, setSaving] = useState(false)

  const headingRef = useRef<HTMLHeadingElement>(null)
  const scoreFormRef = useRef<HTMLFormElement>(null)
  const today = useMemo(() => localToday(), [])
  const nextNationalTestDates = useMemo(
    () => upcomingNationalActTestDates(today, 4),
    [today]
  )
  const formattedTestDate = useMemo(
    () => formatCalendarDate(testDate),
    [testDate]
  )
  const priorOfficialScore = useMemo(() => {
    const historical = latestPriorOfficialScore(officialScoreHistory, testDate)
    if (historical) return historical
    return isValidActScore(baselineOfficialComposite ?? 0)
      ? { composite: baselineOfficialComposite as number }
      : undefined
  }, [baselineOfficialComposite, officialScoreHistory, testDate])
  const parsedComposite = parseActScore(scores.composite)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [stage])

  function updateScore(key: ScoreKey, value: string) {
    setScores((current) => ({ ...current, [key]: value }))
    setScoreErrors((current) => ({ ...current, [key]: undefined }))
    setSubmitError("")
  }

  function validateScores() {
    const errors: ScoreErrors = {}

    if (parseActScore(scores.composite) === null) {
      errors.composite = "Composite must be a whole number from 1–36."
    }
    if (sectionScoresEnabled) {
      for (const field of SECTION_SCORE_FIELDS) {
        if (parseActScore(scores[field.key]) === null) {
          errors[field.key] = `${field.label} must be a whole number from 1–36.`
        }
      }
    }

    setScoreErrors(errors)
    if (Object.keys(errors).length > 0) {
      window.requestAnimationFrame(() => {
        scoreFormRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus()
      })
      return false
    }
    return true
  }

  function continueFromOutcome() {
    if (!outcome) return
    setSubmitError("")
    setStage(outcome === "score_reported" ? "score" : "next")
  }

  function continueFromScore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validateScores()) return
    setSubmitError("")
    setStage("next")
  }

  function goBack() {
    setSubmitError("")
    setNextStepError("")
    if (stage === "next") {
      setStage(outcome === "score_reported" ? "score" : "outcome")
      return
    }
    setStage("outcome")
  }

  function buildOfficialScore(): NewOfficialActScore | undefined {
    const composite = parseActScore(scores.composite)
    if (outcome !== "score_reported" || composite === null) return undefined

    const english = parseActScore(scores.english)
    const math = parseActScore(scores.math)
    const reading = parseActScore(scores.reading)
    if (
      sectionScoresEnabled &&
      (english === null || math === null || reading === null)
    ) {
      return undefined
    }

    return {
      testDate,
      composite,
      sections: sectionScoresEnabled
        ? {
            english: english as number,
            math: math as number,
            reading: reading as number,
          }
        : null,
    }
  }

  async function completeCheckIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError("")

    if (!preserveCurrentCycle && !nextStepChoice) {
      setNextStepError("Choose a next step.")
      return
    }

    if (!preserveCurrentCycle && nextStepChoice === "schedule") {
      if (!isNationalActTestDate(nextTestDate) || nextTestDate <= today) {
        setNextStepError("Choose an upcoming national ACT date.")
        window.requestAnimationFrame(() => {
          document
            .querySelector<HTMLElement>(
              '[aria-labelledby="next-test-date-label"] [role="radio"]'
            )
            ?.focus()
        })
        return
      }
    }

    if (!outcome) {
      setStage("outcome")
      return
    }

    const newOfficialScore = buildOfficialScore()
    if (outcome === "score_reported" && !newOfficialScore) {
      setStage("score")
      return
    }

    setSaving(true)
    try {
      await onComplete({
        testDate,
        outcome,
        ...(newOfficialScore ? { newOfficialScore } : {}),
        ...(!preserveCurrentCycle && nextStepChoice === "schedule"
          ? { nextTestDate }
          : {}),
        doneForNow: preserveCurrentCycle ? false : nextStepChoice === "done",
      })
    } catch {
      setSubmitError(
        "Your check-in could not be saved. Nothing was lost—try again."
      )
    } finally {
      setSaving(false)
    }
  }

  const feedback =
    outcome === "score_reported" && parsedComposite !== null
      ? officialScoreFeedback(parsedComposite, priorOfficialScore)
      : outcome === "scores_pending"
        ? {
            title: "No need to guess.",
            message:
              "We’ll mark your scores as pending and update your plan when the official numbers arrive.",
          }
        : {
            title: "That’s okay. Plans change.",
            message:
              "Choose another date if you have one, or pause testing for now.",
          }

  return (
    <div
      data-hide-global-footer
      className="min-h-svh bg-[var(--canvas)] text-foreground"
    >
      <header className="flex min-h-14 items-center justify-between gap-4 border-b border-border/80 bg-background px-5 py-1.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div aria-hidden="true">
            <ScoutMark className="size-8" />
          </div>
          <p className="font-brand text-lg font-black tracking-tight">
            Alex<span className="text-primary">ACT</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <details className="group relative">
            <summary className="cursor-pointer list-none rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              About Mr. Kim
            </summary>
            <p className="absolute top-[calc(100%+0.5rem)] right-0 z-20 w-72 rounded-lg border bg-background p-4 text-sm leading-6 text-muted-foreground shadow-lg">
              Mr. Kim is AlexACT&apos;s AI tutor. He can explain lessons and
              adjust practice, but he cannot verify or submit official scores.
            </p>
          </details>
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={onSnooze}
          >
            Ask me later
          </Button>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12 lg:py-16"
      >
        <section className="min-w-0">
          <div
            key={stage}
            className="animate-in duration-300 fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
          >
            {stage === "outcome" ? (
              <>
                <p className="text-xs font-bold tracking-[0.12em] text-primary uppercase">
                  Mr. Kim · Test-day check-in
                </p>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="mt-3 max-w-3xl font-heading text-3xl leading-tight font-black tracking-[-0.025em] outline-none sm:text-5xl"
                >
                  How did{" "}
                  {formattedTestDate
                    ? `your ${formattedTestDate} test`
                    : "test day"}{" "}
                  go?
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Tell me what happened. I&apos;ll adjust your plan—not judge
                  your effort.
                </p>

                <RadioGroup
                  value={outcome}
                  onValueChange={(value) => {
                    setOutcome(value as TestDayOutcome)
                    setSubmitError("")
                  }}
                  aria-label="What happened on test day"
                  className="mt-7 grid gap-3"
                >
                  {OUTCOME_OPTIONS.map((option) => (
                    <ChoiceCard
                      key={option.value}
                      selected={outcome === option.value}
                      icon={option.icon}
                      title={option.title}
                      detail={option.detail}
                    >
                      <VisuallyHiddenRadioGroupItem value={option.value} />
                    </ChoiceCard>
                  ))}
                </RadioGroup>

                <div className="mt-8 flex justify-end">
                  <Button
                    type="button"
                    size="xl"
                    disabled={!outcome}
                    onClick={continueFromOutcome}
                  >
                    Continue
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                </div>
              </>
            ) : null}

            {stage === "score" ? (
              <form ref={scoreFormRef} noValidate onSubmit={continueFromScore}>
                <p className="text-xs font-bold tracking-[0.12em] text-primary uppercase">
                  Official score
                </p>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="mt-3 max-w-3xl font-heading text-3xl leading-tight font-black tracking-[-0.025em] outline-none sm:text-5xl"
                >
                  What score did you get?
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Enter your official composite. Section scores are optional.
                </p>

                <div className="mt-7 max-w-sm">
                  <ScoreInput
                    scoreKey="composite"
                    label="Composite"
                    required
                    value={scores.composite}
                    error={scoreErrors.composite}
                    onChange={(value) => updateScore("composite", value)}
                  />
                </div>

                <Field
                  orientation="horizontal"
                  className="mt-6 rounded-xl border border-border bg-muted/40 px-4 py-4"
                >
                  <FieldContent>
                    <FieldLabel htmlFor="include-section-scores">
                      Add section scores
                    </FieldLabel>
                    <FieldDescription id="section-scores-help">
                      Optional. Turn this on only if you have English, Math, and
                      Reading.
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="include-section-scores"
                    checked={sectionScoresEnabled}
                    aria-describedby="section-scores-help"
                    onCheckedChange={(enabled) => {
                      setSectionScoresEnabled(enabled)
                      setScoreErrors((current) => ({
                        ...current,
                        english: undefined,
                        math: undefined,
                        reading: undefined,
                      }))
                    }}
                  />
                </Field>

                {sectionScoresEnabled ? (
                  <div className="mt-6 grid gap-5 sm:grid-cols-3">
                    {SECTION_SCORE_FIELDS.map((field) => (
                      <ScoreInput
                        key={field.key}
                        scoreKey={field.key}
                        label={field.label}
                        required
                        value={scores[field.key]}
                        error={scoreErrors[field.key]}
                        onChange={(value) => updateScore(field.key, value)}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="button" variant="ghost" onClick={goBack}>
                    <ChevronLeftIcon data-icon="inline-start" />
                    Back
                  </Button>
                  <Button type="submit" size="xl">
                    Continue
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                </div>
              </form>
            ) : null}

            {stage === "next" ? (
              <form noValidate onSubmit={completeCheckIn}>
                <p className="text-xs font-bold tracking-[0.12em] text-primary uppercase">
                  Mr. Kim · Next step
                </p>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="mt-3 max-w-3xl font-heading text-3xl leading-tight font-black tracking-[-0.025em] outline-none sm:text-5xl"
                >
                  {feedback.title}
                </h1>

                <p
                  className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg"
                  role="status"
                  aria-live="polite"
                >
                  {feedback.message}
                </p>

                {preserveCurrentCycle ? (
                  <div className="mt-8 border-y-2 border-foreground py-6">
                    <p className="font-heading text-xl font-black sm:text-2xl">
                      Your current test plan stays unchanged.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      This closes the older check-in without replacing your ACT
                      date or pausing your study cycle.
                    </p>
                  </div>
                ) : (
                  <fieldset className="mt-8">
                    <legend className="font-heading text-xl font-black sm:text-2xl">
                      Do you already have another ACT date?
                    </legend>
                    <p
                      id="next-step-help"
                      className="mt-2 text-sm leading-6 text-muted-foreground"
                    >
                      Add it now, or pause testing without losing this check-in.
                    </p>
                    <RadioGroup
                      value={nextStepChoice}
                      onValueChange={(value) => {
                        setNextStepChoice(value as NextStepChoice)
                        setNextStepError("")
                        setSubmitError("")
                      }}
                      aria-describedby={
                        nextStepError
                          ? "next-step-help next-step-error"
                          : "next-step-help"
                      }
                      aria-invalid={Boolean(nextStepError && !nextStepChoice)}
                      className="mt-5 grid gap-3 sm:grid-cols-2"
                    >
                      <ChoiceCard
                        selected={nextStepChoice === "schedule"}
                        icon={CalendarDaysIcon}
                        title="Yes—add my next date"
                        detail="Use a date after today."
                      >
                        <VisuallyHiddenRadioGroupItem value="schedule" />
                      </ChoiceCard>
                      <ChoiceCard
                        selected={nextStepChoice === "done"}
                        icon={CheckCircle2Icon}
                        title="I’m done for now"
                        detail="Save this result and pause the test cycle."
                      >
                        <VisuallyHiddenRadioGroupItem value="done" />
                      </ChoiceCard>
                    </RadioGroup>

                    {nextStepChoice === "schedule" ? (
                      <div className="mt-5 max-w-2xl">
                        <p
                          id="next-test-date-label"
                          className="text-sm leading-none font-medium"
                        >
                          Next national ACT date
                        </p>
                        <RadioGroup
                          value={nextTestDate}
                          onValueChange={(value) => {
                            setNextTestDate(value)
                            setNextStepError("")
                            setSubmitError("")
                          }}
                          aria-labelledby="next-test-date-label"
                          aria-describedby={
                            nextStepError
                              ? "next-test-date-help next-step-error"
                              : "next-test-date-help"
                          }
                          aria-invalid={Boolean(nextStepError)}
                          className="mt-3 grid gap-3 sm:grid-cols-2"
                        >
                          {nextNationalTestDates.map((entry) => (
                            <ChoiceCard
                              key={entry.date}
                              selected={nextTestDate === entry.date}
                              icon={CalendarDaysIcon}
                              title={entry.label}
                              detail="Published national ACT date"
                            >
                              <VisuallyHiddenRadioGroupItem
                                value={entry.date}
                              />
                            </ChoiceCard>
                          ))}
                        </RadioGroup>
                        <FieldDescription id="next-test-date-help">
                          Only published national ACT dates are available here.
                        </FieldDescription>
                      </div>
                    ) : null}
                    <FieldError id="next-step-error" className="mt-3">
                      {nextStepError}
                    </FieldError>
                  </fieldset>
                )}

                {submitError ? (
                  <Alert variant="destructive" className="mt-6 p-4">
                    <AlertTitle>Couldn’t save the check-in</AlertTitle>
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={saving}
                    onClick={goBack}
                  >
                    <ChevronLeftIcon data-icon="inline-start" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    size="xl"
                    disabled={
                      saving || (!preserveCurrentCycle && !nextStepChoice)
                    }
                  >
                    {saving ? "Saving…" : "Save check-in"}
                    {!saving ? <ArrowRightIcon data-icon="inline-end" /> : null}
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  )
}
