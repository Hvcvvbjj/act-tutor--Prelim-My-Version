"use client"

import type { MistakeRecordPublic } from "@act-tutor/core"
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ClipboardCheckIcon,
  HistoryIcon,
  MessageCircleQuestionIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useScoutContext } from "@/components/tutor/scout-assistant"
import type {
  AssessmentHistoryEntry,
  AssessmentHistoryMistake,
} from "@/components/tutor/types"
import { cn } from "@/lib/utils"

const SECTION_LABEL = {
  english: "English",
  math: "Math",
  reading: "Reading",
} as const

interface DisplayMistake {
  id: string
  questionId: string
  skill: string
  section: "english" | "math" | "reading"
  skillLabel: string
  prompt: string
  selectedChoiceText: string
  correctChoiceText: string
  rationale: string
  resolved: boolean
}

function normalizedText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function compactText(value: string, limit: number) {
  const normalized = normalizedText(value)
  return normalized.length <= limit
    ? normalized
    : `${normalized.slice(0, limit - 1).trimEnd()}…`
}

function answerContrast(
  selectedChoiceText: string,
  correctChoiceText: string,
  limit: number
) {
  const selected = normalizedText(selectedChoiceText)
  const correct = normalizedText(correctChoiceText)
  if (
    selected === correct ||
    (selected.length <= limit && correct.length <= limit)
  ) {
    return {
      selected: compactText(selected, limit),
      correct: compactText(correct, limit),
    }
  }

  let firstDifference = 0
  while (
    firstDifference < selected.length &&
    firstDifference < correct.length &&
    selected[firstDifference] === correct[firstDifference]
  ) {
    firstDifference += 1
  }
  const start = Math.max(0, firstDifference - Math.floor(limit * 0.42))
  const excerpt = (value: string) => {
    const available = limit - (start > 0 ? 1 : 0)
    const slice = value.slice(start, start + available).trim()
    return `${start > 0 ? "…" : ""}${slice}${
      start + available < value.length ? "…" : ""
    }`
  }
  return { selected: excerpt(selected), correct: excerpt(correct) }
}

function displayAssessmentMistake(
  mistake: AssessmentHistoryMistake
): DisplayMistake {
  return { ...mistake, resolved: false }
}

function displayLessonMistake(mistake: MistakeRecordPublic): DisplayMistake {
  return {
    id: mistake.id,
    questionId: mistake.questionId,
    skill: mistake.skill,
    section: mistake.section,
    skillLabel: mistake.skillLabel,
    prompt: mistake.prompt,
    selectedChoiceText: mistake.selectedChoiceText,
    correctChoiceText: mistake.correctChoiceText,
    rationale: mistake.rationale,
    resolved: mistake.resolvedAt !== null,
  }
}

export function historyMrKimQuestion(mistake: DisplayMistake) {
  return [
    `I missed this ${compactText(mistake.skillLabel, 40)} question.`,
    "Explain the reasoning in plain English, show me the decision rule, and give me one similar example.",
  ]
    .join(" ")
    .slice(0, 500)
}

export function historyMrKimContext(mistake: DisplayMistake) {
  const answers = answerContrast(
    mistake.selectedChoiceText,
    mistake.correctChoiceText,
    280
  )
  const compact = (value: string, limit: number) =>
    normalizedText(value).slice(0, limit)
  return JSON.stringify({
    k: "saved-mistake",
    g: compact(mistake.skill, 48),
    s: compact(mistake.skillLabel, 64),
    p: compact(mistake.prompt, 220),
    a: answers.selected,
    c: answers.correct,
    r: compact(mistake.rationale, 420),
    x: mistake.section,
  })
}

function MistakeLedger({
  mistakes,
  onAskMrKim,
}: {
  mistakes: ReadonlyArray<DisplayMistake>
  onAskMrKim: (mistake: DisplayMistake) => void
}) {
  if (mistakes.length === 0) {
    return (
      <div className="flex items-center gap-3 border-t py-5 text-sm font-semibold text-primary">
        <CheckCircle2Icon className="size-5" aria-hidden="true" />
        No missed answers in this assessment.
      </div>
    )
  }

  return (
    <div className="border-t">
      {mistakes.map((mistake, index) => (
        <article
          key={mistake.id}
          className="grid gap-5 border-b py-6 lg:grid-cols-[2.5rem_minmax(0,1fr)_minmax(15rem,0.55fr)] lg:gap-7"
        >
          <span
            className={cn(
              "flex size-9 items-center justify-center border-2 border-foreground font-mono text-xs font-black",
              mistake.resolved ? "bg-secondary" : "bg-[var(--coach-surface)]"
            )}
            aria-label={`Mistake ${index + 1}`}
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="ink-label text-primary">
                {SECTION_LABEL[mistake.section]}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {mistake.skillLabel}
              </span>
              {mistake.resolved ? (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-black text-primary">
                  Corrected
                </span>
              ) : null}
            </div>
            <h3 className="mt-3 font-heading text-xl leading-7 font-bold">
              {mistake.prompt}
            </h3>
            <dl className="mt-4 grid gap-3 text-sm leading-6 sm:grid-cols-2">
              <div>
                <dt className="font-bold text-muted-foreground">Your answer</dt>
                <dd className="mt-1">{mistake.selectedChoiceText}</dd>
              </div>
              <div>
                <dt className="font-bold text-muted-foreground">
                  Correct answer
                </dt>
                <dd className="mt-1 font-semibold">
                  {mistake.correctChoiceText}
                </dd>
              </div>
            </dl>
          </div>
          <aside className="border-l-4 border-primary pl-5">
            <p className="ink-label text-muted-foreground">
              Reviewed reasoning
            </p>
            <p className="mt-2 text-sm leading-6">{mistake.rationale}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => onAskMrKim(mistake)}
            >
              <MessageCircleQuestionIcon data-icon="inline-start" />
              Ask Mr. Kim
            </Button>
          </aside>
        </article>
      ))}
    </div>
  )
}

