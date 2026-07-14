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

export interface ExplanationPreferences {
  depth: "quick" | "normal" | "detailed"
  readingLevel: "plain" | "standard" | "advanced"
  exampleStyle: "school" | "sports" | "gaming" | "everyday"
  fewerTechnicalTerms: boolean
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

const EXPLANATION_DEFAULTS: ExplanationPreferences = {
  depth: "normal",
  readingLevel: "standard",
  exampleStyle: "everyday",
  fewerTechnicalTerms: true,
}

interface ScoutAnswer {
  summary: string
  explanation: string
  example: string | null
  technical: string
  nextAction: string
  source: string
  mode: string
  receipt?: {
    questionId: string | null
    skillId: string | null
    permissions: string[]
    checks: string[]
    delivery: string
  }
}

interface ScoutMessage {
  id: string
  question: string
  answer: ScoutAnswer
}

interface ScoutProviderValue {
  accommodations: AccommodationPreferences
  explanationPreferences: ExplanationPreferences
  setAccommodation: (
    key: keyof AccommodationPreferences,
    value: boolean
  ) => void
  setExplanationPreference: <K extends keyof ExplanationPreferences>(
    key: K,
    value: ExplanationPreferences[K]
  ) => void
  openScout: (question?: string) => void
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
  const [explanationPreferences, setExplanationPreferences] =
    useState<ExplanationPreferences>(EXPLANATION_DEFAULTS)
  const [scoutOpen, setScoutOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<ScoutMessage[]>([])
  const [selectedText, setSelectedText] = useState("")
  const [assistantError, setAssistantError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("scout-accommodations-v1")
        if (stored) setAccommodations({ ...DEFAULTS, ...JSON.parse(stored) })
        const explanation = window.localStorage.getItem(
          "scout-explanation-preferences-v1"
        )
        if (explanation)
          setExplanationPreferences({
            ...EXPLANATION_DEFAULTS,
            ...JSON.parse(explanation),
          })
      } catch {
        window.localStorage.removeItem("scout-accommodations-v1")
      }
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    function captureSelection() {
      const selection = window.getSelection()?.toString().trim() ?? ""
      setSelectedText(selection.length >= 3 ? selection.slice(0, 400) : "")
    }
    document.addEventListener("selectionchange", captureSelection)
    return () => document.removeEventListener("selectionchange", captureSelection)
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

  useEffect(() => {
    window.localStorage.setItem(
      "scout-explanation-preferences-v1",
      JSON.stringify(explanationPreferences)
    )
  }, [explanationPreferences])

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
    setAssistantError(null)
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
          simple:
            accommodations.simplified || explanationPreferences.depth === "quick",
          preferences: explanationPreferences,
          permissions:
            activeTab === "lab"
              ? ["TEST_MODE"]
              : ["CAN_HINT", "CAN_REPHRASE", "CAN_EXPLAIN_AFTER_ATTEMPT"],
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
            questionId:
              learning?.questions[learning.currentQuestionIndex]?.id ?? null,
            skillId: learning?.todaySkill ?? null,
            misconception: learning?.lastFeedback?.misconception ?? null,
            attempted:
              learning?.answeredQuestionIds.includes(
                learning?.questions[learning.currentQuestionIndex]?.id ?? ""
              ) ?? false,
          },
        }),
      })
      const payload = (await response.json()) as ScoutAnswer | { error: string }
      if (!response.ok || "error" in payload)
        throw new Error(
          "error" in payload ? payload.error : "Scout could not answer."
        )
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-${current.length}`,
          question: nextQuestion.trim(),
          answer: payload,
        },
      ])
      setQuestion("")
      if (accommodations.readAloud)
        speak(`${payload.summary} ${payload.explanation}`)
    } catch (error) {
      setAssistantError(
        error instanceof Error ? error.message : "Scout could not answer."
      )
    } finally {
      setBusy(false)
    }
  }

  const value = useMemo<ScoutProviderValue>(
    () => ({
      accommodations,
      explanationPreferences,
      setAccommodation: (key, enabled) =>
        setAccommodations((current) => ({ ...current, [key]: enabled })),
      setExplanationPreference: (key, nextValue) =>
        setExplanationPreferences((current) => ({
          ...current,
          [key]: nextValue,
        })),
      openScout: (nextQuestion) => {
        setScoutOpen(true)
        if (nextQuestion) setQuestion(nextQuestion)
      },
    }),
    [accommodations, explanationPreferences]
  )

  return (
    <ScoutContext.Provider value={value}>
      {children}
      <div className="fixed right-4 bottom-4 z-40 flex items-center gap-2 sm:right-6 sm:bottom-6 print:hidden">
        {selectedText ? (
          <Button
            type="button"
            variant="secondary"
            className="max-w-52 shadow-[3px_3px_0_var(--foreground)]"
            onClick={() => {
              setScoutOpen(true)
              void ask(`Explain this selected text in plain English: “${selectedText}”`)
              window.getSelection()?.removeAllRanges()
              setSelectedText("")
            }}
          >
            Explain selection
          </Button>
        ) : null}
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
              {messages.map((message) => (
                <div key={message.id} className="mt-6">
                  <p className="ml-8 border-r-4 border-foreground bg-muted px-4 py-3 text-sm font-semibold">
                    {message.question}
                  </p>
                  <article className="mt-3 border-l-4 border-primary bg-[var(--info-surface)] p-5">
                    <p className="font-heading text-2xl font-black">
                      {message.answer.summary}
                    </p>
                    <p className="mt-3 text-sm leading-6">
                      {message.answer.explanation}
                    </p>
                    {message.answer.example ? (
                      <div className="mt-4 border-t border-foreground/20 pt-4">
                        <p className="ink-label text-muted-foreground">Example</p>
                        <p className="mt-2 text-sm leading-6">
                          {message.answer.example}
                        </p>
                      </div>
                    ) : null}
                    <div className="mt-4 border-t border-foreground/20 pt-4">
                      <p className="ink-label text-primary">Do this next</p>
                      <p className="mt-2 text-sm font-semibold">
                        {message.answer.nextAction}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-foreground/20 pt-4">
                      {[
                        "Explain more simply",
                        "Give me another example",
                        "Let me try one",
                        "Show the rule",
                        "Why does this matter?",
                      ].map((action) => (
                        <Button
                          key={action}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void ask(action)}
                        >
                          {action}
                        </Button>
                      ))}
                    </div>
                    <details className="mt-4 text-xs text-muted-foreground">
                      <summary className="cursor-pointer font-bold text-foreground">
                        Source, permissions, and technical detail
                      </summary>
                      <p className="mt-2">Source: {message.answer.source}</p>
                      <p className="mt-1">{message.answer.technical}</p>
                      {message.answer.receipt ? (
                        <>
                          <p className="mt-1">
                            Permission: {message.answer.receipt.permissions.join(", ")}
                          </p>
                          <p className="mt-1">
                            Checks: {message.answer.receipt.checks.join(" · ")}
                          </p>
                        </>
                      ) : null}
                    </details>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        speak(
                          `${message.answer.summary} ${message.answer.explanation}`
                        )
                      }
                    >
                      <Volume2Icon /> Read aloud
                    </Button>
                  </article>
                </div>
              ))}
              {assistantError ? (
                <p className="mt-4 text-sm font-semibold text-destructive" role="alert">
                  {assistantError}
                </p>
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
                  Learning settings
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
            <section className="border-t-2 border-foreground pt-6">
              <p className="ink-label text-primary">How Scout explains</p>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm font-bold">
                  Answer length
                  <select
                    value={explanationPreferences.depth}
                    onChange={(event) =>
                      setExplanationPreferences((current) => ({
                        ...current,
                        depth: event.target.value as ExplanationPreferences["depth"],
                      }))
                    }
                    className="h-11 border-2 border-foreground bg-background px-3"
                  >
                    <option value="quick">Quick answers</option>
                    <option value="normal">Normal explanations</option>
                    <option value="detailed">Detailed walkthroughs</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Reading level
                  <select
                    value={explanationPreferences.readingLevel}
                    onChange={(event) =>
                      setExplanationPreferences((current) => ({
                        ...current,
                        readingLevel: event.target
                          .value as ExplanationPreferences["readingLevel"],
                      }))
                    }
                    className="h-11 border-2 border-foreground bg-background px-3"
                  >
                    <option value="plain">Plain and direct</option>
                    <option value="standard">Standard high school</option>
                    <option value="advanced">Advanced detail</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Example style
                  <select
                    value={explanationPreferences.exampleStyle}
                    onChange={(event) =>
                      setExplanationPreferences((current) => ({
                        ...current,
                        exampleStyle: event.target
                          .value as ExplanationPreferences["exampleStyle"],
                      }))
                    }
                    className="h-11 border-2 border-foreground bg-background px-3"
                  >
                    <option value="everyday">Everyday situations</option>
                    <option value="school">School</option>
                    <option value="sports">Sports</option>
                    <option value="gaming">Gaming</option>
                  </select>
                </label>
                <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-2">
                  <span>
                    <span className="block font-bold">Use fewer technical terms</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      Technical model details stay available in drawers.
                    </span>
                  </span>
                  <Switch
                    checked={explanationPreferences.fewerTechnicalTerms}
                    onCheckedChange={(enabled) =>
                      setExplanationPreferences((current) => ({
                        ...current,
                        fewerTechnicalTerms: enabled,
                      }))
                    }
                    aria-label="Use fewer technical terms"
                  />
                </label>
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </ScoutContext.Provider>
  )
}
