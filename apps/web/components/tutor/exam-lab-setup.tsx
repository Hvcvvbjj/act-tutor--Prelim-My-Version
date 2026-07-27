"use client"

import { useRef } from "react"
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
  extendedTime: boolean
  modeLocked?: boolean
  onModeChange: (mode: ExamLabMode) => void
  onSectionChange: (section: CoreSection) => void
  onStart: () => void
}

const MODES = [
  {
    id: "sprint",
    title: "Quick 12-question quiz",
    meta: "12 questions · 15 minutes",
    description:
      "One question from every tracked skill. Best for a quick check.",
    icon: GaugeIcon,
  },
  {
    id: "section",
    title: "One-section practice",
    meta: "36–50 questions · full section timing",
    description: "Practice one section, then compare time with correctness.",
    icon: BookOpenCheckIcon,
  },
  {
    id: "core",
    title: "Full-length practice test",
    meta: "131 questions · 125 minutes",
    description:
      "English, Math, and Reading in test order, followed by your full results.",
    icon: Layers3Icon,
  },
] as const

const SECTIONS = ["english", "math", "reading"] as const

export function ExamLabSetup({
  mode,
  section,
  busy,
  extendedTime,
  modeLocked = false,
  onModeChange,
  onSectionChange,
  onStart,
}: ExamLabSetupProps) {
  const modeRefs = useRef<Array<HTMLButtonElement | null>>([])
  const availableModes = modeLocked
    ? MODES.filter((option) => option.id === mode)
    : MODES

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:py-14"
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)] lg:gap-16">
        <section>
          <p className="ink-label text-primary">Timed practice</p>
          <h1 className="mt-3 max-w-4xl font-heading text-4xl leading-[1.02] font-black tracking-[-0.03em] sm:text-5xl">
            Practice the test before test day.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            {modeLocked
              ? "This round calls for the full-length English, Math, and Reading test. Finish it, review the report, then choose whether to use that evidence for your next lesson round."
              : "Choose a quick quiz, one section, or a full-length practice test. You’ll get raw accuracy, time per question, and a suggested next action. Timed Practice results stay separate from your study plan, so they do not change Today or My week."}
          </p>

          <div
            className="mt-10 border-t-2 border-foreground"
            role="radiogroup"
            aria-label="Simulation type"
          >
            {availableModes.map((option, index) => {
              const Icon = option.icon
              const selected = mode === option.id
              return (
                <button
                  key={option.id}
                  ref={(node) => {
                    modeRefs.current[index] = node
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  className={cn(
                    "grid w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-4 border-b-2 border-foreground px-2 py-6 text-left transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    selected && "bg-[var(--coach-surface)]"
                  )}
                  onClick={() => onModeChange(option.id)}
                  onKeyDown={(event) => {
                    if (
                      ![
                        "ArrowDown",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowLeft",
                      ].includes(event.key)
                    ) {
                      return
                    }
                    event.preventDefault()
                    const direction =
                      event.key === "ArrowDown" || event.key === "ArrowRight"
                        ? 1
                        : -1
                    const nextIndex =
                      (index + direction + availableModes.length) %
                      availableModes.length
                    onModeChange(availableModes[nextIndex].id)
                    window.requestAnimationFrame(() =>
                      modeRefs.current[nextIndex]?.focus()
                    )
                  }}
                >
                  <span
                    className={cn(
                      "flex size-11 items-center justify-center border-2 border-foreground bg-background",
                      selected && "bg-primary text-primary-foreground"
                    )}
                  >
                    <Icon aria-hidden="true" />
                  </span>
                  <span>
                    <span className="font-heading text-3xl font-bold">
                      {option.title}
                    </span>
                    <span className="mt-1 block font-mono text-xs font-bold text-primary uppercase">
                      {option.meta}
                    </span>
                    <span className="mt-2 block max-w-xl text-sm leading-6 text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "mt-2 size-5 border-2 border-foreground",
                      selected && "border-[6px] border-primary bg-background"
                    )}
                    aria-hidden="true"
                  />
                </button>
              )
            })}
          </div>

          {mode === "section" ? (
            <fieldset className="mt-8">
              <legend className="ink-label text-muted-foreground">
                Choose a section
              </legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {SECTIONS.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={section === value ? "default" : "outline"}
                    aria-pressed={section === value}
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

          <Button
            type="button"
            size="xl"
            className="mt-9"
            onClick={onStart}
            disabled={busy}
          >
            <TimerResetIcon data-icon="inline-start" />
            {busy ? "Getting questions ready…" : "Start timed practice"}
          </Button>
          {extendedTime ? (
            <p className="mt-4 border-l-4 border-primary bg-[var(--info-surface)] p-3 text-sm font-semibold">
              Extended time is on. Timed Practice will use 1.5× the standard
              practice time.
            </p>
          ) : null}
        </section>

        <aside className="lg:pt-8">
          <ScoutCoach
            mood="ready"
            message="Treat this as practice, not a final judgment. Compare how long you spent with which answers were correct."
            detail={
              modeLocked
                ? "Answer keys stay hidden until you submit. After the report, you can explicitly use the completed full-length result to build the next lesson round."
                : "Answer keys stay hidden until you submit. The report uses correctness and elapsed time. It stays inside Timed Practice and does not update Today or My Week."
            }
          />
          <section className="mt-8 border-y-2 border-foreground py-6">
            <h2 className="font-heading text-3xl font-bold">
              Before you start
            </h2>
            <ol className="mt-5 space-y-4">
              {[
                [
                  Clock3Icon,
                  "The section clock keeps running while you navigate.",
                ],
                [
                  GaugeIcon,
                  "Answer each question, then flag anything you want to revisit.",
                ],
                [
                  ShieldCheckIcon,
                  "Review flags before submission; correctness stays hidden.",
                ],
              ].map(([Icon, text], index) => (
                <li
                  key={text as string}
                  className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 text-sm leading-6"
                >
                  <Icon className="mt-0.5 text-primary" aria-hidden="true" />
                  <span>
                    <strong className="font-mono text-xs">0{index + 1}</strong>
                    <br />
                    {text as string}
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            This uses original practice content. The report includes a rough
            1–36 practice estimate from your accuracy; it is not an official or
            ACT-equated score.
          </p>
        </aside>
      </div>
    </main>
  )
}
