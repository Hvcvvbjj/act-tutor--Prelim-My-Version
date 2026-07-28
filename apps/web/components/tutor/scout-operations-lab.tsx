"use client"

import { useMemo, useState } from "react"
import { BrainCircuitIcon, GaugeIcon, ShieldCheckIcon } from "lucide-react"

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
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-7 lg:py-10"
    >
      <header className="border-b-2 border-foreground pb-7">
        <p className="ink-label text-primary">Learning data</p>
        <h1 className="mt-3 max-w-4xl font-heading text-4xl leading-[1.02] font-black tracking-[-0.03em] sm:text-5xl">
          See what Scout knows about your learning.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          Review skill estimates, saved corrections, and ACT strategy.
        </p>
      </header>

      <nav
        className="flex gap-2 border-b-2 border-foreground py-4"
        aria-label="Learning data sections"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant={view === id ? "default" : "outline"}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            <Icon /> {label}
          </Button>
        ))}
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
