"use client"

import { useMemo, useState } from "react"
import {
  BrainCircuitIcon,
  GaugeIcon,
  ShieldCheckIcon,
} from "lucide-react"

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
      { id: "learner" as const, label: "Learner model", icon: BrainCircuitIcon },
      { id: "act" as const, label: "ACT strategy", icon: GaugeIcon },
      { id: "trust" as const, label: "Trust & data", icon: ShieldCheckIcon },
    ],
    []
  )

  return (
    <main className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-7 lg:py-10">
      <header className="grid gap-7 border-b-2 border-foreground pb-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
        <div>
          <p className="ink-label text-primary">Evidence and data</p>
          <h1 className="mt-3 max-w-5xl font-heading text-6xl leading-[0.92] font-black tracking-[-0.04em] sm:text-8xl">
            Scout has to show its work.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            See what Scout knows, what is still uncertain, how ACT timing works,
            and what data is saved. Nothing here gives a guest teacher controls.
          </p>
        </div>
        <ScoutCoach
          mood="thinking"
          message="I’ll show what I know, what I’m guessing, and what would change my mind."
          detail="Nothing here silently changes today’s unfinished lesson."
        />
      </header>

      <nav
        className="sticky top-20 z-10 -mx-4 flex gap-2 overflow-x-auto border-b-2 border-foreground bg-background px-4 py-4 sm:-mx-7 sm:px-7"
        aria-label="Evidence and data sections"
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
            openScout("Explain these evidence and data tools and tell me where to start.")
          }
        >
          Ask Scout about this
        </Button>
      </nav>

      <div className="pt-9">
        {view === "learner" ? <LearnerModelView {...props} /> : null}
        {view === "act" ? <ActStrategyView {...props} /> : null}
        {view === "trust" ? <TrustView {...props} /> : null}
      </div>
    </main>
  )
}
