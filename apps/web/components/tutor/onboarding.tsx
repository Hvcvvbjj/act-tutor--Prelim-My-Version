"use client"

import { useEffect, useRef } from "react"
import { calendarDaysUntil, type StudyWeekday } from "@act-tutor/core"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MinusIcon,
  PlayCircleIcon,
  PlusIcon,
} from "lucide-react"

import { AccountAccess } from "@/components/tutor/account-access"
import { defaultStudyAvailability } from "@/components/tutor/adaptive-plan-studio-client"
import { ScoutMark } from "@/components/tutor/scout"
import type { PlacementDraft } from "@/components/tutor/types"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { formatCalendarDate } from "@/lib/dates"
import type {
  AuthViewer,
  PendingTutorSetup,
  SavedTutorPlan,
} from "@/lib/auth-types"
import { cn } from "@/lib/utils"

interface OnboardingProps {
  draft: PlacementDraft
  viewer: AuthViewer
  savedPlan: SavedTutorPlan | null
  pendingSetup: PendingTutorSetup | null
  error: string | null
  step: number
  today: string
  onBack: () => void
  onCancel?: () => void
  onContinue: () => void
  onDismissWelcome: () => void
  onStartFullDiagnostic: () => void
  onJudgeDemo: () => void
  showWelcome: boolean
  onViewerChange: (viewer: AuthViewer) => void
  onUpdate: (update: Partial<PlacementDraft>) => void
}

const STEP_LABELS = ["Goal", "Scores", "Schedule"] as const

const WEEKDAY_LABELS: Record<StudyWeekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
}

const WEEKDAY_BY_UTC_DAY: ReadonlyArray<StudyWeekday> = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
]

const STEP_COPY = [
  {
    title: "Choose your ACT goal",
    description: "Choose the Composite score you want to work toward.",
    technical:
      "Scout raises English, Math, and Reading targets by whole points. It chooses the combination whose rounded average reaches your goal with the smallest total squared increase; your focus preference breaks ties.",
    next: "Add my starting score",
  },
  {
    title: "Choose your starting point",
    description: "Add what you know today, or start without a score.",
    technical: null,
    next: "Set my schedule",
  },
  {
    title: "Make a schedule you can keep",
    description: "Choose your test date, study days, and minutes.",
    technical: null,
    next: "Create my first plan",
  },
] as const

interface ScoreFieldProps {
  id: string
  label: string
  value: number
  error?: string | null
  onChange: (value: number) => void
}

