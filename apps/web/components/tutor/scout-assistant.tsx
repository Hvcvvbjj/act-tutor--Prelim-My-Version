"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type {
  LearningSessionPayload,
  ScoutAskResponse,
  ScoutExplanationPreferences,
  ScoutMessage,
  ScoutStateResponse,
} from "@act-tutor/core"
import {
  AccessibilityIcon,
  MessageCircleIcon,
  SendIcon,
  Volume2Icon,
  XIcon,
} from "lucide-react"

import { ScoutMark } from "@/components/tutor/scout"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  DEFAULT_ACCOMMODATIONS,
  DEFAULT_EXPLANATION_PREFERENCES,
  readScoutSettings,
  updateScoutAccommodations,
  updateScoutExplanation,
  type AccommodationPreferences,
} from "@/lib/scout-settings"

export type ExplanationPreferences = ScoutExplanationPreferences

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
  openSettings: () => void
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
  learning,
}: {
  children: ReactNode
  activeTab: string
  learning: LearningSessionPayload | null
}) {
  const [accommodations, setAccommodations] =
    useState<AccommodationPreferences>(() =>
      typeof window === "undefined"
        ? DEFAULT_ACCOMMODATIONS
        : readScoutSettings().accommodations
    )
  const [explanationPreferences, setExplanationPreferences] =
    useState<ExplanationPreferences>(() =>
      typeof window === "undefined"
        ? DEFAULT_EXPLANATION_PREFERENCES
        : readScoutSettings().explanation
    )
  const [scoutOpen, setScoutOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<ScoutMessage[]>([])
  const [selectedText, setSelectedText] = useState("")
  const [assistantError, setAssistantError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const scoutDialogRef = useRef<HTMLElement | null>(null)
  const toolsDialogRef = useRef<HTMLElement | null>(null)
  const lastFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/scout/ask", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as
          ScoutStateResponse | { error: string }
        if (!response.ok || "error" in payload) {
          throw new Error(
            "error" in payload ? payload.error : "Scout could not load."
          )
        }
        if (cancelled) return
        setMessages([...payload.messages])
        const currentLocal = readScoutSettings()
        const serverUsesDefaults =
          JSON.stringify(payload.preferences) ===
          JSON.stringify(DEFAULT_EXPLANATION_PREFERENCES)
        const localUsesDefaults =
          JSON.stringify(currentLocal.explanation) ===
          JSON.stringify(DEFAULT_EXPLANATION_PREFERENCES)
        const localWins =
          currentLocal.explanationCustomized &&
          ((serverUsesDefaults && !localUsesDefaults) ||
            currentLocal.explanationUpdatedAt > payload.preferencesUpdatedAt)
        if (localWins) {
          const patchResponse = await fetch("/api/scout/ask", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              preferences: currentLocal.explanation,
              preferencesUpdatedAt: currentLocal.explanationUpdatedAt,
            }),
          })
          const patched = (await patchResponse.json()) as
            ScoutStateResponse | { error: string }
          if (!patchResponse.ok || "error" in patched) {
            throw new Error(
              "error" in patched
                ? patched.error
                : "Scout preferences were not saved."
            )
          }
        } else {
          setExplanationPreferences(payload.preferences)
          updateScoutExplanation(
            payload.preferences,
            payload.preferencesUpdatedAt,
            !serverUsesDefaults
          )
        }
      })
      .catch((error) => {
        if (cancelled) return
        setAssistantError(
          error instanceof Error ? error.message : "Scout could not load."
        )
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function captureSelection() {
      const selection = window.getSelection()?.toString().trim() ?? ""
      setSelectedText(selection.length >= 3 ? selection.slice(0, 400) : "")
    }
    document.addEventListener("selectionchange", captureSelection)
    return () =>
      document.removeEventListener("selectionchange", captureSelection)
  }, [])

  useEffect(() => {
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

  function saveAccommodation(
    key: keyof AccommodationPreferences,
    enabled: boolean
  ) {
    setAccommodations((current) => {
      const next = { ...current, [key]: enabled }
      updateScoutAccommodations(next)
      return next
    })
  }

  function saveExplanationPreference<K extends keyof ExplanationPreferences>(
    key: K,
    nextValue: ExplanationPreferences[K]
  ) {
    setExplanationPreferences((current) => {
      const next = { ...current, [key]: nextValue }
      const settings = updateScoutExplanation(next)
      void fetch("/api/scout/ask", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: next,
          preferencesUpdatedAt: settings.explanationUpdatedAt,
        }),
      })
        .then(async (response) => {
          if (response.ok) return
          const payload = (await response.json()) as { error?: string }
          setAssistantError(
            payload.error ?? "Scout preferences were not saved to this session."
          )
        })
        .catch(() => {
          setAssistantError(
            "This preference is saved on your device and will sync when Scout reconnects."
          )
        })
      return next
    })
  }

  useEffect(() => {
    const panel = scoutOpen
      ? scoutDialogRef.current
      : toolsOpen
        ? toolsDialogRef.current
        : null
    if (!panel) return
    const activePanel = panel
    const selector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
    const focusable = () =>
      Array.from(activePanel.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => !element.hidden && element.getClientRects().length > 0
      )
    focusable()[0]?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        setScoutOpen(false)
        setToolsOpen(false)
        return
      }
      if (event.key !== "Tab") return
      const controls = focusable()
      if (controls.length === 0) return
      const first = controls[0]
      const last = controls.at(-1)
      if (!activePanel.contains(document.activeElement)) {
        event.preventDefault()
        const wrapTarget = event.shiftKey ? last : first
        wrapTarget?.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      window.setTimeout(() => lastFocusRef.current?.focus(), 0)
    }
  }, [scoutOpen, toolsOpen])

  const prompts = useMemo(() => {
    if (activeTab === "progress")
      return [
        "Why is this skill next?",
        "How do I improve this skill?",
        "What will make me ready to move on?",
      ]
    if (activeTab === "calibrate")
      return [
        "Why did you pick this question?",
        "How many questions are left?",
        "What happens when I finish?",
      ]
    if (activeTab === "plan")
      return [
        "Why is this on my schedule?",
        "How can I fit this into my week?",
        "What happens if I miss a day?",
      ]
    if (activeTab === "lab")
      return [
        "Which timed practice should I choose?",
        "How should I pace this?",
        "What will Scout do with my results?",
      ]
    return [
      "Give me a hint",
      "Explain this more simply",
      "Why is this my mission?",
    ]
  }, [activeTab])

  async function ask(nextQuestion = question, selection: string | null = null) {
    if (!nextQuestion.trim()) return
    setBusy(true)
    setAssistantError(null)
    try {
      const response = await fetch("/api/scout/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: nextQuestion,
          screen: activeTab,
          questionId:
            activeTab === "lab"
              ? null
              : (learning?.questions[learning.currentQuestionIndex]?.id ??
                null),
          selectedText: selection,
        }),
      })
      const payload = (await response.json()) as
        ScoutAskResponse | { error: string }
      if (!response.ok || "error" in payload)
        throw new Error(
          "error" in payload ? payload.error : "Scout could not answer."
        )
      setMessages([...payload.messages])
      setQuestion("")
      if (accommodations.readAloud)
        speak(`${payload.answer.summary} ${payload.answer.explanation}`)
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
      setAccommodation: saveAccommodation,
      setExplanationPreference: saveExplanationPreference,
      openScout: (nextQuestion) => {
        lastFocusRef.current = document.activeElement as HTMLElement | null
        setScoutOpen(true)
        if (nextQuestion) setQuestion(nextQuestion)
      },
      openSettings: () => {
        lastFocusRef.current = document.activeElement as HTMLElement | null
        setToolsOpen(true)
      },
    }),
    [accommodations, explanationPreferences]
  )

  return (
    <ScoutContext.Provider value={value}>
      {children}
      <div className="fixed right-6 bottom-6 z-40 hidden items-center gap-2 sm:flex print:hidden">
        {selectedText ? (
          <Button
            type="button"
            variant="secondary"
            className="hidden max-w-52 shadow-[3px_3px_0_var(--foreground)] sm:inline-flex"
            onClick={() => {
              lastFocusRef.current =
                document.activeElement as HTMLElement | null
              setScoutOpen(true)
              void ask(
                "Explain the selected text in plain English.",
                selectedText
              )
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
          className="hidden bg-background shadow-[3px_3px_0_var(--foreground)] sm:inline-flex"
          onClick={() => {
            lastFocusRef.current = document.activeElement as HTMLElement | null
            setToolsOpen(true)
          }}
          aria-label="Open accommodations"
        >
          <AccessibilityIcon />
        </Button>
        <Button
          type="button"
          size="lg"
          className="min-h-11 shadow-[4px_4px_0_var(--foreground)]"
          onClick={() => {
            lastFocusRef.current = document.activeElement as HTMLElement | null
            setScoutOpen(true)
          }}
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
            ref={scoutDialogRef}
            className="absolute right-0 bottom-0 flex max-h-[90svh] w-full flex-col border-2 border-foreground bg-background pb-[env(safe-area-inset-bottom)] shadow-[-8px_-8px_0_rgb(20_35_58_/_0.18)] sm:top-0 sm:bottom-auto sm:h-full sm:max-h-none sm:max-w-md sm:pb-0"
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
                  You&apos;re viewing: {activeTab}
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
                Scout can explain the current lesson, practice answer, skill
                estimate, Quick Check state, or dated-plan rules when that
                server context is available. It cannot see which calendar card
                you selected or read arbitrary text elsewhere on the screen.
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
              <div role="log" aria-live="polite" aria-label="Scout answers">
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
                          <p className="ink-label text-muted-foreground">
                            Example
                          </p>
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
                          How this answer was made
                        </summary>
                        <p className="mt-2">Source: {message.answer.source}</p>
                        <p className="mt-1">{message.answer.technical}</p>
                        <p className="mt-1">
                          This answer used fixed response rules, not a model
                          reading the whole visible screen.
                        </p>
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
              </div>
              {assistantError ? (
                <p
                  className="mt-4 text-sm font-semibold text-destructive"
                  role="alert"
                >
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
                placeholder="Why is this my next lesson?"
              />
              <Button
                type="submit"
                className="mt-3 w-full"
                disabled={busy || !question.trim()}
              >
                <SendIcon /> {busy ? "Getting an answer…" : "Ask Scout"}
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
            ref={toolsDialogRef}
            className="absolute right-0 bottom-0 max-h-[90svh] w-full overflow-y-auto border-2 border-foreground bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:top-0 sm:bottom-auto sm:h-full sm:max-h-none sm:max-w-md sm:pb-5"
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
                      saveAccommodation(key, enabled)
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
                      saveExplanationPreference(
                        "depth",
                        event.target.value as ExplanationPreferences["depth"]
                      )
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
                      saveExplanationPreference(
                        "readingLevel",
                        event.target
                          .value as ExplanationPreferences["readingLevel"]
                      )
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
                      saveExplanationPreference(
                        "exampleStyle",
                        event.target
                          .value as ExplanationPreferences["exampleStyle"]
                      )
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
                    <span className="block font-bold">
                      Use fewer technical terms
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      Technical model details stay available in drawers.
                    </span>
                  </span>
                  <Switch
                    checked={explanationPreferences.fewerTechnicalTerms}
                    onCheckedChange={(enabled) =>
                      saveExplanationPreference("fewerTechnicalTerms", enabled)
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
