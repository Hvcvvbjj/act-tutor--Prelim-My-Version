"use client"

import type { DiagnosticSkillResult, KnowledgeState } from "@act-tutor/core"
import {
  ArrowUpRightIcon,
  MessageCircleMoreIcon,
  TargetIcon,
} from "lucide-react"

import {
  buildNeedsWorkItems,
  NEEDS_WORK_MR_KIM_EVENT,
  type NeedsWorkItem,
  type NeedsWorkMrKimRequest,
} from "@/components/tutor/needs-work"
import { ScoutCoach } from "@/components/tutor/scout"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const SECTION_LABEL = {
  english: "English",
  math: "Math",
  reading: "Reading",
} as const

function percent(value: number) {
  return `${Math.round(value * 100)}%`
}

function askMrKim(
  request: NeedsWorkMrKimRequest,
  onAskMrKim?: (request: NeedsWorkMrKimRequest) => void
) {
  if (onAskMrKim) {
    onAskMrKim(request)
    return
  }
  window.dispatchEvent(
    new CustomEvent<NeedsWorkMrKimRequest>(NEEDS_WORK_MR_KIM_EVENT, {
      detail: request,
    })
  )
}

function VideoLink({
  item,
  prominent = false,
}: {
  item: NeedsWorkItem
  prominent?: boolean
}) {
  return (
    <a
      className={buttonVariants({
        variant: "outline",
        size: prominent ? "lg" : "sm",
      })}
      href={item.video.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Find free ${item.label} explanations from ${item.video.channel} on YouTube (opens in a new tab)`}
    >
      Find free videos
      <ArrowUpRightIcon aria-hidden="true" />
    </a>
  )
}

function ReadinessBar({ item }: { item: NeedsWorkItem }) {
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-foreground/10"
      role="progressbar"
      aria-label={`${item.label} current readiness`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(item.readiness * 100)}
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: percent(item.readiness) }}
      />
    </div>
  )
}

function PrioritySkill({
  item,
  onAskMrKim,
  onStartSkill,
}: {
  item: NeedsWorkItem
  onAskMrKim?: (request: NeedsWorkMrKimRequest) => void
  onStartSkill?: (skill: string) => void
}) {
  return (
    <section
      className="mt-7 overflow-hidden rounded-2xl border-2 border-foreground bg-[var(--info-surface)]"
      aria-labelledby="needs-work-priority-title"
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="p-5 sm:p-7">
          <div className="flex items-center gap-2 text-primary">
            <TargetIcon className="size-5" aria-hidden="true" />
            <p className="ink-label">Start here</p>
          </div>
          <p className="mt-4 font-mono text-xs font-black text-muted-foreground uppercase">
            {SECTION_LABEL[item.section]} · priority {item.rank}
          </p>
          <h2
            id="needs-work-priority-title"
            className="mt-1 font-heading text-3xl leading-tight font-black tracking-[-0.035em] sm:text-4xl"
          >
            {item.label}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {item.evidenceLabel}. Mr. Kim can teach the pattern, work one
            example with you, and hand the skill back to Lessons for practice.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              type="button"
              size="lg"
              onClick={() => askMrKim(item.mrKimRequest, onAskMrKim)}
            >
              <MessageCircleMoreIcon aria-hidden="true" />
              Ask Mr. Kim
            </Button>
            {onStartSkill ? (
              <Button
                type="button"
                size="lg"
                variant="secondary"
                onClick={() => onStartSkill(item.skill)}
              >
                Practice in Lessons
              </Button>
            ) : null}
            <VideoLink item={item} prominent />
          </div>
        </div>
        <div className="border-t-2 border-foreground bg-background p-5 lg:border-t-0 lg:border-l-2 lg:p-6">
          <p className="ink-label text-muted-foreground">Current readiness</p>
          <p className="mt-2 font-heading text-5xl font-black tracking-[-0.05em] tabular-nums">
            {percent(item.readiness)}
          </p>
          <div className="mt-4">
            <ReadinessBar item={item} />
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Target for your goal: {percent(item.targetReadiness)}. This is a
            study estimate, not an ACT score.
          </p>
        </div>
      </div>
    </section>
  )
}

function SkillRow({
  item,
  onAskMrKim,
  onStartSkill,
}: {
  item: NeedsWorkItem
  onAskMrKim?: (request: NeedsWorkMrKimRequest) => void
  onStartSkill?: (skill: string) => void
}) {
  return (
    <li className="grid gap-4 px-4 py-5 sm:px-5 lg:grid-cols-[2.25rem_minmax(0,1fr)_7rem_auto] lg:items-center">
      <span className="font-mono text-sm font-black text-muted-foreground">
        {String(item.rank).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="font-heading text-lg font-black">{item.label}</h3>
          <span className="font-mono text-[0.65rem] font-black text-primary uppercase">
            {SECTION_LABEL[item.section]}
          </span>
        </div>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {item.evidenceLabel}
        </p>
      </div>
      <div className="min-w-0">
        <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[0.65rem] font-bold text-muted-foreground">
          <span>Readiness</span>
          <span>{percent(item.readiness)}</span>
        </div>
        <ReadinessBar item={item} />
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => askMrKim(item.mrKimRequest, onAskMrKim)}
        >
          Ask Mr. Kim
        </Button>
        {onStartSkill ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onStartSkill(item.skill)}
          >
            Practice
          </Button>
        ) : null}
        <VideoLink item={item} />
      </div>
    </li>
  )
}

export interface NeedsWorkSurfaceProps {
  diagnosticSkillResults?: ReadonlyArray<DiagnosticSkillResult>
  knowledgeStates?: ReadonlyArray<KnowledgeState>
  mistakes?: ReadonlyArray<{
    id: string
    skill: string
    skillLabel: string
    section: "english" | "math" | "reading"
    prompt: string
    selectedChoiceText: string
    correctChoiceText: string
    rationale: string
  }>
  goalScore: number
  className?: string
  onAskMrKim?: (request: NeedsWorkMrKimRequest) => void
  onStartSkill?: (skill: string) => void
}

export function NeedsWorkSurface({
  diagnosticSkillResults,
  knowledgeStates,
  mistakes = [],
  goalScore,
  className,
  onAskMrKim,
  onStartSkill,
}: NeedsWorkSurfaceProps) {
  const items = buildNeedsWorkItems({
    diagnosticSkillResults,
    knowledgeStates,
    goalScore,
  })
  const [priority, ...remaining] = items
  const visibleSkills = new Set(items.map((item) => item.skill))
  const visibleMistakes = mistakes
    .filter((mistake) => visibleSkills.has(mistake.skill))
    .slice(0, 8)

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn(
        "mx-auto w-full max-w-6xl px-4 py-7 sm:px-7 lg:py-9",
        className
      )}
      data-testid="needs-work-surface"
    >
      <header className="max-w-3xl">
        <p className="ink-label text-primary">Based on scored work</p>
        <h1 className="mt-2 font-heading text-4xl leading-none font-black tracking-[-0.04em] sm:text-5xl">
          Needs work
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          Your weakest question types, ranked from the full diagnostic and
          updated by later scored practice.
        </p>
      </header>

      {priority ? (
        <>
          <PrioritySkill
            item={priority}
            onAskMrKim={onAskMrKim}
            onStartSkill={onStartSkill}
          />
          {remaining.length ? (
            <section className="mt-8" aria-labelledby="needs-work-list-title">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-foreground pb-3">
                <h2
                  id="needs-work-list-title"
                  className="font-heading text-2xl font-black"
                >
                  Next priorities
                </h2>
                <p className="text-xs font-semibold text-muted-foreground">
                  Weakest first
                </p>
              </div>
              <ol className="divide-y rounded-b-2xl border border-t-0 bg-background">
                {remaining.map((item) => (
                  <SkillRow
                    key={item.skill}
                    item={item}
                    onAskMrKim={onAskMrKim}
                    onStartSkill={onStartSkill}
                  />
                ))}
              </ol>
            </section>
          ) : null}
          {visibleMistakes.length ? (
            <section
              className="mt-8"
              aria-labelledby="needs-work-mistakes-title"
            >
              <div className="border-b-2 border-foreground pb-3">
                <p className="ink-label text-primary">From your history</p>
                <h2
                  id="needs-work-mistakes-title"
                  className="mt-1 font-heading text-2xl font-black"
                >
                  Questions to revisit
                </h2>
              </div>
              <div className="divide-y-2 divide-foreground border-b-2 border-foreground">
                {visibleMistakes.map((mistake, index) => (
                  <details key={`${mistake.id}-${index}`} className="group">
                    <summary className="grid min-h-16 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0">
                        <span className="ink-label text-primary">
                          {mistake.skillLabel}
                        </span>
                        <span className="mt-1 block truncate text-sm font-semibold">
                          {mistake.prompt}
                        </span>
                      </span>
                      <span className="text-xs font-bold text-muted-foreground">
                        Review
                      </span>
                    </summary>
                    <div className="grid gap-5 pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.65fr)]">
                      <dl className="grid gap-4 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="font-bold text-muted-foreground">
                            Your answer
                          </dt>
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
                      <div className="border-l-4 border-primary pl-4">
                        <p className="text-sm leading-6">{mistake.rationale}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() =>
                            askMrKim(
                              {
                                source: "needs-work",
                                skill: mistake.skill,
                                skillLabel: mistake.skillLabel,
                                section: mistake.section,
                                question: `I missed this ${mistake.skillLabel} question: "${mistake.prompt}" I chose "${mistake.selectedChoiceText}", but the correct answer is "${mistake.correctChoiceText}." Explain why in plain English and give me one similar example.`,
                              },
                              onAskMrKim
                            )
                          }
                        >
                          Ask Mr. Kim about this
                        </Button>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="mt-8 border-y-2 border-foreground py-8">
          <ScoutCoach
            mood="correct"
            message="No scored skill is below your current goal threshold."
            detail="Keep following Lessons. New diagnostic and practice evidence will update this list."
          />
        </section>
      )}
    </main>
  )
}
