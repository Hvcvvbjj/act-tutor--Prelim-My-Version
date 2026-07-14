"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { LearningSessionPayload } from "@act-tutor/core"
import {
  AccessibilityIcon,
  MessageCircleIcon,
  SendIcon,
  Volume2Icon,
  XIcon,
} from "lucide-react"

import { ScoutMark } from "@/components/tutor/scout"
import type { GeneratedPlan } from "@/components/tutor/types"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

export interface AccommodationPreferences {
  reducedMotion: boolean
  largeText: boolean
  highContrast: boolean
  keyboardOnly: boolean
  readAloud: boolean
  simplified: boolean
  extendedTime: boolean
  distractionReduced: boolean
}

const DEFAULTS: AccommodationPreferences = {
  reducedMotion: false,
  largeText: false,
  highContrast: false,
  keyboardOnly: false,
  readAloud: false,
  simplified: false,
  extendedTime: false,
  distractionReduced: false,
}

interface ScoutAnswer {
  summary: string
  explanation: string
  example: string | null
  technical: string
  nextAction: string
  source: string
  mode: string
}

interface ScoutProviderValue {
  accommodations: AccommodationPreferences
  setAccommodation: (
    key: keyof AccommodationPreferences,
    value: boolean
  ) => void
}

const ScoutContext = createContext<ScoutProviderValue | null>(null)

export function useScoutContext() {
  const value = useContext(ScoutContext)
  if (!value)
    throw new Error("useScoutContext must be used inside ScoutProvider")
  return value
}

const ACCOMMODATION_OPTIONS: ReadonlyArray<
  [keyof AccommodationPreferences, string, string]
> = [
  ["reducedMotion", "Reduced motion", "Stops nonessential movement."],
  ["largeText", "Larger text", "Makes the whole study view easier to read."],
  [
    "highContrast",
    "Increased contrast",
    "Strengthens borders and color contrast.",
  ],
  [
    "keyboardOnly",
    "Keyboard navigation",
    "Makes keyboard focus extra visible.",
  ],
  ["readAloud", "Read aloud", "Adds speech controls to Scout answers."],
  [
    "simplified",
    "Simpler explanations",
    "Starts with shorter, plainer wording.",
  ],
  ["extendedTime", "Extended-time Test Lab", "Uses a 1.5× time allowance."],
  [
    "distractionReduced",
    "Distraction-reduced layout",
    "Hides secondary study panels.",
  ],
]

function speak(value: string) {
  if (!("speechSynthesis" in window)) return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(value))
}

