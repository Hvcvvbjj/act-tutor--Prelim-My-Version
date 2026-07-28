"use client"

import { useState } from "react"
import type { LearningSessionPayload } from "@act-tutor/core"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleHelpIcon,
  GaugeIcon,
} from "lucide-react"

import { MasteryProfile } from "@/components/tutor/mastery-profile"
import { ScoutCoach } from "@/components/tutor/scout"
import { Button } from "@/components/ui/button"

interface LearningTwinLabProps {
  learning: LearningSessionPayload | null
  onOpenLesson: () => void
  canViewTechnicalDetails: boolean
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`
}

function AnswerHistory({ learning }: { learning: LearningSessionPayload }) {
  const events = learning.learningTwin.events
  return (
    <details className="mt-9 border-y-2 border-foreground py-2">
      <summary
        id="answer-history-title"
        className="flex min-h-12 cursor-pointer items-center justify-between gap-4 font-heading text-xl font-black outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Recent answers
        <span className="font-mono text-xs text-muted-foreground">
          {Math.min(events.length, 8)} shown
        </span>
      </summary>
      {events.length ? (
        <ol className="divide-y border-t">
          {events.slice(0, 8).map((event) => (
            <li
              key={event.id}
              className="grid gap-3 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
            >
              <span
                className={
                  event.correct
                    ? "text-primary"
                    : "text-[var(--scout-coral-text)]"
                }
              >
                {event.correct ? (
                  <CheckCircle2Icon className="size-5" aria-hidden="true" />
                ) : (
                  <CircleHelpIcon className="size-5" aria-hidden="true" />
                )}
              </span>
              <div>
                <p className="text-sm font-bold">
                  {event.skillLabel} · {event.correct ? "correct" : "missed"} ·{" "}
                  {event.difficulty}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Estimate {percent(event.learnedBefore)} →{" "}
                  {percent(event.learnedAfter)} ·{" "}
                  {event.source === "calibration" ? "Quick Check" : "Practice"}
                </p>
              </div>
              <time className="font-mono text-xs font-bold text-muted-foreground">
                {new Date(event.observedAt).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <div className="border-t py-5">
          <ScoutCoach
            mood="thinking"
            message="No practice or Quick Check answer has changed a skill yet."
          />
        </div>
      )}
    </details>
  )
}

function TechnicalMethod() {
  return (
    <details className="mt-12 border-y-2 border-foreground py-6">
      <summary className="cursor-pointer font-heading text-2xl font-black outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        Technical method and fixed assumptions
      </summary>
      <div className="mt-6 grid gap-7 lg:grid-cols-2">
        <section>
          <h3 className="font-heading text-xl font-black">
            1. Starting learned probability
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            <li>
              Skill-specific check answers, from Quick Check or the full
              diagnostic: (correct + 1) ÷ (total + 2), limited to 8–92%.
            </li>
            <li>
              Section planning baseline, which may be a reported section score
              or an internal Quick Check proxy: 12% + ((value − 1) ÷ 35 × 76%),
              limited to 12–88%.
            </li>
            <li>No score or answers: a neutral 50% starting estimate.</li>
          </ul>
          <p className="mt-3 text-sm leading-6 font-semibold">
            Those score-to-probability values are product assumptions. They are
            not an ACT-published conversion.
          </p>
        </section>

        <section>
          <h3 className="font-heading text-xl font-black">
            2. Update after a scored answer
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Scout applies Bayesian Knowledge Tracing to the tested skill. For a
            medium item, the fixed assumptions are 20% guess, 12% slip, and an
            8% learning transition. “Sure,” “Unsure,” and “Guessing” scale the
            update to 100%, 78%, or 48%. Changing an answer before submission
            applies another 82% multiplier.
          </p>
          <p className="mt-3 text-sm leading-6 font-semibold">
            These values are fixed in code; they are not calibrated personal
            probabilities.
          </p>
        </section>

        <section>
          <h3 className="font-heading text-xl font-black">
            3. Predicted chance on a medium item
          </h3>
          <p className="mt-3 rounded-lg bg-muted p-4 font-mono text-sm leading-6">
            P(correct) = P(learned) × 0.88 + (1 − P(learned)) × 0.20
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This is used by the practice-priority rule. It is not percent
            correct and does not change an ACT score.
          </p>
        </section>

        <section>
          <h3 className="font-heading text-xl font-black">
            4. Which skill gets highest priority
          </h3>
          <p className="mt-3 rounded-lg bg-muted p-4 font-mono text-sm leading-6">
            (1 − predicted correct) × 52 + entropy × 24 + 1 ÷ (answers + 1) × 14
            + recent miss × 10
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Entropy is highest near a 50/50 estimate; it is not a confidence
            interval. The ACT goal is not an input to this skill ranking. Equal
            totals keep the previously prioritized skill first, then prefer
            fewer scored answers, then sort by skill name. A saved manual model
            correction can also change the stored BKT estimate before this rule
            runs.
          </p>
        </section>
      </div>
    </details>
  )
}

export function LearningTwinLab({
  learning,
  onOpenLesson,
  canViewTechnicalDetails,
}: LearningTwinLabProps) {
  const recommendation = learning?.learningTwin?.recommendation
  const skills = learning?.learningTwin?.skills
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)

  if (!learning || !recommendation || !skills?.length) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8"
      >
        <ScoutCoach
          mood="thinking"
          message="Scout is loading your 12-skill profile."
          detail="The profile uses your reported scores, diagnostic answers, and later scored practice."
        />
      </main>
    )
  }

  const current =
    skills.find((skill) => skill.skill === learning.todaySkill) ?? skills[0]
  const effectiveSelected =
    selectedSkill && skills.some((skill) => skill.skill === selectedSkill)
      ? selectedSkill
      : recommendation.skill

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-7 lg:py-9"
    >
      <section className="flex flex-col gap-5 border-b-2 border-foreground pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl min-w-0">
          <div className="flex items-center gap-3 text-primary">
            <GaugeIcon className="size-6" aria-hidden="true" />
            <p className="ink-label">Your progress</p>
          </div>
          <h1 className="mt-3 font-heading text-4xl leading-none font-black tracking-[-0.03em] sm:text-5xl">
            Your 12 skills
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Choose a skill to see its estimate and the answers behind it. Study
            estimates are not ACT scores. Scout&apos;s adaptive priority may
            differ from the lesson currently in sequence.
          </p>
        </div>
        {learning.status !== "complete" ? (
          <Button type="button" variant="outline" onClick={onOpenLesson}>
            Continue lesson: {current.label}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        ) : null}
      </section>

      <MasteryProfile
        skills={skills}
        recommendation={recommendation}
        selectedSkill={effectiveSelected}
        onSelect={setSelectedSkill}
        canViewTechnicalDetails={canViewTechnicalDetails}
        points={learning.mission.progress.xp}
      />

      <AnswerHistory learning={learning} />
      {canViewTechnicalDetails ? <TechnicalMethod /> : null}
    </main>
  )
}
