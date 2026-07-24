"use client"

import { useState } from "react"
import type { LearningSessionPayload } from "@act-tutor/core"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleHelpIcon,
  GaugeIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { MasteryProfile } from "@/components/tutor/mastery-profile"
import { ScoutCoach } from "@/components/tutor/scout"
import type { GeneratedPlan } from "@/components/tutor/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface LearningTwinLabProps {
  plan: GeneratedPlan
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
    <section className="mt-12" aria-labelledby="answer-history-title">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground pb-4">
        <div>
          <p className="ink-label text-primary">
            Answers that changed your estimates
          </p>
          <h2
            id="answer-history-title"
            className="mt-2 font-heading text-3xl font-black sm:text-4xl"
          >
            Recent scored answers
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          Each row changes only the skill named in that row. Response time is
          stored for pacing notes but does not change this estimate.
        </p>
      </div>

      {events.length ? (
        <ol className="divide-y border-b">
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
        <div className="mt-6 max-w-3xl">
          <ScoutCoach
            mood="thinking"
            message="No practice or Quick Check answer has changed a skill yet."
            detail="The chart currently shows starting estimates from check answers, the section planning baseline, or a neutral 50% starting point."
          />
        </div>
      )}
    </section>
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
            4. Which skill ranks next
          </h3>
          <p className="mt-3 rounded-lg bg-muted p-4 font-mono text-sm leading-6">
            (1 − predicted correct) × 52 + entropy × 24 + 1 ÷ (answers + 1) × 14
            + recent miss × 10
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Entropy is highest near a 50/50 estimate; it is not a confidence
            interval. The ACT goal is not an input to this skill ranking. Equal
            totals keep the previously recommended skill first, then prefer
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
  plan,
  learning,
  onOpenLesson,
  canViewTechnicalDetails,
}: LearningTwinLabProps) {
  const recommendation = learning?.learningTwin?.recommendation
  const skills = learning?.learningTwin?.skills
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)

  if (!learning || !recommendation || !skills?.length) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8">
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
    <main className="mx-auto w-full max-w-[92rem] px-4 py-8 sm:px-7 lg:py-10">
      <section className="grid grid-cols-1 gap-7 border-b-2 border-foreground pb-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-end">
        <div className="min-w-0">
          <div className="flex items-center gap-3 text-primary">
            <GaugeIcon className="size-6" aria-hidden="true" />
            <p className="ink-label">Your progress</p>
          </div>
          <h1 className="mt-4 max-w-5xl font-heading text-[2rem] leading-[1.02] font-black tracking-[-0.03em] sm:text-5xl">
            See how your 12 skills are developing.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            A skill estimate changes after a scored practice or Quick Check
            answer for that skill, or after you save a correction in Learning
            data. Choose any skill to see where it started, how many answers
            support it, and its latest change.
          </p>
        </div>

        <aside className="border-l-4 border-primary bg-[var(--info-surface)] p-5">
          <p className="ink-label text-primary">
            {learning.status === "complete"
              ? "Last completed assignment"
              : "Current assignment"}
          </p>
          <p className="mt-2 font-heading text-3xl font-black">
            {current.label}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {learning.status === "complete"
              ? `${current.label} is the last assignment you completed. Scout recommends ${recommendation.label} next; open Today when you are ready.`
              : "Continue the assignment already in progress. Scout will keep it in place until you finish it."}
          </p>
          {learning.status !== "complete" ? (
            <Button
              type="button"
              size="lg"
              className="mt-5"
              onClick={onOpenLesson}
            >
              Continue {current.label}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          ) : null}
        </aside>
      </section>

      <MasteryProfile
        skills={skills}
        recommendation={recommendation}
        selectedSkill={effectiveSelected}
        onSelect={setSelectedSkill}
        canViewTechnicalDetails={canViewTechnicalDetails}
      />

      <AnswerHistory learning={learning} />
      {canViewTechnicalDetails ? <TechnicalMethod /> : null}

      <Alert className="mt-10 bg-[var(--info-surface)]">
        <ShieldCheckIcon />
        <AlertTitle>What these numbers do—and do not—mean</AlertTitle>
        <AlertDescription>
          Scout uses these percentages to choose practice. They are not official
          ACT scores, percent correct, or promises that a target is reachable.
          {plan.evidence.source === "rapid_diagnostic"
            ? plan.diagnosticResult
              ? ` Your full diagnostic created a fixed planning baseline for a goal of ${plan.draft.goal}.`
              : ` Your Quick Check created a planning baseline for a goal of ${plan.draft.goal}.`
            : ` Your plan starts from Composite ${plan.currentComposite} and a goal of ${plan.draft.goal}.`}{" "}
          Your ACT goal shapes the schedule, not the order of skills here.
        </AlertDescription>
      </Alert>
    </main>
  )
}