function AssessmentRow({
  entry,
  defaultOpen,
  onAskMrKim,
}: {
  entry: AssessmentHistoryEntry
  defaultOpen: boolean
  onAskMrKim: (mistake: DisplayMistake) => void
}) {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(entry.completedAt))
  return (
    <details className="group border-b-2 border-foreground" open={defaultOpen}>
      <summary className="grid min-h-24 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-5 py-5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="ink-label text-primary">
              {entry.kind === "diagnostic" ? "Diagnostic" : "Full test"}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {date}
            </span>
          </div>
          <h2 className="mt-2 truncate font-heading text-2xl font-black">
            {entry.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {entry.correct}/{entry.total} correct · {entry.mistakes.length}{" "}
            {entry.mistakes.length === 1 ? "mistake" : "mistakes"} saved
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="ink-label text-muted-foreground">Composite</p>
            <p className="font-heading text-4xl font-black text-primary">
              {entry.compositeScore}
            </p>
          </div>
          <ChevronDownIcon
            className="size-5 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </div>
      </summary>
      <div className="pb-7">
        <dl className="mb-6 grid grid-cols-3 divide-x-2 divide-foreground border-y-2 border-foreground py-4 text-center">
          {(
            Object.entries(entry.sectionScores) as Array<
              [keyof typeof SECTION_LABEL, number]
            >
          ).map(([section, score]) => (
            <div key={section}>
              <dt className="ink-label text-muted-foreground">
                {SECTION_LABEL[section]}
              </dt>
              <dd className="mt-1 font-heading text-3xl font-black">{score}</dd>
            </div>
          ))}
        </dl>
        <MistakeLedger
          mistakes={entry.mistakes.map(displayAssessmentMistake)}
          onAskMrKim={onAskMrKim}
        />
      </div>
    </details>
  )
}

export function HistorySurface({
  assessments,
  lessonMistakes,
}: {
  assessments: ReadonlyArray<AssessmentHistoryEntry>
  lessonMistakes: ReadonlyArray<MistakeRecordPublic>
}) {
  const { openScout } = useScoutContext()
  const orderedAssessments = [...assessments].sort(
    (left, right) =>
      right.completedAt.localeCompare(left.completedAt) ||
      right.id.localeCompare(left.id)
  )
  const orderedLessonMistakes = [...lessonMistakes].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id)
  )
  const totalMisses =
    orderedLessonMistakes.length +
    orderedAssessments.reduce(
      (total, assessment) => total + assessment.mistakes.length,
      0
    )

  const askMrKim = (mistake: DisplayMistake) =>
    openScout(historyMrKimQuestion(mistake), null, historyMrKimContext(mistake))

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:py-14"
    >
      <header className="grid gap-8 border-b-2 border-foreground pb-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="ink-label flex items-center gap-2 text-primary">
            <HistoryIcon className="size-4" aria-hidden="true" />
            Answer history
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-5xl leading-[0.98] font-black tracking-[-0.04em] sm:text-6xl">
            Every miss, in one place.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            Reopen the exact question, compare your answer with the correct one,
            or ask Mr. Kim to teach it another way.
          </p>
        </div>
        <dl className="grid grid-cols-2 divide-x-2 divide-foreground border-y-2 border-foreground py-4 text-center lg:min-w-72">
          <div className="px-5">
            <dt className="ink-label text-muted-foreground">Assessments</dt>
            <dd className="mt-1 font-heading text-4xl font-black">
              {orderedAssessments.length}
            </dd>
          </div>
          <div className="px-5">
            <dt className="ink-label text-muted-foreground">Saved misses</dt>
            <dd className="mt-1 font-heading text-4xl font-black text-primary">
              {totalMisses}
            </dd>
          </div>
        </dl>
      </header>

      {orderedAssessments.length === 0 && orderedLessonMistakes.length === 0 ? (
        <section className="py-16 text-center">
          <ClipboardCheckIcon
            className="mx-auto size-10 text-primary"
            aria-hidden="true"
          />
          <h2 className="mt-5 font-heading text-3xl font-black">
            Your review ledger is clear.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            Missed diagnostic, full-test, and lesson-check questions will appear
            here after they are scored.
          </p>
        </section>
      ) : (
        <div className="mt-8 border-t-2 border-foreground">
          {orderedLessonMistakes.length ? (
            <details
              className="group border-b-2 border-foreground"
              open={orderedAssessments.length === 0}
            >
              <summary className="grid min-h-24 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-5 py-5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                <div>
                  <p className="ink-label text-primary">Lessons</p>
                  <h2 className="mt-2 font-heading text-2xl font-black">
                    Lesson checks and focused practice
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {orderedLessonMistakes.length} saved{" "}
                    {orderedLessonMistakes.length === 1
                      ? "mistake"
                      : "mistakes"}
                  </p>
                </div>
                <ChevronDownIcon
                  className="size-5 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </summary>
              <div className="pb-7">
                <MistakeLedger
                  mistakes={orderedLessonMistakes.map(displayLessonMistake)}
                  onAskMrKim={askMrKim}
                />
              </div>
            </details>
          ) : null}
          {orderedAssessments.map((entry, index) => (
            <AssessmentRow
              key={entry.id}
              entry={entry}
              defaultOpen={index === 0 && orderedLessonMistakes.length === 0}
              onAskMrKim={askMrKim}
            />
          ))}
        </div>
      )}
    </main>
  )
}