export function ScoutProvider({
  children,
  activeTab,
  plan,
  learning,
}: {
  children: ReactNode
  activeTab: string
  plan: GeneratedPlan
  learning: LearningSessionPayload | null
}) {
  const [accommodations, setAccommodations] =
    useState<AccommodationPreferences>(DEFAULTS)
  const [scoutOpen, setScoutOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<ScoutAnswer | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("scout-accommodations-v1")
        if (stored) setAccommodations({ ...DEFAULTS, ...JSON.parse(stored) })
      } catch {
        window.localStorage.removeItem("scout-accommodations-v1")
      }
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(
      "scout-accommodations-v1",
      JSON.stringify(accommodations)
    )
    const root = document.documentElement
    root.dataset.scoutMotion = accommodations.reducedMotion ? "reduced" : "full"
    root.dataset.scoutText = accommodations.largeText ? "large" : "default"
    root.dataset.scoutContrast = accommodations.highContrast
      ? "high"
      : "default"
    root.dataset.scoutKeyboard = accommodations.keyboardOnly
      ? "strong"
      : "default"
    root.dataset.scoutDistraction = accommodations.distractionReduced
      ? "reduced"
      : "default"
  }, [accommodations])

  const prompts = useMemo(() => {
    if (activeTab === "progress")
      return [
        "Why is this skill next?",
        "What would change the plan?",
        "What does confidence mean?",
      ]
    if (activeTab === "calibrate")
      return [
        "Why this question?",
        "When will the check stop?",
        "Explain the estimate simply",
      ]
    if (activeTab === "plan")
      return [
        "Why this schedule?",
        "What tradeoff did Scout make?",
        "What if I miss a day?",
      ]
    if (activeTab === "lab")
      return [
        "What can you help with here?",
        "How should I pace myself?",
        "What happens after review?",
      ]
    return [
      "Give me a hint",
      "Explain this more simply",
      "Why is this my mission?",
    ]
  }, [activeTab])

  async function ask(nextQuestion = question) {
    if (!nextQuestion.trim()) return
    setBusy(true)
    try {
      const selectedState = learning?.learningTwin.skills.find(
        (skill) => skill.skill === learning.todaySkill
      )
      const response = await fetch("/api/scout/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: nextQuestion,
          screen: activeTab,
          mode: activeTab === "lab" ? "test" : "study",
          simple: accommodations.simplified,
          context: {
            lessonTitle: learning?.lesson.title,
            objective: learning?.lesson.objective,
            rule: learning?.lesson.concept,
            nextSkill: learning?.learningTwin.recommendation.label,
            planReason: learning?.learningTwin.recommendation.reason,
            correctOutcome: learning?.planCounterfactual.correctOutcome,
            incorrectOutcome: learning?.planCounterfactual.incorrectOutcome,
            skillEstimate: selectedState
              ? `${Math.round(selectedState.learnedProbability * 100)}%`
              : undefined,
            goal: plan.draft.goal,
          },
        }),
      })
      const payload = (await response.json()) as ScoutAnswer | { error: string }
      if (!response.ok || "error" in payload)
        throw new Error(
          "error" in payload ? payload.error : "Scout could not answer."
        )
      setAnswer(payload)
      setQuestion("")
      if (accommodations.readAloud)
        speak(`${payload.summary} ${payload.explanation}`)
    } finally {
      setBusy(false)
    }
  }

  const value = useMemo<ScoutProviderValue>(
    () => ({
      accommodations,
      setAccommodation: (key, enabled) =>
        setAccommodations((current) => ({ ...current, [key]: enabled })),
    }),
    [accommodations]
  )

  return (
    <ScoutContext.Provider value={value}>
      {children}
      <div className="fixed right-4 bottom-4 z-40 flex items-center gap-2 sm:right-6 sm:bottom-6 print:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="bg-background shadow-[3px_3px_0_var(--foreground)]"
          onClick={() => setToolsOpen(true)}
          aria-label="Open accommodations"
        >
          <AccessibilityIcon />
        </Button>
        <Button
          type="button"
          size="lg"
          className="shadow-[4px_4px_0_var(--foreground)]"
          onClick={() => setScoutOpen(true)}
        >
          <MessageCircleIcon /> Ask Scout
        </Button>
      </div>

      {scoutOpen ? (
        <div
          className="fixed inset-0 z-50 bg-foreground/35"
          role="presentation"
          onMouseDown={() => setScoutOpen(false)}
        >
          <aside
            className="absolute right-0 bottom-0 flex max-h-[90svh] w-full flex-col border-2 border-foreground bg-background shadow-[-8px_-8px_0_rgb(20_35_58_/_0.18)] sm:top-0 sm:bottom-auto sm:h-full sm:max-h-none sm:max-w-md"
            role="dialog"
            aria-modal="true"
            aria-label="Ask Scout"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-center gap-3 border-b-2 border-foreground bg-foreground p-4 text-background">
              <ScoutMark className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="font-heading text-2xl font-black">Ask Scout</p>
                <p className="font-mono text-[0.6rem] font-black text-[var(--scout-mint)] uppercase">
                  Context: {activeTab}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setScoutOpen(false)}
                aria-label="Close Ask Scout"
              >
                <XIcon />
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <p className="text-sm leading-6 text-muted-foreground">
                Ask about this screen, your plan, or the skill you are learning.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {prompts.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void ask(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
              {answer ? (
                <article className="mt-6 border-l-4 border-primary bg-[var(--info-surface)] p-5">
                  <p className="font-heading text-2xl font-black">
                    {answer.summary}
                  </p>
                  <p className="mt-3 text-sm leading-6">{answer.explanation}</p>
                  {answer.example ? (
                    <div className="mt-4 border-t border-foreground/20 pt-4">
                      <p className="ink-label text-muted-foreground">Example</p>
                      <p className="mt-2 text-sm leading-6">{answer.example}</p>
                    </div>
                  ) : null}
                  <div className="mt-4 border-t border-foreground/20 pt-4">
                    <p className="ink-label text-primary">Do this next</p>
                    <p className="mt-2 text-sm font-semibold">
                      {answer.nextAction}
                    </p>
                  </div>
                  <details className="mt-4 text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-bold text-foreground">
                      Source and technical detail
                    </summary>
                    <p className="mt-2">Source: {answer.source}</p>
                    <p className="mt-1">{answer.technical}</p>
                  </details>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    onClick={() =>
                      speak(`${answer.summary} ${answer.explanation}`)
                    }
                  >
                    <Volume2Icon /> Read aloud
                  </Button>
                </article>
              ) : null}
            </div>
            <form
              className="border-t-2 border-foreground p-4"
              onSubmit={(event) => {
                event.preventDefault()
                void ask()
              }}
            >
              <label
                htmlFor="scout-question"
                className="ink-label text-muted-foreground"
              >
                Your question
              </label>
              <textarea
                id="scout-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={3}
                maxLength={500}
                className="mt-2 w-full border-2 border-foreground bg-background p-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Why is this lesson next?"
              />
              <Button
                type="submit"
                className="mt-3 w-full"
                disabled={busy || !question.trim()}
              >
                <SendIcon /> {busy ? "Checking the evidence…" : "Ask Scout"}
              </Button>
            </form>
          </aside>
        </div>
      ) : null}

      {toolsOpen ? (
        <div
          className="fixed inset-0 z-50 bg-foreground/35"
          role="presentation"
          onMouseDown={() => setToolsOpen(false)}
        >
          <aside
            className="absolute right-0 bottom-0 max-h-[90svh] w-full overflow-y-auto border-2 border-foreground bg-background p-5 sm:top-0 sm:bottom-auto sm:h-full sm:max-h-none sm:max-w-md"
            role="dialog"
            aria-modal="true"
            aria-label="Learning accommodations"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b-2 border-foreground pb-4">
              <div>
                <p className="ink-label text-primary">Learner controlled</p>
                <h2 className="mt-2 font-heading text-4xl font-black">
                  Accommodations
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setToolsOpen(false)}
                aria-label="Close accommodations"
              >
                <XIcon />
              </Button>
            </div>
            <div className="divide-y">
              {ACCOMMODATION_OPTIONS.map(([key, label, detail]) => (
                <label
                  key={key}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-4"
                >
                  <span>
                    <span className="block font-bold">{label}</span>
                    <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                      {detail}
                    </span>
                  </span>
                  <Switch
                    checked={accommodations[key]}
                    onCheckedChange={(enabled) =>
                      setAccommodations((current) => ({
                        ...current,
                        [key]: enabled,
                      }))
                    }
                    aria-label={label}
                  />
                </label>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </ScoutContext.Provider>
  )
}
