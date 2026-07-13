"use client"

import { useState, type ReactNode } from "react"
import {
  BookOpenIcon,
  CheckCircle2Icon,
  Clock3Icon,
  InfoIcon,
  ListChecksIcon,
  PencilLineIcon,
  RefreshCwIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { GeneratedPlan } from "@/components/tutor/types"
import { formatCalendarDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

interface DashboardProps {
  plan: GeneratedPlan
  onEditPlan: () => void
}

const FOCUS_CONTENT = {
  english: {
    lesson: "Sentence boundaries: complete vs. incomplete clauses",
    reason: "English conventions are your biggest score opportunity",
    concept:
      "A complete sentence needs an independent clause: a subject, a working verb, and a complete thought.",
    example:
      "Because the library closed early is incomplete. Add an independent clause: Because the library closed early, we studied at home.",
  },
  math: {
    lesson: "Linear equations: isolate the variable",
    reason: "Math is your biggest score opportunity",
    concept:
      "Keep an equation balanced by applying the same operation to both sides, then undo operations in reverse order.",
    example:
      "For 3x + 5 = 20, subtract 5, then divide by 3. The result is x = 5.",
  },
  reading: {
    lesson: "Evidence and inference: prove the answer",
    reason: "Reading is your biggest score opportunity",
    concept:
      "An ACT inference must be supported by the passage. Choose the smallest claim that the text can actually prove.",
    example:
      "If a passage says the researcher repeated the trial, you can infer she wanted stronger evidence—not that she expected a specific result.",
  },
} as const

const PHASE_LABELS = {
  foundation: "Foundation",
  balanced: "Balanced build",
  focused: "Focused practice",
  triage: "Test-ready triage",
} as const

const STUDY_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

const SESSION_FOCUSES = [
  "Learn + focused practice",
  "Review + skill probes",
  "Learn + focused practice",
  "Mixed timed transfer",
  "Cumulative review",
  "Focused practice",
  "Timed mixed set",
] as const

interface TaskRowProps {
  icon: ReactNode
  title: string
  minutes: number
  reason?: string
  active?: boolean
  complete?: boolean
  action?: ReactNode
  children?: ReactNode
}

function TaskRow({
  icon,
  title,
  minutes,
  reason,
  active,
  complete,
  action,
  children,
}: TaskRowProps) {
  return (
    <article
      className={cn(
        "rounded-xl border bg-background p-4 transition-colors sm:p-5",
        active && "border-primary",
        complete && "border-primary/30 bg-primary/[0.03]"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary",
              complete && "bg-primary text-primary-foreground"
            )}
          >
            {complete ? <CheckCircle2Icon /> : icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold sm:text-lg">{title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock3Icon aria-hidden="true" />
              {minutes} min
            </p>
            {reason ? (
              <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </article>
  )
}

function ScoreStrip({ plan }: { plan: GeneratedPlan }) {
  const sections =
    plan.evidence.reportedSections ?? plan.evidence.planningBaseline
  if (!sections) return null
  const estimated = plan.evidence.reportedSections === null

  return (
    <dl className="grid grid-cols-4 divide-x">
      {[
        ["Composite", plan.currentComposite],
        [estimated ? "English est." : "English", sections.english],
        [estimated ? "Math est." : "Math", sections.math],
        [estimated ? "Reading est." : "Reading", sections.reading],
      ].map(([label, value]) => (
        <div key={label} className="px-2 text-center first:pl-0 last:pr-0">
          <dt className="text-xs text-muted-foreground sm:text-sm">{label}</dt>
          <dd className="mt-1 text-2xl font-bold text-primary tabular-nums sm:text-3xl">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function Dashboard({ plan, onEditPlan }: DashboardProps) {
  const [lessonOpen, setLessonOpen] = useState(false)
  const [lessonComplete, setLessonComplete] = useState(false)
  const compositeOnly = plan.evidence.source === "composite_only"
  const diagnostic = plan.diagnosticResult
  const sectionFocus = FOCUS_CONTENT[plan.weakestSection]
  const focus = compositeOnly
    ? {
        ...FOCUS_CONTENT.english,
        lesson: "English skill probe: sentence boundaries",
        reason:
          "Your Composite is only a starting point; this probe helps locate the real gap",
      }
    : sectionFocus
  const weeklySessions = lessonComplete ? 1 : 0
  const sections = plan.evidence.reportedSections
  const retentionMode = plan.target.mode === "retention"
  const lessonMinutes = Math.min(8, plan.intensity.minutesPerSession)
  const remainingMinutes = plan.intensity.minutesPerSession - lessonMinutes
  const focusSetMinutes = Math.round(remainingMinutes * 0.55)
  const reviewMinutes = remainingMinutes - focusSetMinutes
  const weeklySchedule = STUDY_DAYS.slice(
    0,
    plan.intensity.studyDaysPerWeek
  ).map((day, index) => ({
    day,
    task: SESSION_FOCUSES[index],
  }))

  return (
    <Tabs defaultValue="today" className="min-h-svh gap-0 bg-background">
      <header className="grid min-h-20 grid-cols-[1fr_auto] items-center gap-y-2 border-b px-5 py-4 sm:grid-cols-[1fr_auto_1fr] sm:px-8 sm:py-0 lg:px-12">
        <p className="py-5 text-lg font-bold tracking-tight sm:py-0 sm:text-xl">
          AI ACT Tutor
        </p>
        <TabsList
          variant="line"
          aria-label="Study dashboard navigation"
          className="col-span-2 row-start-2 justify-self-center sm:col-span-1 sm:row-start-auto"
        >
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>
        <div className="flex justify-self-end sm:items-center sm:gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onEditPlan}>
            <PencilLineIcon data-icon="inline-start" />
            Edit plan
          </Button>
          <span className="hidden size-10 items-center justify-center rounded-full border text-sm font-semibold sm:flex">
            AS
          </span>
        </div>
      </header>

      <main className="grid min-h-[calc(100svh-5rem)] lg:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <section className="px-5 py-10 sm:px-10 lg:px-14 lg:py-12">
          <TabsContent value="today">
            <div className="max-w-4xl">
              <h1 className="text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
                {retentionMode
                  ? `Keep your ${plan.currentComposite} strong`
                  : `Your path to ${plan.draft.goal}`}
              </h1>
              <p className="mt-4 text-xl">
                <strong className="text-primary">
                  {plan.intensity.daysUntilTest}
                </strong>{" "}
                days left <span className="text-muted-foreground">·</span>{" "}
                {retentionMode ? (
                  <>Goal {plan.draft.goal} already met</>
                ) : (
                  <>
                    Current{" "}
                    <strong className="text-primary">
                      {plan.currentComposite}
                    </strong>
                  </>
                )}
              </p>

              <div className="mt-10 grid grid-cols-[32px_minmax(0,1fr)] gap-x-5">
                <div aria-hidden="true" className="flex flex-col items-center">
                  <span className="size-6 rounded-full border-4 border-primary bg-background ring-2 ring-primary" />
                  <span className="min-h-[26rem] w-1 flex-1 bg-primary" />
                  <span className="size-5 rounded-full border-2 border-primary bg-background" />
                  <span className="h-26 border-l-2 border-dashed border-primary" />
                  <span className="size-5 rounded-full border-2 border-primary bg-background" />
                </div>
                <div>
                  <p className="mb-3 text-xs font-bold tracking-[0.12em] text-primary uppercase">
                    Today
                  </p>
                  <div className="flex flex-col gap-4">
                    <TaskRow
                      active={!lessonComplete}
                      complete={lessonComplete}
                      icon={<BookOpenIcon />}
                      title={focus.lesson}
                      minutes={lessonMinutes}
                      reason={
                        retentionMode
                          ? `${plan.weakestSection[0].toUpperCase()}${plan.weakestSection.slice(1)} is the best place to protect points`
                          : focus.reason
                      }
                      action={
                        lessonComplete ? (
                          <span className="text-sm font-semibold text-primary">
                            Complete
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="lg"
                            onClick={() => setLessonOpen((open) => !open)}
                          >
                            {lessonOpen
                              ? "Close lesson"
                              : "Start today's lesson"}
                          </Button>
                        )
                      }
                    >
                      {lessonOpen && !lessonComplete ? (
                        <div className="mt-5 border-t pt-5">
                          <p className="font-semibold">The idea</p>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                            {focus.concept}
                          </p>
                          <p className="mt-4 font-semibold">Worked example</p>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                            {focus.example}
                          </p>
                          <Button
                            type="button"
                            variant="secondary"
                            size="lg"
                            className="mt-5"
                            onClick={() => {
                              setLessonComplete(true)
                              setLessonOpen(false)
                            }}
                          >
                            <CheckCircle2Icon data-icon="inline-start" />
                            Mark lesson complete
                          </Button>
                        </div>
                      ) : null}
                    </TaskRow>
                    <TaskRow
                      icon={<ListChecksIcon />}
                      title="5-question focus set"
                      minutes={focusSetMinutes}
                    />
                    <TaskRow
                      icon={<RefreshCwIcon />}
                      title="Mixed review"
                      minutes={reviewMinutes}
                    />
                  </div>

                  <div className="mt-14">
                    <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
                      Next session
                    </p>
                    <p className="mt-2 text-base">
                      Next lesson and practice set
                    </p>
                  </div>
                  <div className="mt-14">
                    <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
                      Next checkpoint
                    </p>
                    <p className="mt-2 text-base">
                      Quick quiz + plan update in{" "}
                      {plan.intensity.checkpointEveryDays} days
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="plan">
            <div className="max-w-4xl">
              <h1 className="text-4xl font-bold tracking-[-0.035em]">
                {retentionMode
                  ? "Your score-maintenance plan"
                  : `Your ${PHASE_LABELS[plan.intensity.phase].toLowerCase()} plan`}
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-7 text-muted-foreground">
                {plan.intensity.studyDaysPerWeek}{" "}
                {plan.intensity.minutesPerSession}-minute sessions each week,
                with a checkpoint every {plan.intensity.checkpointEveryDays}{" "}
                days. The balance shifts as test day gets closer.
              </p>
              <div className="mt-10 border-y">
                {weeklySchedule.map(({ day, task }) => (
                  <div
                    key={day}
                    className="grid gap-2 border-b py-5 last:border-0 sm:grid-cols-[8rem_1fr_auto] sm:items-center"
                  >
                    <p className="font-semibold">{day}</p>
                    <p className="text-muted-foreground">{task}</p>
                    <p className="text-sm text-muted-foreground">
                      {plan.intensity.minutesPerSession} min
                    </p>
                  </div>
                ))}
              </div>
              <h2 className="mt-10 text-xl font-bold">Section targets</h2>
              <dl className="mt-4 grid max-w-2xl grid-cols-3 divide-x border-y py-5 text-center">
                {[
                  ["English", plan.target.scores.english],
                  ["Math", plan.target.scores.math],
                  ["Reading", plan.target.scores.reading],
                ].map(([label, score]) => (
                  <div key={label}>
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-3xl font-bold text-primary">
                      {score}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </TabsContent>

          <TabsContent value="progress">
            <div className="max-w-4xl">
              <h1 className="text-4xl font-bold tracking-[-0.035em]">
                Progress starts with evidence
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-7 text-muted-foreground">
                {diagnostic
                  ? `Your starter diagnostic found direct evidence across ${diagnostic.skillResults.length} skills. The first sessions will deepen that evidence and narrow the estimated range.`
                  : compositeOnly
                    ? "Your Composite sets a rough starting point. The first sessions use skill probes to find whether the real gap is algebra, redundancy, inference, pacing, or something else."
                    : "Your section scores set the broad direction. The first sessions include skill probes so the plan can learn whether the real gap is algebra, redundancy, inference, pacing, or something else."}
              </p>
              <div className="mt-10 max-w-2xl">
                <ScoreStrip plan={plan} />
              </div>
              <Alert className="mt-10 max-w-2xl bg-[var(--info-surface)]">
                <InfoIcon />
                <AlertTitle>Provisional skill map</AlertTitle>
                <AlertDescription>
                  {diagnostic
                    ? `First focus: ${diagnostic.focusSkills[0]?.label ?? "mixed skill practice"}. Complete the next sessions to confirm or revise this signal.`
                    : "Complete the first three sessions to replace section-level assumptions with direct skill evidence."}
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </section>

        <aside className="border-t bg-[var(--rail)] px-5 py-9 sm:px-10 lg:border-t-0 lg:border-l lg:px-10 lg:py-16">
          <div className="lg:sticky lg:top-10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
                {diagnostic ? "Estimated baseline" : "Scores (provisional)"}
              </p>
              <InfoIcon className="text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="mt-8">
              <ScoreStrip plan={plan} />
            </div>
            {diagnostic ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Composite practice range: {diagnostic.compositeRange.low}–
                {diagnostic.compositeRange.high}
              </p>
            ) : null}
            <Separator className="my-10" />
            <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
              This week
            </p>
            <p className="mt-3 text-2xl">
              <strong>{weeklySessions}</strong> of{" "}
              {plan.intensity.studyDaysPerWeek} sessions
            </p>
            <div
              className="mt-5 flex gap-3"
              aria-label={`${weeklySessions} of ${plan.intensity.studyDaysPerWeek} sessions complete`}
            >
              {Array.from(
                { length: plan.intensity.studyDaysPerWeek },
                (_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "size-7 rounded-full border-2",
                      index < weeklySessions
                        ? "border-primary bg-primary"
                        : "border-border bg-background"
                    )}
                  />
                )
              )}
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Preview progress for this visit; saved weekly tracking is coming
              next.
            </p>
            <Separator className="my-10" />
            <Alert className="bg-[var(--info-surface)]">
              <InfoIcon />
              <AlertTitle>
                {diagnostic
                  ? "Starter diagnostic complete"
                  : "Skill map is still learning about you"}
              </AlertTitle>
              <AlertDescription>
                {diagnostic
                  ? "This plan uses direct answers, but the range remains wide until more evidence arrives."
                  : compositeOnly
                    ? "Your section estimates are provisional. Early skill probes will replace them with direct evidence."
                    : "Your section scores are provisional. Keep practicing—your plan will get more accurate with time."}
              </AlertDescription>
            </Alert>
            <p className="mt-8 text-sm leading-6 text-muted-foreground">
              Test date: {formatCalendarDate(plan.draft.testDate)}
            </p>
            {sections && plan.evidence.compositeDifference ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Your current-format Composite is calculated from English, Math,
                and Reading.
              </p>
            ) : null}
          </div>
        </aside>
      </main>
    </Tabs>
  )
}
