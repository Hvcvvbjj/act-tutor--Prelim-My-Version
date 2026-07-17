"use client"

import { calendarDaysUntil } from "@act-tutor/core"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  LockKeyholeIcon,
  MinusIcon,
  PlayCircleIcon,
  PlusIcon,
  TargetIcon,
  TrendingUpIcon,
} from "lucide-react"

import { ScoutCoach, ScoutMark } from "@/components/tutor/scout"
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
import { cn } from "@/lib/utils"

interface OnboardingProps {
  draft: PlacementDraft
  error: string | null
  step: number
  today: string
  onBack: () => void
  onContinue: () => void
  onDismissWelcome: () => void
  onJudgeDemo: () => void
  showWelcome: boolean
  onUpdate: (update: Partial<PlacementDraft>) => void
}

const STEP_LABELS = ["Goal", "Scores", "Schedule"] as const

const STEP_COPY = [
  {
    title: "Choose your ACT goal",
    description:
      "Choose the Composite you want to work toward. Scout raises English, Math, and Reading targets by whole points until their rounded average reaches your goal. Among the combinations with the smallest total squared increase, your focus preference breaks ties. This is a scheduling target, not a score prediction.",
    next: "Add my starting score",
  },
  {
    title: "Add your latest ACT scores",
    description:
      "Enter scores from one recent official or practice ACT. Section scores drive the plan. If you only know your Composite, Scout uses it as a temporary starting point for all three sections.",
    next: "Set my schedule",
  },
  {
    title: "Make a schedule you can keep",
    description:
      "Pick a test date, study days, and minutes. Scout fills only those study blocks. The date changes the mix of lessons, reviews, and timed practice; this schedule does not prove the goal is achievable.",
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
    <nav aria-label="Setup progress" className="mx-auto max-w-3xl">
      <ol className="grid grid-cols-3">
        {STEP_LABELS.map((label, index) => {
          const number = index + 1
          const active = number === step
          const complete = number < step
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className="relative flex items-center justify-center gap-2 px-1 text-sm sm:gap-3 sm:text-base"
            >
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-1/2 right-[calc(50%+3.25rem)] left-0 h-px -translate-y-1/2",
                    complete || active ? "bg-primary" : "bg-border"
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-8 items-center justify-center rounded-full border bg-background text-sm font-bold",
                  active && "border-primary bg-primary text-primary-foreground",
                  complete && "border-primary text-primary",
                  !active && !complete && "text-muted-foreground"
                )}
              >
                {number}
              </span>
              <span
                className={cn(
                  "relative z-10 hidden bg-background px-1 font-semibold sm:inline",
                  active ? "text-primary" : "text-foreground"
                )}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function PlanSummary({
  draft,
  today,
}: {
  draft: PlacementDraft
  today: string
}) {
  let daysToTest = 0
  try {
    daysToTest = Math.max(0, calendarDaysUntil(today, draft.testDate))
  } catch {
    daysToTest = 0
  }

  return (
    <aside className="hidden rounded-xl border bg-background p-5 lg:sticky lg:top-24 lg:block">
      <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
        Your setup so far
      </p>
      <dl className="mt-5 divide-y">
        <div className="flex items-center gap-4 py-4 first:pt-0">
          <TargetIcon className="size-6 text-primary" aria-hidden="true" />
          <div>
            <dt className="text-sm text-muted-foreground">Goal score</dt>
            <dd className="text-2xl font-bold tabular-nums">{draft.goal}</dd>
          </div>
        </div>
        <div className="flex items-center gap-4 py-4">
          <TrendingUpIcon
            className="size-6 text-[var(--scout-coral)]"
            aria-hidden="true"
          />
          <div>
            <dt className="text-sm text-muted-foreground">Starting point</dt>
            <dd className="text-lg font-bold">
              {draft.priorScoreChoice === "never"
                ? "Short check next"
                : draft.composite}
            </dd>
          </div>
        </div>
        <div className="flex items-center gap-4 py-4 last:pb-0">
          <CalendarDaysIcon
            className="size-6 text-primary"
            aria-hidden="true"
          />
          <div>
            <dt className="text-sm text-muted-foreground">Time until test</dt>
            <dd className="font-bold">
              {daysToTest ? `${daysToTest} days` : "Choose a date"}
            </dd>
            {draft.testDate ? (
              <dd className="mt-0.5 text-xs text-muted-foreground">
                {formatCalendarDate(draft.testDate)}
              </dd>
            ) : null}
          </div>
        </div>
      </dl>
    </aside>
  )
}

export function Onboarding({
  draft,
  error,
  step,
  today,
  onBack,
  onContinue,
  onDismissWelcome,
  onJudgeDemo,
  showWelcome,
  onUpdate,
}: OnboardingProps) {
  const stepCopy = STEP_COPY[step - 1] ?? STEP_COPY[0]

  if (showWelcome) {
    return (
      <div className="min-h-svh bg-background text-foreground">
        <header className="flex h-16 items-center gap-2.5 border-b px-5 sm:px-8">
          <ScoutMark className="size-9" />
          <p className="font-heading text-xl font-black tracking-tight">
            SCOUT <span className="text-primary">ACT</span>
          </p>
        </header>

        <main className="mx-auto flex w-full max-w-5xl items-center px-5 py-10 sm:min-h-[calc(100svh-4rem)] sm:px-8 sm:py-14">
          <section
            aria-labelledby="scout-welcome-title"
            className="w-full border-y-2 border-foreground py-8 sm:py-12"
          >
            <div className="grid items-start gap-7 lg:grid-cols-[8rem_minmax(0,1fr)] lg:gap-10">
              <ScoutMark className="size-24 sm:size-28" />
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-[0.12em] text-primary uppercase">
                  Meet your study coach
                </p>
                <h1
                  id="scout-welcome-title"
                  className="mt-3 max-w-3xl font-heading text-5xl leading-[0.94] font-black tracking-[-0.035em] sm:text-7xl"
                >
                  Hey, I&apos;m Mr. Kim.
                </h1>
                <p className="mt-5 max-w-3xl text-lg leading-8">
                  I&apos;ll be your ACT study coach from here on out. Tell me
                  your goal, your latest scores if you have them, and when you
                  can study. I&apos;ll turn those inputs into your first weekly
                  schedule.
                </p>
                <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
                  After each scored practice answer, I update the matching skill
                  estimate and may reorder future practice. Skill percentages
                  are practice estimates, not ACT scores.
                </p>

                <div className="mt-7 border-l-4 border-primary bg-[var(--info-surface)] px-5 py-4">
                  <p className="font-bold">No score yet? That&apos;s okay.</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    I&apos;ll start with an 8–12 question check across English,
                    Math, and Reading.
                  </p>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button type="button" size="xl" onClick={onDismissWelcome}>
                    Set up my plan
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    onClick={onJudgeDemo}
                    className="h-auto justify-start px-0 font-bold sm:px-4"
                  >
                    <PlayCircleIcon data-icon="inline-start" />
                    Preview Scout with sample answers
                  </Button>
                </div>
                <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                  <LockKeyholeIcon className="size-4" aria-hidden="true" />
                  No account needed.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex h-16 items-center gap-2.5 border-b px-5 sm:px-8">
        <ScoutMark className="size-9" />
        <p className="font-heading text-xl font-black tracking-tight">
          SCOUT <span className="text-primary">ACT</span>
        </p>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 sm:py-10">
        <StepTracker step={step} />

        <div className="mt-9 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-14">
          <section className="min-w-0">
            <p className="text-xs font-bold tracking-[0.12em] text-primary uppercase">
              Step {step} of 3 · {STEP_LABELS[step - 1]}
            </p>
            <h1 className="mt-3 font-heading text-4xl leading-tight font-black tracking-[-0.025em] sm:text-5xl">
              {stepCopy.title}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
              {stepCopy.description}
            </p>

            <div
              key={step}
              className="mt-8 animate-in duration-200 fade-in slide-in-from-right-2 motion-reduce:animate-none"
            >
              {step === 1 ? (
                <FieldSet>
                  <FieldLegend className="sr-only">Goal score</FieldLegend>
                  <FieldDescription id="goal-score-help">
                    Choose a Composite score from 1 to 36. This plan uses
                    English, Math, and Reading to calculate the Composite.
                  </FieldDescription>
                  <div className="mt-7 flex max-w-lg items-center gap-5 sm:gap-8">
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
                    <div className="min-w-28 text-center" aria-live="polite">
                      <p className="text-6xl font-black tracking-[-0.05em] text-primary tabular-nums">
                        {draft.goal}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Goal Composite
                      </p>
                    </div>
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
                    Starting ACT scores
                  </FieldLegend>
                  <FieldDescription id="starting-score-help">
                    Choose the option that matches what you know today.
                  </FieldDescription>
                  <RadioGroup
                    value={draft.priorScoreChoice}
                    aria-describedby="starting-score-help"
                    onValueChange={(value) =>
                      onUpdate({
                        priorScoreChoice:
                          value as PlacementDraft["priorScoreChoice"],
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

                  {draft.priorScoreChoice === "scores" ? (
                    <FieldDescription className="mt-4 max-w-2xl">
                      English, Math, and Reading drive the plan. Scout
                      recalculates your planning Composite as their rounded
                      average; the Composite you enter is kept for comparison.
                    </FieldDescription>
                  ) : draft.priorScoreChoice === "composite_only" ? (
                    <FieldDescription className="mt-4 max-w-2xl">
                      Scout temporarily uses this Composite as the starting
                      number for English, Math, and Reading until a scored check
                      provides section-level information.
                    </FieldDescription>
                  ) : null}

                  {draft.priorScoreChoice !== "never" ? (
                    <div className="mt-6 grid gap-4 rounded-xl border p-5 sm:grid-cols-2">
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
                            Optional. Stored for reference; this plan currently
                            uses English, Math, and Reading only.
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
                  ) : (
                    <ScoutCoach
                      className="mt-6 max-w-2xl"
                      mood="ready"
                      message="No scores yet? Start with an 8–12 question check."
                      detail="To open the check, Scout temporarily sets English, Math, and Reading to 18. That is not your result. When you finish and build the plan, your answers replace those placeholders."
                    />
                  )}
                </FieldSet>
              ) : null}

              {step === 3 ? (
                <FieldSet>
                  <FieldLegend className="sr-only">Study schedule</FieldLegend>
                  <FieldDescription>
                    Scout fills only the study blocks you choose. You can change
                    them later.
                  </FieldDescription>

                  <div className="mt-6 grid gap-6">
                    <Field data-invalid={Boolean(error)}>
                      <FieldLabel htmlFor="test-date">Next ACT date</FieldLabel>
                      <Input
                        id="test-date"
                        type="date"
                        min={today}
                        value={draft.testDate}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? "test-date-error" : undefined}
                        onChange={(event) =>
                          onUpdate({ testDate: event.target.value })
                        }
                        className="h-12 max-w-sm text-base"
                      />
                      <FieldError id="test-date-error">{error}</FieldError>
                    </Field>

                    <Field>
                      <FieldLabel id="study-days-label">
                        Study days each week
                      </FieldLabel>
                      <div
                        className="grid grid-cols-3 gap-2 sm:grid-cols-5"
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
                            className="h-12"
                            aria-pressed={draft.studyDaysPerWeek === days}
                            onClick={() => onUpdate({ studyDaysPerWeek: days })}
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
                        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
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
                            className="h-12"
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

                    <Field>
                      <FieldLabel id="main-focus-label">
                        What should Scout prioritize?
                      </FieldLabel>
                      <RadioGroup
                        value={draft.preferredSection}
                        aria-labelledby="main-focus-label"
                        onValueChange={(preferredSection) =>
                          onUpdate({
                            preferredSection:
                              preferredSection as PlacementDraft["preferredSection"],
                          })
                        }
                        className="grid gap-2 sm:grid-cols-4"
                      >
                        {[
                          ["balanced", "Whichever helps most"],
                          ["english", "English"],
                          ["math", "Math"],
                          ["reading", "Reading"],
                        ].map(([value, label]) => (
                          <FieldLabel
                            key={value}
                            className={cn(
                              "cursor-pointer rounded-lg border p-3",
                              draft.preferredSection === value &&
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
                    </Field>
                  </div>
                </FieldSet>
              ) : null}
            </div>

            <div className="mt-8 flex max-w-2xl gap-3">
              {step > 1 ? (
                <Button
                  type="button"
                  size="xl"
                  variant="outline"
                  onClick={onBack}
                  className="min-w-28"
                >
                  <ArrowLeftIcon data-icon="inline-start" />
                  Back
                </Button>
              ) : null}
              <Button
                type="button"
                size="xl"
                onClick={onContinue}
                className="flex-1"
              >
                {step === 3
                  ? draft.priorScoreChoice === "never"
                    ? "Take my starting check"
                    : stepCopy.next
                  : stepCopy.next}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </div>

            {step === 3 ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <LockKeyholeIcon className="size-4" aria-hidden="true" />
                You can change your schedule and learning settings later.
              </p>
            ) : null}

            {step === 1 ? (
              <div className="mt-5 flex max-w-2xl flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LockKeyholeIcon className="size-4" aria-hidden="true" />
                  No account needed.
                </p>
                <Button
                  type="button"
                  variant="link"
                  onClick={onJudgeDemo}
                  className="h-auto px-0 font-bold"
                >
                  <PlayCircleIcon data-icon="inline-start" />
                  Preview Scout with sample answers
                </Button>
              </div>
            ) : null}
          </section>

          <PlanSummary draft={draft} today={today} />
        </div>
      </main>
    </div>
  )
}
