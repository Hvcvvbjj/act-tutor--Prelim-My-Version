"use client"

import type { CoreSection, ExamLabMode } from "@act-tutor/core"
import {
  BookOpenCheckIcon,
  Clock3Icon,
  GaugeIcon,
  Layers3Icon,
  ShieldCheckIcon,
  TimerResetIcon,
} from "lucide-react"

import { ScoutCoach } from "@/components/tutor/scout"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ExamLabSetupProps {
  mode: ExamLabMode
  section: CoreSection
  busy: boolean
  onModeChange: (mode: ExamLabMode) => void
  onSectionChange: (section: CoreSection) => void
  onStart: () => void
}

const MODES = [
  {
    id: "sprint",
    title: "Pressure sprint",
    meta: "12 questions · 15 minutes",
    description: "One question from every tracked skill. Best for a fast readiness check.",
    icon: GaugeIcon,
  },
  {
    id: "section",
    title: "Section simulation",
    meta: "18–25 questions · authentic half-length clock",
    description: "Stay inside one section and diagnose pace, confidence, and skill drift.",
    icon: BookOpenCheckIcon,
  },
  {
    id: "core",
    title: "Core rehearsal",
    meta: "66 questions · 63 minutes",
    description: "English, Math, and Reading with section handoffs and a complete debrief.",
    icon: Layers3Icon,
  },
] as const

const SECTIONS = ["english", "math", "reading"] as const

export function ExamLabSetup({
  mode,
  section,
  busy,
  onModeChange,
  onSectionChange,
  onStart,
}: ExamLabSetupProps) {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)] lg:gap-16">
        <section>
          <p className="ink-label text-primary">Test Day Lab</p>
          <h1 className="mt-3 max-w-4xl font-heading text-6xl leading-[0.9] font-black tracking-[-0.04em] sm:text-8xl">
            Pressure reveals the next lesson.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Run original ACT-shaped questions under a real clock. Scout measures correctness, pace, confidence, flags, and omissions before changing your route.
          </p>

          <div className="mt-10 border-t-2 border-foreground" role="radiogroup" aria-label="Simulation type">
            {MODES.map((option) => {
              const Icon = option.icon
              const selected = mode === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={cn(
                    "grid w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-4 border-b-2 border-foreground px-2 py-6 text-left transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    selected && "bg-[var(--coach-surface)]"
                  )}
                  onClick={() => onModeChange(option.id)}
                >
                  <span className={cn("flex size-11 items-center justify-center border-2 border-foreground bg-background", selected && "bg-primary text-primary-foreground")}>
                    <Icon aria-hidden="true" />
                  </span>
                  <span>
                    <span className="font-heading text-3xl font-bold">{option.title}</span>
                    <span className="mt-1 block font-mono text-xs font-bold text-primary uppercase">{option.meta}</span>
                    <span className="mt-2 block max-w-xl text-sm leading-6 text-muted-foreground">{option.description}</span>
                  </span>
                  <span className={cn("mt-2 size-5 border-2 border-foreground", selected && "border-[6px] border-primary bg-background")} aria-hidden="true" />
                </button>
              )
            })}
          </div>

          {mode === "section" ? (
            <fieldset className="mt-8">
              <legend className="ink-label text-muted-foreground">Choose a section</legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {SECTIONS.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={section === value ? "default" : "outline"}
                    size="lg"
                    className="capitalize"
                    onClick={() => onSectionChange(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <Button type="button" size="xl" className="mt-9" onClick={onStart} disabled={busy}>
            <TimerResetIcon data-icon="inline-start" />
            {busy ? "Preparing secure form…" : "Enter the Test Day Lab"}
          </Button>
        </section>

        <aside className="lg:pt-8">
          <ScoutCoach
            mood="ready"
            message="Treat this like rehearsal, not judgment. The useful signal is where your decisions change under pressure."
            detail="Questions and answer keys stay server-owned. The AI debrief receives aggregate evidence only."
          />
          <section className="mt-8 border-y-2 border-foreground py-6">
            <h2 className="font-heading text-3xl font-bold">Lab protocol</h2>
            <ol className="mt-5 space-y-4">
              {[
                [Clock3Icon, "The section clock keeps running while you navigate."],
                [GaugeIcon, "Mark confidence honestly: Guess, Unsure, or Sure."],
                [ShieldCheckIcon, "Review flags before submission; correctness stays hidden."],
              ].map(([Icon, text], index) => (
                <li key={text as string} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 text-sm leading-6">
                  <Icon className="mt-0.5 text-primary" aria-hidden="true" />
                  <span><strong className="font-mono text-xs">0{index + 1}</strong><br />{text as string}</span>
                </li>
              ))}
            </ol>
          </section>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            This uses original practice content and produces an estimated practice range—not an official ACT score.
          </p>
        </aside>
      </div>
    </main>
  )
}