function ScoreField({ id, label, value, error, onChange }: ScoreFieldProps) {
  const errorId = `${id}-error`
  return (
    <Field data-invalid={Boolean(error)} className="gap-2">
      <FieldLabel htmlFor={id} className="text-sm font-semibold">
        {label}
      </FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={36}
        value={value || ""}
        aria-label={`${label} ACT score`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-12 w-full text-lg font-semibold tabular-nums"
      />
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  )
}

function errorForScore(error: string | null, label: string) {
  return error?.startsWith(`${label} score`) ? error : null
}

function StepTracker({ step }: { step: number }) {
  return (
    <nav aria-label="Setup progress" className="mx-auto max-w-4xl">
      <ol className="grid grid-cols-3 gap-2">
        {STEP_LABELS.map((label, index) => {
          const number = index + 1
          const active = number === step
          const complete = number < step
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className="min-w-0"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block h-1.5 rounded-full",
                  active || complete ? "bg-primary" : "bg-border"
                )}
              />
              <span
                className={cn(
                  "mt-2 hidden truncate text-sm font-semibold sm:block",
                  active
                    ? "text-primary"
                    : complete
                      ? "text-foreground"
                      : "text-muted-foreground"
                )}
              >
                {number}. {label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function SchedulePreview({
  draft,
  today,
}: {
  draft: PlacementDraft
  today: string
}) {
  const availability = defaultStudyAvailability(
    today,
    draft.studyDaysPerWeek,
    draft.minutesPerSession
  )
  const todayWeekday =
    WEEKDAY_BY_UTC_DAY[new Date(`${today}T00:00:00.000Z`).getUTCDay()]
  const dayLabels = availability.entries.map((entry) =>
    entry.weekday === todayWeekday
      ? `Today (${WEEKDAY_LABELS[entry.weekday]})`
      : WEEKDAY_LABELS[entry.weekday]
  )
  return (
    <aside
      role="status"
      aria-atomic="true"
      data-testid="schedule-preview"
      className="border-t border-border/80 pt-4"
    >
      <p className="text-sm leading-6">
        <strong>Your week:</strong> {draft.studyDaysPerWeek} ×{" "}
        {draft.minutesPerSession}-minute sessions — {dayLabels.join(", ")}.
        <span className="text-muted-foreground">
          {" "}
          Change the days later in My Week.
        </span>
      </p>
    </aside>
  )
}

function testDateDescription(testDate: string, today: string) {
  if (!testDate) {
    return "Choose the date you plan to take the ACT."
  }

  try {
    const daysToTest = calendarDaysUntil(today, testDate)
    const distance =
      daysToTest > 0
        ? `${daysToTest} ${daysToTest === 1 ? "day" : "days"} away`
        : "choose a future date"
    return `${formatCalendarDate(testDate)} · ${distance}`
  } catch {
    return "Choose a valid future test date."
  }
}

export function Onboarding({
  draft,
  viewer,
  savedPlan,
  pendingSetup,
  error,
  step,
  today,
  onBack,
  onCancel,
  onContinue,
  onDismissWelcome,
  onStartFullDiagnostic,
  onJudgeDemo,
  showWelcome,
  onViewerChange,
  onUpdate,
}: OnboardingProps) {
  const stepCopy = STEP_COPY[step - 1] ?? STEP_COPY[0]
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const scoreChoiceRef = useRef<HTMLDivElement>(null)
  const scoreChoiceError =
    error === "Choose what you know about your current ACT scores."

  useEffect(() => {
    if (showWelcome) return
    const frame = window.requestAnimationFrame(() => {
      stepHeadingRef.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [showWelcome, step])

  useEffect(() => {
    if (step !== 2 || !scoreChoiceError) return
    const frame = window.requestAnimationFrame(() => {
      scoreChoiceRef.current
        ?.querySelector<HTMLElement>('[role="radio"]')
        ?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [scoreChoiceError, step])

  if (showWelcome) {
    return (
      <div
        data-hide-global-footer
        className="min-h-svh overflow-hidden bg-[var(--canvas)] text-foreground"
      >
        <header className="relative z-20 border-b border-border/80 bg-background/95 backdrop-blur-xl">
          <div className="mx-auto flex min-h-18 max-w-[90rem] items-center justify-between gap-5 px-5 py-3 sm:px-8 lg:px-12">
            <div className="flex shrink-0 items-center gap-3">
              <ScoutMark className="size-10" />
              <p className="font-brand text-lg font-black tracking-[-0.03em]">
                SCOUT <span className="text-primary">ACT</span>
              </p>
            </div>
            <nav
              className="hidden items-center gap-7 text-sm font-bold text-muted-foreground lg:flex"
              aria-label="Welcome"
            >
              <a
                href="/how-scout-works"
                className="transition-colors hover:text-foreground"
              >
                How it works
              </a>
              <button
                type="button"
                className="transition-colors hover:text-foreground"
                onClick={onStartFullDiagnostic}
              >
                Full diagnostic
              </button>
              <a
                href="#meet-mr-kim"
                className="transition-colors hover:text-foreground"
              >
                Meet Mr. Kim
              </a>
            </nav>
            <div className="flex items-center">
              <AccountAccess
                viewer={viewer}
                savedPlan={savedPlan}
                pendingSetup={pendingSetup}
                onViewerChange={onViewerChange}
                guestLabel="Sign in"
              />
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1}>
          <section className="relative mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-[90rem] items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,0.88fr)] lg:px-12 lg:py-14">
            <div className="relative z-10 max-w-3xl">
              <h1
                id="scout-welcome-title"
                className="max-w-3xl font-heading text-[clamp(3.4rem,6vw,6.2rem)] leading-[0.9] font-black tracking-[-0.065em]"
              >
                Your ACT plan starts with a{" "}
                <span className="text-primary">real baseline.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                Enter a recent score, or take Scout&apos;s full 66-question
                diagnostic. Mr. Kim turns the result into lessons you can fit
                into an actual week.
              </p>
              <div className="mt-9">
                <Button
                  type="button"
                  size="xl"
                  className="min-w-52"
                  onClick={onDismissWelcome}
                >
                  Build my starting plan
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </div>
            </div>

            <figure
              id="meet-mr-kim"
              className="relative mx-auto hidden h-[min(72svh,48rem)] w-full max-w-[38rem] overflow-hidden rounded-[2rem] border border-border bg-[radial-gradient(circle_at_50%_35%,var(--info-surface),var(--canvas)_62%)] shadow-[0_24px_70px_rgb(16_33_63_/_0.18)] lg:block"
            >
              <div className="absolute inset-x-0 top-[8%] flex justify-center">
                <ScoutMark className="size-[min(28rem,70vh)]" />
              </div>
              <figcaption className="absolute inset-x-5 bottom-5 rounded-2xl border border-border/80 bg-background/92 p-5 text-foreground backdrop-blur-lg">
                <p className="font-mono text-xs font-black tracking-[0.12em] text-primary uppercase">
                  Mr. Kim · AI tutor
                </p>
                <p className="mt-2 text-base leading-6">
                  “Hi—I&apos;m Mr. Kim. I&apos;ll explain the hard part, then
                  get you back to the question.”
                </p>
              </figcaption>
            </figure>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div
      data-hide-global-footer
      className="min-h-svh bg-[var(--canvas)] text-foreground"
    >
      <header className="flex min-h-14 items-center justify-between gap-4 border-b border-border/80 bg-background px-5 py-1.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <ScoutMark className="size-8" />
          <p className="font-brand text-lg font-black tracking-tight">
            SCOUT <span className="text-primary">ACT</span>
          </p>
        </div>
        <AccountAccess
          viewer={viewer}
          savedPlan={savedPlan}
          pendingSetup={pendingSetup}
          onViewerChange={onViewerChange}
        />
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 sm:py-8"
      >
        <StepTracker step={step} />

        <div className="mx-auto mt-7 max-w-4xl">
          <section className="paper-panel min-w-0 rounded-2xl border border-border/80 bg-card p-5 sm:p-7">
            <h1
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-heading text-4xl leading-tight font-black tracking-[-0.025em] outline-none"
            >
              {stepCopy.title}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
              {stepCopy.description}
            </p>
            {viewer.technicalDetails && stepCopy.technical ? (
              <details className="mt-4 max-w-2xl border-l-2 border-primary/35 pl-4 text-sm">
                <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  How Scout sets section targets
                </summary>
                <p className="mt-2 leading-6 text-muted-foreground">
                  {stepCopy.technical}
                </p>
              </details>
            ) : null}

            <div key={step} className="mt-6">
              {step === 1 ? (
                <FieldSet className="min-w-0">
                  <FieldLegend className="sr-only">Goal score</FieldLegend>
                  <FieldDescription id="goal-score-help" className="sr-only">
                    Choose a Composite score from 1 to 36. This plan uses
                    English, Math, and Reading to calculate the Composite.
                  </FieldDescription>
                  <div className="mt-7 grid w-full max-w-lg grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:gap-8">
                    <Button
                      type="button"
                      size="icon-lg"
                      variant="outline"
                      aria-label="Decrease goal score"
                      aria-describedby="goal-score-help"
                      disabled={draft.goal <= 1}
                      onClick={() => onUpdate({ goal: draft.goal - 1 })}
                    >
                      <MinusIcon />
                    </Button>
                    <Field className="min-w-0 items-center gap-1 sm:min-w-28">
                      <FieldLabel htmlFor="goal-composite" className="sr-only">
                        Goal Composite
                      </FieldLabel>
                      <Input
                        id="goal-composite"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={36}
                        step={1}
                        value={draft.goal}
                        aria-describedby="goal-score-help"
                        onChange={(event) => {
                          const goal = Number(event.target.value)
                          if (
                            Number.isInteger(goal) &&
                            goal >= 1 &&
                            goal <= 36
                          ) {
                            onUpdate({ goal })
                          }
                        }}
                        className="h-auto max-w-28 rounded-lg border-0 bg-transparent px-1 py-0 text-center font-heading text-6xl font-black tracking-[-0.05em] text-primary tabular-nums shadow-none hover:border-transparent focus-visible:border-ring focus-visible:ring-3 md:text-6xl"
                      />
                    </Field>
                    <Button
                      type="button"
                      size="icon-lg"
                      variant="outline"
                      aria-label="Increase goal score"
                      aria-describedby="goal-score-help"
                      disabled={draft.goal >= 36}
                      onClick={() => onUpdate({ goal: draft.goal + 1 })}
                    >
                      <PlusIcon />
                    </Button>
                  </div>
                </FieldSet>
              ) : null}

              {step === 2 ? (
                <FieldSet>
                  <FieldLegend className="sr-only">
                    Current ACT score information
                  </FieldLegend>
                  <FieldDescription
                    id="starting-score-help"
                    className="sr-only"
                  >
                    Choose the option that matches what you know today.
                  </FieldDescription>
                  <RadioGroup
                    ref={scoreChoiceRef}
                    value={
                      draft.priorScoreChoice === "undecided"
                        ? ""
                        : draft.priorScoreChoice
                    }
                    aria-invalid={scoreChoiceError}
                    aria-describedby={
                      scoreChoiceError
                        ? "starting-score-help starting-score-error"
                        : "starting-score-help"
                    }
                    onValueChange={(value) =>
                      onUpdate({
                        priorScoreChoice:
                          value as PlacementDraft["priorScoreChoice"],
                        ...(value === "never"
                          ? { startingCheckChoice: "take" as const }
                          : {}),
                      })
                    }
                    className="mt-6 grid gap-3 md:grid-cols-3"
                  >
                    {[
                      ["scores", "I have section scores"],
                      ["composite_only", "I only know my Composite"],
                      ["never", "I haven’t taken the ACT"],
                    ].map(([value, label]) => (
                      <FieldLabel
                        key={value}
                        className={cn(
                          "cursor-pointer rounded-lg border p-4 text-sm transition-colors",
                          draft.priorScoreChoice === value &&
                            "border-primary bg-secondary"
                        )}
                      >
                        <Field orientation="horizontal">
                          <RadioGroupItem value={value} />
                          <FieldContent>
                            <span className="font-semibold">{label}</span>
                          </FieldContent>
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                  <FieldError id="starting-score-error">
                    {scoreChoiceError ? error : null}
                  </FieldError>

                  {draft.priorScoreChoice === "scores" ? (
                    <FieldDescription className="mt-4 max-w-2xl">
                      Add the scores Scout should use as your starting point.
                    </FieldDescription>
                  ) : draft.priorScoreChoice === "composite_only" ? (
                    <FieldDescription className="mt-4 max-w-2xl">
                      Scout will use this number until your answers create
                      section-level estimates.
                    </FieldDescription>
                  ) : null}

                  {draft.priorScoreChoice === "scores" ||
                  draft.priorScoreChoice === "composite_only" ? (
                    <div className="mt-5">
                      <div>
                        <p
                          id="score-source-label"
                          className="text-sm font-semibold"
                        >
                          Where did these scores come from?
                        </p>
                        <RadioGroup
                          value={draft.scoreSource}
                          aria-labelledby="score-source-label"
                          onValueChange={(value) =>
                            onUpdate({
                              scoreSource:
                                value as PlacementDraft["scoreSource"],
                            })
                          }
                          className="mt-2 flex flex-wrap gap-2"
                        >
                          {[
                            ["official", "Official ACT result"],
                            ["practice", "Practice test or estimate"],
                          ].map(([value, label]) => (
                            <FieldLabel
                              key={value}
                              className={cn(
                                "cursor-pointer rounded-full border bg-background px-3 py-2 transition-colors",
                                draft.scoreSource === value &&
                                  "border-primary bg-secondary"
                              )}
                            >
                              <Field orientation="horizontal">
                                <RadioGroupItem value={value} />
                                <FieldContent>
                                  <span className="font-semibold">{label}</span>
                                </FieldContent>
                              </Field>
                            </FieldLabel>
                          ))}
                        </RadioGroup>
                      </div>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <ScoreField
                          id="composite"
                          label="Composite"
                          value={draft.composite}
                          error={errorForScore(error, "Composite")}
                          onChange={(composite) => onUpdate({ composite })}
                        />
                        {draft.priorScoreChoice === "scores" ? (
                          <>
                            <ScoreField
                              id="english"
                              label="English"
                              value={draft.english}
                              error={errorForScore(error, "English")}
                              onChange={(english) => onUpdate({ english })}
                            />
                            <ScoreField
                              id="math"
                              label="Math"
                              value={draft.math}
                              error={errorForScore(error, "Math")}
                              onChange={(math) => onUpdate({ math })}
                            />
                            <ScoreField
                              id="reading"
                              label="Reading"
                              value={draft.reading}
                              error={errorForScore(error, "Reading")}
                              onChange={(reading) => onUpdate({ reading })}
                            />
                          </>
                        ) : null}
                        <Field
                          orientation="horizontal"
                          className="rounded-lg border px-4 py-3 sm:col-span-2"
                        >
                          <FieldContent>
                            <FieldLabel htmlFor="science-toggle">
                              Save a Science score
                            </FieldLabel>
                            <FieldDescription>
                              Optional reference score.
                            </FieldDescription>
                          </FieldContent>
                          <Switch
                            id="science-toggle"
                            checked={draft.scienceEnabled}
                            onCheckedChange={(scienceEnabled) =>
                              onUpdate({ scienceEnabled })
                            }
                          />
                        </Field>
                        {draft.scienceEnabled ? (
                          <ScoreField
                            id="science"
                            label="Science"
                            value={draft.science}
                            error={errorForScore(error, "Science")}
                            onChange={(science) => onUpdate({ science })}
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : draft.priorScoreChoice === "never" ? (
                    <div className="mt-6 max-w-2xl rounded-xl border border-primary/40 bg-secondary p-5">
                      <p className="font-semibold">
                        Your full diagnostic will set the baseline.
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        You&apos;ll answer 66 English, Math, and Reading
                        questions in about 63 minutes. Scout autosaves each
                        section, so you can leave and continue later.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-5 max-w-2xl text-sm text-muted-foreground">
                      Choose one to continue. Scout will not invent a score for
                      you.
                    </p>
                  )}
                </FieldSet>
              ) : null}

              {step === 3 ? (
                <FieldSet>
                  <FieldLegend className="sr-only">Study schedule</FieldLegend>
                  <FieldDescription className="sr-only">
                    Scout fills only the study blocks you choose. You can change
                    them later.
                  </FieldDescription>

                  <div className="mt-5 grid gap-4">
                    <Field data-invalid={Boolean(error)}>
                      <FieldLabel htmlFor="test-date">Next ACT date</FieldLabel>
                      <Input
                        id="test-date"
                        type="date"
                        min={today}
                        value={draft.testDate}
                        aria-invalid={Boolean(error)}
                        aria-describedby={
                          error
                            ? "test-date-help test-date-error"
                            : "test-date-help"
                        }
                        onChange={(event) =>
                          onUpdate({ testDate: event.target.value })
                        }
                        className="h-12 max-w-sm text-base"
                      />
                      <FieldDescription
                        id="test-date-help"
                        aria-live="polite"
                        className="max-w-xl"
                      >
                        {testDateDescription(draft.testDate, today)}
                      </FieldDescription>
                      <FieldError id="test-date-error">{error}</FieldError>
                    </Field>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field>
                        <FieldLabel id="study-days-label">
                          Study days each week
                        </FieldLabel>
                        <div
                          className="grid grid-cols-3 gap-2"
                          role="group"
                          aria-labelledby="study-days-label"
                        >
                          {[2, 3, 4, 5, 6].map((days) => (
                            <Button
                              key={days}
                              type="button"
                              variant={
                                draft.studyDaysPerWeek === days
                                  ? "secondary"
                                  : "outline"
                              }
                              className="h-11"
                              aria-pressed={draft.studyDaysPerWeek === days}
                              onClick={() =>
                                onUpdate({ studyDaysPerWeek: days })
                              }
                            >
                              {days} days
                            </Button>
                          ))}
                        </div>
                      </Field>

                      <Field>
                        <FieldLabel id="session-minutes-label">
                          Minutes each study day
                        </FieldLabel>
                        <div
                          className="grid grid-cols-2 gap-2"
                          role="group"
                          aria-labelledby="session-minutes-label"
                        >
                          {[15, 30, 45, 60].map((minutes) => (
                            <Button
                              key={minutes}
                              type="button"
                              variant={
                                draft.minutesPerSession === minutes
                                  ? "secondary"
                                  : "outline"
                              }
                              className="h-11"
                              aria-pressed={draft.minutesPerSession === minutes}
                              onClick={() =>
                                onUpdate({ minutesPerSession: minutes })
                              }
                            >
                              {minutes} min
                            </Button>
                          ))}
                        </div>
                      </Field>
                    </div>

                    <SchedulePreview draft={draft} today={today} />
                  </div>
                </FieldSet>
              ) : null}
            </div>

            <div className="mt-6 flex max-w-2xl flex-col gap-3 sm:flex-row">
              {onCancel ? (
                <Button
                  type="button"
                  size="xl"
                  variant="ghost"
                  onClick={onCancel}
                  className="w-full sm:w-auto"
                >
                  Cancel editing
                </Button>
              ) : null}
              {step > 1 ? (
                <Button
                  type="button"
                  size="xl"
                  variant="outline"
                  onClick={onBack}
                  className="w-full sm:w-auto sm:min-w-28"
                >
                  <ArrowLeftIcon data-icon="inline-start" />
                  Back
                </Button>
              ) : null}
              <Button
                type="button"
                size="xl"
                onClick={onContinue}
                className="h-auto min-h-12 w-full min-w-0 px-3 py-3 whitespace-normal sm:h-12 sm:flex-1 sm:px-6 sm:py-0 sm:whitespace-nowrap"
              >
                {step === 3
                  ? draft.priorScoreChoice === "never"
                    ? "Start my full diagnostic"
                    : stepCopy.next
                  : stepCopy.next}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </div>

            {step === 1 && viewer.technicalDetails ? (
              <div className="mt-5 flex max-w-2xl justify-end border-t pt-4">
                <Button
                  type="button"
                  variant="link"
                  onClick={onJudgeDemo}
                  className="h-auto px-0 font-bold"
                >
                  <PlayCircleIcon data-icon="inline-start" />
                  Open the judge demo
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  )
}
