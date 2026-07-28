"use client"

import {
  examLabInterpretationReadiness,
  type ExamLabSessionPayload,
} from "@act-tutor/core"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  Clock3Icon,
  RotateCcwIcon,
  SparklesIcon,
  TargetIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ExamLabReportProps {
  session: ExamLabSessionPayload
  onNewRun: () => void
  onUseForNextRound?: () => void
  applyingToPlan?: boolean
  canViewTechnicalDetails: boolean
}

const SECTION_LABEL = {
  english: "English",
  math: "Math",
  reading: "Reading",
} as const
function MetricBar({
  value,
  color = "var(--primary)",
}: {
  value: number
  color?: string
}) {
  return (
    <span
      className="mt-2 block h-2 overflow-hidden bg-muted"
      aria-hidden="true"
    >
      <span
        className="block h-full"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: color,
        }}
      />
    </span>
  )
}

export function ExamLabReport({
  session,
  onNewRun,
  onUseForNextRound,
  applyingToPlan = false,
  canViewTechnicalDetails,
}: ExamLabReportProps) {
  const result = session.result
  if (!result) return null
  const questionMap = new Map(
    session.questions.map((question) => [question.id, question])
  )
  const readiness = examLabInterpretationReadiness(result)
  const completedAnswerSummary =
    readiness.answered > 0
      ? `${result.correct} of ${readiness.answered}`
      : "None yet"
  const estimateMargin = result.mode === "sprint" ? 4 : 3
  return (
    <main
      data-hide-global-footer
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:py-14"
    >
      <section className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:gap-14">
        <div>
          <p className="ink-label text-primary">
            {readiness.sufficient
              ? "Timed-practice results"
              : "Incomplete timed practice"}
          </p>
          <h1 className="mt-3 font-heading text-4xl leading-[1.02] font-black tracking-[-0.03em] sm:text-5xl">
            {readiness.sufficient
              ? `A ${result.practiceEstimate.low}–${result.practiceEstimate.high} practice range.`
              : "Your completed answers are saved for review."}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            {readiness.sufficient
              ? "Your answer accuracy supports this result. Your next focus is beside it."
              : `You answered ${readiness.answered} of ${result.total} questions. Scout needs more completed work before suggesting a score range or next lesson.`}
          </p>

          <div className="mt-9 grid border-y-2 border-foreground sm:grid-cols-2 sm:divide-x-2 sm:divide-foreground">
            <div
              data-testid="timed-practice-answer-accuracy"
              className="py-6 sm:pr-8"
            >
              <p className="ink-label text-muted-foreground">
                {readiness.sufficient
                  ? "Answers correct"
                  : "Completed answers correct"}
              </p>
              <p className="mt-2 font-heading text-5xl font-black text-primary tabular-nums sm:text-6xl">
                {readiness.sufficient
                  ? `${Math.round(result.accuracy * 100)}%`
                  : completedAnswerSummary}
              </p>
            </div>
            <div className="border-t-2 border-foreground py-6 sm:border-t-0 sm:pl-8">
              <p className="ink-label text-muted-foreground">
                Questions answered
              </p>
              <p className="mt-2 font-heading text-5xl font-black tabular-nums sm:text-6xl">
                {readiness.answered}/{result.total}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {result.unanswered} unanswered
              </p>
            </div>
          </div>
          {readiness.sufficient ? (
            canViewTechnicalDetails ? (
              <details className="mt-5 border-b-2 border-foreground pb-5 text-sm leading-6">
                <summary className="cursor-pointer font-semibold">
                  How the 1–36 display is calculated
                </summary>
                <p className="mt-3 text-muted-foreground">
                  Each section uses{" "}
                  <code className="font-mono text-xs text-foreground">
                    round(1 + ((correct + 1) / (total + 2)) × 35)
                  </code>
                  .{" "}
                  {result.practiceEstimate.composite
                    ? "Because this run includes English, Math, and Reading, the midpoint is the rounded average of the three section displays."
                    : "Because this run includes one section, the midpoint is that section display."}
                </p>
                <p className="mt-2 text-muted-foreground">
                  The shown range is the midpoint ±{estimateMargin}, clipped to
                  1–36. This is an internal conversion from raw correctness—not
                  an ACT-equated score or a statistical confidence interval.
                </p>
              </details>
            ) : (
              <p className="mt-5 border-b-2 border-foreground pb-5 text-sm leading-6 text-muted-foreground">
                This practice range is a rough summary of this run, not an
                official ACT-equated score or score prediction.
              </p>
            )
          ) : (
            <p className="mt-5 border-b-2 border-foreground pb-5 text-sm leading-6 text-muted-foreground">
              Completed answers remain available below. No score range or lesson
              recommendation was created from this incomplete run.
            </p>
          )}
        </div>
        <aside className="border-t-2 border-foreground pt-6 lg:mt-8">
          <p className="ink-label text-primary">
            {readiness.sufficient ? "Next focus" : "Next step"}
          </p>
          <h2 className="mt-3 font-heading text-3xl leading-tight font-black">
            {readiness.sufficient
              ? result.debrief.headline
              : "Finish more questions before using this result."}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {readiness.sufficient
              ? result.debrief.nextAction
              : `Complete at least ${readiness.minimumAnswered} answers before Scout suggests a focus.`}
          </p>
          {readiness.sufficient && onUseForNextRound ? (
            <Button
              type="button"
              size="lg"
              className="mt-6"
              onClick={onUseForNextRound}
              disabled={applyingToPlan}
            >
              {applyingToPlan
                ? "Building your next round…"
                : "Start my next lesson round"}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          ) : null}
          {readiness.sufficient && canViewTechnicalDetails ? (
            <details className="mt-7 border-y-2 border-foreground py-5 text-sm leading-6">
              <summary className="cursor-pointer font-semibold">
                How this summary was made
              </summary>
              <p className="mt-3 inline-flex items-center gap-2 font-semibold">
                {result.debrief.generation.mode === "ai" ? (
                  <SparklesIcon className="text-primary" />
                ) : (
                  <CheckCircle2Icon className="text-primary" />
                )}
                {result.debrief.generation.mode === "ai"
                  ? `AI-written report · ${result.debrief.generation.model}`
                  : "Reviewed report"}
              </p>
              <p className="mt-2 text-muted-foreground">
                {result.debrief.generation.mode === "ai"
                  ? "AI received only aggregate results—not the answer key or question text."
                  : "A reviewed fallback assembled this summary from aggregate results; no AI model was used."}
              </p>
            </details>
          ) : null}
        </aside>
      </section>

      <details className="group mt-10 border-y-2 border-foreground">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 font-bold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span className="font-heading text-2xl font-black">More results</span>
          <span className="text-sm font-semibold text-muted-foreground">
            Sections · pacing · skills
          </span>
        </summary>
        <div className="border-t-2 border-foreground pb-8">
          <section className="pt-7" aria-labelledby="section-results-title">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="ink-label text-primary">Raw results</p>
                <h2
                  id="section-results-title"
                  className="mt-2 font-heading text-4xl font-bold"
                >
                  Section breakdown
                </h2>
              </div>
              <TargetIcon className="text-primary" aria-hidden="true" />
            </div>
            <div className="mt-6 grid border-t lg:grid-cols-3 lg:divide-x">
              {result.sections.map((section) => {
                const completed = result.review.filter(
                  (answer) =>
                    answer.section === section.section &&
                    answer.selectedChoiceId !== null
                ).length
                const unanswered = section.total - completed
                const completedAccuracy = completed
                  ? section.correct / completed
                  : 0
                return (
                  <div
                    key={section.section}
                    data-testid={`timed-practice-section-${section.section}`}
                    className="border-b px-0 py-5 first:pl-0 last:pr-0 lg:px-6"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="font-heading text-3xl font-bold">
                        {SECTION_LABEL[section.section]}
                      </h3>
                      {readiness.sufficient ? (
                        <span className="font-heading text-4xl font-black text-primary">
                          {section.practiceEstimate}
                        </span>
                      ) : null}
                    </div>
                    <MetricBar
                      value={
                        (readiness.sufficient
                          ? section.accuracy
                          : completedAccuracy) * 100
                      }
                    />
                    <p className="mt-3 text-sm text-muted-foreground">
                      {readiness.sufficient
                        ? `${canViewTechnicalDetails ? "Internal display" : "Practice estimate"} · ${section.correct}/${section.total} total correct · ${unanswered} unanswered · ${Math.round(section.averageSeconds)}s average`
                        : completed
                          ? `${section.correct}/${completed} completed answer${completed === 1 ? "" : "s"} correct · ${unanswered} unanswered · ${Math.round(section.averageSeconds)}s average`
                          : `No completed answers · ${unanswered} unanswered`}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          <div
            className={cn("mt-12 max-w-3xl", !readiness.sufficient && "hidden")}
            aria-hidden={!readiness.sufficient}
          >
            <section
              className="border-t-2 border-foreground pt-7"
              aria-labelledby="pacing-title"
            >
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="ink-label text-[var(--scout-coral-text)]">
                    Time use
                  </p>
                  <h2
                    id="pacing-title"
                    className="mt-2 font-heading text-4xl font-bold"
                  >
                    How you handled the clock
                  </h2>
                </div>
                <Clock3Icon className="text-[var(--scout-coral)]" />
              </div>
              <p className="mt-5 font-heading text-3xl font-bold capitalize">
                {result.pacing.diagnosis.replace("-", " ")}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {Math.round(result.pacing.averageSeconds)}s actual average
                compared with a{" "}
                {Math.round(result.pacing.expectedAverageSeconds)}s average
                question-bank target.
              </p>
              <dl className="mt-6 grid grid-cols-3 divide-x-2 divide-foreground border-y-2 border-foreground py-5 text-center">
                <div>
                  <dt className="ink-label text-muted-foreground">Rushed</dt>
                  <dd className="mt-2 font-heading text-3xl font-black">
                    {result.pacing.rushed}
                  </dd>
                </div>
                <div>
                  <dt className="ink-label text-muted-foreground">On pace</dt>
                  <dd className="mt-2 font-heading text-3xl font-black text-primary">
                    {result.pacing.onPace}
                  </dd>
                </div>
                <div>
                  <dt className="ink-label text-muted-foreground">Overtime</dt>
                  <dd className="mt-2 font-heading text-3xl font-black text-[var(--scout-coral)]">
                    {result.pacing.overtime}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                “Rushed” means under 40% of a question&apos;s bank target time;
                “Overtime” means above 150%. With at least three answered
                questions, Scout labels the run “Rushing” when at least 35% are
                rushed; otherwise it labels it “Overinvesting” when at least 35%
                are overtime; otherwise it labels it “Balanced.”
              </p>
            </section>
          </div>

          <section
            className={cn(
              "mt-12 border-t-2 border-foreground pt-7",
              !readiness.sufficient && "hidden"
            )}
            aria-hidden={!readiness.sufficient}
            aria-labelledby="skills-title"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="ink-label text-primary">Skills in this run</p>
                <h2
                  id="skills-title"
                  className="mt-2 font-heading text-4xl font-bold"
                >
                  Lowest raw accuracy first
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                Skills are ordered by lowest raw accuracy; ties use slower
                average time.
              </p>
            </div>
            <div className="mt-6 grid gap-x-10 lg:grid-cols-2">
              {result.skills.map((skill) => (
                <div
                  key={skill.skill}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b py-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="font-semibold">{skill.label}</p>
                      <span className="font-mono text-[0.65rem] font-bold text-muted-foreground uppercase">
                        {skill.section}
                      </span>
                    </div>
                    <MetricBar
                      value={skill.accuracy * 100}
                      color="var(--primary)"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {Math.round(skill.averageSeconds)}s average
                    </p>
                  </div>
                  <span className="font-heading text-3xl font-black">
                    {Math.round(skill.accuracy * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </details>

      <details className="group mt-8 border-y-2 border-foreground">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 font-bold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span className="font-heading text-2xl font-black">
            Review answers
          </span>
          <span className="text-sm font-semibold text-muted-foreground">
            {readiness.answered} answered
          </span>
        </summary>
        <section
          className="border-t-2 border-foreground py-7"
          aria-labelledby="review-title"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="ink-label text-primary">Your answers</p>
              <h2
                id="review-title"
                className="mt-2 font-heading text-4xl font-bold"
              >
                {result.unanswered > 0
                  ? "Review your answered questions"
                  : "Review every question"}
              </h2>
            </div>
            <RotateCcwIcon className="text-primary" />
          </div>
          <div className="mt-6 border-t">
            {result.review.length === 0 ? (
              <p className="border-b py-6 text-sm leading-6 text-muted-foreground">
                No answer explanations are available because this run did not
                include a completed answer. Start a new run when you are ready
                to practice.
              </p>
            ) : null}
            {result.review.map((review) => {
              const question = questionMap.get(review.questionId)
              const questionNumber =
                session.questions.findIndex(
                  (candidate) => candidate.id === review.questionId
                ) + 1
              const selectedText =
                question?.choices.find(
                  (choice) => choice.id === review.selectedChoiceId
                )?.text ?? "No answer"
              const correctText =
                question?.choices.find(
                  (choice) => choice.id === review.correctChoiceId
                )?.text ?? "Reviewed answer"
              return (
                <details
                  key={review.questionId}
                  className="group border-b py-4"
                >
                  <summary className="grid cursor-pointer list-none grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center border-2 border-foreground font-mono text-xs font-bold",
                        review.correct
                          ? "bg-secondary"
                          : "bg-[var(--coach-surface)]"
                      )}
                    >
                      {questionNumber}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {review.skillLabel}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground capitalize">
                        {review.section} · {review.elapsedSeconds}s
                      </p>
                    </div>
                    {review.correct ? (
                      <CheckCircle2Icon className="text-primary" />
                    ) : (
                      <CircleAlertIcon className="text-[var(--scout-coral)]" />
                    )}
                  </summary>
                  <div className="mt-5 grid gap-6 border-l-4 border-foreground pl-5 text-sm leading-6 lg:grid-cols-2">
                    <div>
                      <p className="ink-label text-muted-foreground">
                        Question
                      </p>
                      <p className="mt-2 font-semibold">{question?.prompt}</p>
                      <p className="mt-3">
                        <strong>Your answer:</strong> {selectedText}
                      </p>
                      <p className="mt-1">
                        <strong>Correct answer:</strong> {correctText}
                      </p>
                    </div>
                    <div>
                      <p className="ink-label text-muted-foreground">
                        Reviewed reasoning
                      </p>
                      <p className="mt-2">{review.rationale}</p>
                    </div>
                  </div>
                </details>
              )
            })}
          </div>
        </section>
      </details>

      <div className="mt-8 flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" size="lg" onClick={onNewRun}>
          Take another practice test
        </Button>
      </div>
    </main>
  )
}
