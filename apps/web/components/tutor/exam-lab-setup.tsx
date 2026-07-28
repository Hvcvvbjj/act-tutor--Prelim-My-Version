"use client"

import { useRef } from "react"
import type { CoreSection, ExamLabMode } from "@act-tutor/core"
import {
  BookOpenCheckIcon,
  GaugeIcon,
  Layers3Icon,
  TimerResetIcon,
} from "lucide-react"

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
    title: "12-question timed sprint",
    meta: "12 questions · 15 minutes",
    description:
      "One question from every tracked skill. Best for short timed practice.",
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
      data-hide-global-footer
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 lg:py-14"
    >
      <section>
        <p className="ink-label text-primary">Timed Practice</p>
        <h1 className="mt-3 max-w-4xl font-heading text-4xl leading-[1.02] font-black tracking-[-0.03em] sm:text-5xl">
          Choose a practice run.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          {modeLocked
            ? "Your next lesson round needs a full-length practice result."
            : "Pick the amount of test practice you have time for. Answers stay hidden until you submit."}
        </p>

        <div
          className="mt-9 border-t-2 border-foreground"
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
                  "grid w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-4 border-b-2 border-foreground px-2 py-5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
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
                <span className="min-w-0">
                  <span className="font-heading text-2xl font-bold sm:text-3xl">
                    {option.title}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-primary">
                    {option.meta}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                    {option.description}
                  </span>
                </span>
                <span
                  className={cn(
                    "size-5 border-2 border-foreground",
                    selected && "border-[6px] border-primary bg-background"
                  )}
                  aria-hidden="true"
                />
              </button>
            )
          })}
        </div>

        {mode === "section" ? (
          <fieldset className="mt-7">
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

        <div className="mt-8 flex items-center gap-4">
          <Button type="button" size="xl" onClick={onStart} disabled={busy}>
            <TimerResetIcon data-icon="inline-start" />
            {busy ? "Getting questions ready…" : "Start timed practice"}
          </Button>
          {extendedTime ? (
            <p className="text-sm font-semibold text-primary">
              Extended time · 1.5×
            </p>
          ) : null}
        </div>
      </section>
    </main>
  )
}
