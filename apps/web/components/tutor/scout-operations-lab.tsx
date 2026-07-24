"use client"

import { useMemo, useState } from "react"
import { BrainCircuitIcon, GaugeIcon, ShieldCheckIcon } from "lucide-react"

import { ScoutCoach } from "@/components/tutor/scout"
import { useScoutContext } from "@/components/tutor/scout-assistant"
import { ActStrategyView } from "@/components/tutor/scout-operations/act-strategy-view"
import { LearnerModelView } from "@/components/tutor/scout-operations/learner-model-view"
import { TrustView } from "@/components/tutor/scout-operations/trust-view"
import type {
  ScoutOperationsLabProps,
  ScoutOperationsView,
} from "@/components/tutor/scout-operations/types"
import { Button } from "@/components/ui/button"

export function ScoutOperationsLab(props: ScoutOperationsLabProps) {
  const [view, setView] = useState<ScoutOperationsView>("learner")
  const { openScout } = useScoutContext()
  const tabs = useMemo(
    () => [
      {
        id: "learner" as const,
        label: "Skill progress",
        icon: BrainCircuitIcon,
      },
      { id: "act" as const, label: "ACT strategy", icon: GaugeIcon },
      ...(props.canViewTechnicalDetails
        ? [
            {
              id: "trust" as const,
              label: "Technical details",
              icon: ShieldCheckIcon,
            },
          ]
        : []),
    ],
    [props.canViewTechnicalDetails]
  )

  return (
    <main className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-7 lg:py-10">
      <header className="grid gap-7 border-b-2 border-foreground pb-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
        <div>
          <p className="ink-label text-primary">Learning data</p>
          <h1 className="mt-3 max-w-5xl font-heading text-4xl leading-[1.02] font-black tracking-[-0.03em] sm:text-5xl">
            See what Scout knows about your learning.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Review your skill estimates, pacing notes, saved corrections, and
            ACT strategy.
            {props.canViewTechnicalDetails
              ? " Judge view also shows the fixed rules and evidence receipts behind Scout’s choices."
              : " Everything here is written for learners, so you can focus on what to do next."}
          </p>
        </div>
        <ScoutCoach
          mood="thinking"
          message="Nothing on this page changes your data unless you save a correction or choose delete."
          detail="You can review the information, correct an estimate, or delete your data."
        />
      </header>

      <nav
        className="sticky top-20 z-10 -mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto border-b-2 border-foreground bg-background px-4 py-4 sm:-mx-7 sm:px-7 [&::-webkit-scrollbar]:hidden"
        aria-label="Learning data sections"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant={view === id ? "default" : "outline"}
            onClick={() => setView(id)}
          >
            <Icon /> {label}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          className="ml-auto"
          onClick={() =>
            openScout(
              "Explain my learning data in regular English and tell me where to start."
            )
          }
        >
          Ask Scout about my data
        </Button>
      </nav>

      <div className="pt-9">
        {view === "learner" ? <LearnerModelView {...props} /> : null}
        {view === "act" ? <ActStrategyView {...props} /> : null}
        {view === "trust" && props.canViewTechnicalDetails ? (
          <TrustView {...props} />
        ) : null}
      </div>
    </main>
  )
}
