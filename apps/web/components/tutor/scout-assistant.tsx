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
import { SendIcon, Volume2Icon, XIcon } from "lucide-react"

import { replayDashboardTour } from "@/components/tutor/dashboard-tour"
import { ScoutMark } from "@/components/tutor/scout"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  answerWithOnDeviceMrKimAI,
  ON_DEVICE_AI_CHECK,
  onDeviceAIAvailability,
  prepareOnDeviceMrKimAI,
} from "@/lib/mr-kim-on-device"
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
  openScout: (question?: string, questionId?: string | null) => void
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
    "Extra-visible keyboard focus",
    "Makes the focus outline easier to follow.",
  ],
  ["readAloud", "Read aloud", "Adds speech controls to Scout answers."],
  [
    "simplified",
    "Shorter lesson text",
    "Shows the shortest useful explanation in each lesson step.",
  ],
  ["extendedTime", "Extended Timed Practice", "Uses a 1.5× time allowance."],
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

function ScoutAnswerCard({
  message,
  canViewTechnicalDetails,
  readAloud,
  compact = false,
  onSimplify,
}: {
  message: ScoutMessage
  canViewTechnicalDetails: boolean
  readAloud: boolean
  compact?: boolean
  onSimplify?: () => void
}) {
  return (
    <div className={compact ? "border-t py-4" : "mt-5"}>
      <p className="text-xs font-semibold text-muted-foreground">
        {message.question}
      </p>
      <article
        className={
          compact ? "mt-2" : "mt-2 bg-[var(--info-surface)] p-4 sm:p-5"
        }
      >
        <p
          className={
            compact
              ? "font-heading text-lg font-black"
              : "font-heading text-2xl font-black"
          }
        >
          {message.answer.summary}
        </p>
        <p className="mt-3 text-sm leading-6">{message.answer.explanation}</p>
        {!compact && message.answer.example ? (
          <div className="mt-4 border-t border-foreground/20 pt-4">
            <p className="ink-label text-muted-foreground">Example</p>
            <p className="mt-2 text-sm leading-6">{message.answer.example}</p>
          </div>
        ) : null}
        {onSimplify ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3 px-0"
            onClick={onSimplify}
          >
            Simplify this answer
          </Button>
        ) : null}
        {canViewTechnicalDetails ? (
          <details className="mt-4 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-bold text-foreground">
              How this answer was made
            </summary>
            <p className="mt-2">Source: {message.answer.source}</p>
            <p className="mt-1">{message.answer.technical}</p>
            <p className="mt-1">
              Mr. Kim receives only the grounded study context sent by this
              screen. Guarded requests use reviewed fallback guidance.
            </p>
          </details>
        ) : null}
        {readAloud ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() =>
              speak(`${message.answer.summary} ${message.answer.explanation}`)
            }
          >
            <Volume2Icon /> Read aloud
          </Button>
        ) : null}
      </article>
    </div>
  )
}

export function ScoutProvider({
  children,
  activeTab,
  learning,
  canViewTechnicalDetails = false,
  onEditPlan,
  onOpenDataPrivacy,
}: {
  children: ReactNode
  activeTab: string
  learning: LearningSessionPayload | null
  canViewTechnicalDetails?: boolean
  onEditPlan?: () => void
  onOpenDataPrivacy?: () => void
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
  const [contextQuestionId, setContextQuestionId] = useState<string | null>(
    null
  )
  const [visibleMessages, setVisibleMessages] = useState<
    Array<{ screen: string; message: ScoutMessage }>
  >([])
  const [selectedText, setSelectedText] = useState("")
  const [assistantError, setAssistantError] = useState<string | null>(null)
  const [serverAiAvailable, setServerAiAvailable] = useState(false)
  const [onDeviceAiStatus, setOnDeviceAiStatus] = useState<
    "checking" | "available" | "downloadable" | "downloading" | "unavailable"
  >("checking")
  const [onDeviceAiProgress, setOnDeviceAiProgress] = useState<number | null>(
    null
  )
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
        setServerAiAvailable(Boolean(payload.aiAvailable))
        setVisibleMessages(
          payload.messages.slice(-15).map((message) => ({
            screen: message.screen ?? "today",
            message,
          }))
        )
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
    let cancelled = false
    void onDeviceAIAvailability().then((availability) => {
      if (!cancelled) setOnDeviceAiStatus(availability)
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
        (element) =>
          !element.hidden &&
          !element.matches(":disabled") &&
          element.getClientRects().length > 0
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
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      if (!activeElement || !controls.includes(activeElement)) {
        event.preventDefault()
        const wrapTarget = event.shiftKey ? last : first
        wrapTarget?.focus()
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && activeElement === last) {
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
    if (activeTab === "badges")
      return ["What is my closest badge?", "How does badge progress work?"]
    if (activeTab === "progress")
      return ["Why is this skill next?", "How do I improve this skill?"]
    if (activeTab === "calibrate")
      return ["How many questions are left?", "What happens when I finish?"]
    if (activeTab === "plan")
      return ["Why is this on my schedule?", "What if I miss a day?"]
    if (activeTab === "lab")
      return ["Which practice should I choose?", "How should I pace this?"]
    if (activeTab === "diagnostic-review")
      return ["Explain this differently", "Why is that answer correct?"]
    return ["Give me a hint", "Explain this more simply"]
  }, [activeTab])

  const helperCopy = useMemo(() => {
    if (activeTab === "badges")
      return "Ask about your earned badges, closest milestone, points, or streak."
    if (activeTab === "progress")
      return "Ask about a skill estimate or what to practice next."
    if (activeTab === "calibrate")
      return "Ask about Quick Check or how many questions remain."
    if (activeTab === "plan") return "Ask about your schedule or missed work."
    if (activeTab === "lab")
      return "Ask about pacing or Timed Practice controls."
    if (activeTab === "diagnostic-review")
      return "Ask about the missed diagnostic question you are reviewing."
    return "Ask for a hint or a simpler explanation."
  }, [activeTab])

  const screenMessages = useMemo(
    () => visibleMessages.filter((entry) => entry.screen === activeTab),
    [activeTab, visibleMessages]
  )
  const latestMessage = screenMessages.at(-1)?.message
  const earlierMessages = screenMessages.slice(0, -1)
  const latestWasHostedAI = Boolean(
    latestMessage?.answer.receipt.checks.includes("openai-responses-api")
  )
  const latestWasFreeServerAI = Boolean(
    latestMessage?.answer.receipt.checks.includes("openai-compatible-chat")
  )
  const latestWasOnDeviceAI = Boolean(
    latestMessage?.answer.receipt.checks.includes(ON_DEVICE_AI_CHECK)
  )
  const freeAiCanRun =
    onDeviceAiStatus === "available" ||
    onDeviceAiStatus === "downloadable" ||
    onDeviceAiStatus === "downloading"

  async function ask(nextQuestion = question, selection: string | null = null) {
    if (!nextQuestion.trim()) return
    setBusy(true)
    setAssistantError(null)
    try {
      const onDevicePreparation =
        !serverAiAvailable && freeAiCanRun
          ? (() => {
              if (onDeviceAiStatus !== "available") {
                setOnDeviceAiStatus("downloading")
                setOnDeviceAiProgress(0)
              }
              return prepareOnDeviceMrKimAI({
                onDownloadProgress: (progress) => {
                  setOnDeviceAiProgress(progress)
                },
              })
            })()
          : null
      const response = await fetch("/api/scout/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: nextQuestion,
          screen: activeTab,
          questionId:
            contextQuestionId ??
            (activeTab === "today"
              ? (learning?.questions[learning.currentQuestionIndex]?.id ?? null)
              : null),
          selectedText: selection,
        }),
      })
      const payload = (await response.json()) as
        ScoutAskResponse | { error: string }
      if (!response.ok || "error" in payload)
        throw new Error(
          "error" in payload ? payload.error : "Scout could not answer."
        )
      const nextMessages = [...payload.messages]
      setServerAiAvailable(Boolean(payload.aiAvailable))
      const serverMessage = nextMessages.at(-1)
      let displayedMessage = serverMessage
      if (
        serverMessage &&
        !serverMessage.answer.receipt.checks.some((check) =>
          ["openai-responses-api", "openai-compatible-chat"].includes(check)
        ) &&
        freeAiCanRun
      ) {
        await onDevicePreparation
        const enhancedAnswer = await answerWithOnDeviceMrKimAI({
          question: nextQuestion,
          answer: serverMessage.answer,
          history: screenMessages.map((entry) => entry.message),
          onDownloadProgress: (progress) => {
            setOnDeviceAiProgress(progress)
          },
        })
        if (enhancedAnswer.receipt.checks.includes(ON_DEVICE_AI_CHECK)) {
          setOnDeviceAiStatus("available")
          displayedMessage = { ...serverMessage, answer: enhancedAnswer }
        } else {
          setOnDeviceAiStatus(
            await onDeviceAIAvailability().catch(() => "unavailable" as const)
          )
        }
        setOnDeviceAiProgress(null)
      }
      if (displayedMessage) {
        setVisibleMessages((current) =>
          [
            ...current.filter((entry) => entry.screen !== activeTab),
            ...current.filter((entry) => entry.screen === activeTab).slice(-2),
            { screen: activeTab, message: displayedMessage },
          ].slice(-15)
        )
      }
      setQuestion("")
      if (accommodations.readAloud)
        speak(
          `${displayedMessage?.answer.summary ?? payload.answer.summary} ${
            displayedMessage?.answer.explanation ?? payload.answer.explanation
          }`
        )
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
      openScout: (nextQuestion, nextQuestionId) => {
        lastFocusRef.current = document.activeElement as HTMLElement | null
        setContextQuestionId(nextQuestionId ?? null)
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
      {selectedText ? (
        <div className="fixed right-6 bottom-6 z-40 hidden md:block print:hidden">
          <Button
            type="button"
            variant="secondary"
            className="max-w-52 shadow-[3px_3px_0_var(--foreground)]"
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
        </div>
      ) : null}

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
            aria-label="Ask Mr. Kim"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-center gap-3 border-b-2 border-foreground bg-foreground p-4 text-background">
              <ScoutMark className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="font-heading text-2xl font-black">Mr. Kim</p>
                <p className="font-mono text-[0.6rem] font-black text-[var(--scout-mint)] uppercase">
                  {latestMessage
                    ? latestWasOnDeviceAI
                      ? "Free AI · grounded on this device"
                      : latestWasFreeServerAI
                        ? "Free AI · grounded in your Scout work"
                        : latestWasHostedAI
                          ? "AI answer grounded in your Scout work"
                          : "Reviewed Scout guidance"
                    : serverAiAvailable
                      ? "AI tutor online"
                      : freeAiCanRun
                        ? "Free on-device AI ready"
                        : "Reviewed Scout guidance"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setScoutOpen(false)}
                aria-label="Close Mr. Kim"
              >
                <XIcon />
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {screenMessages.length === 0 ? (
                <>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {helperCopy}
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
                </>
              ) : null}
              <div
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
                aria-label="Scout answers"
              >
                {latestMessage ? (
                  <ScoutAnswerCard
                    message={latestMessage}
                    canViewTechnicalDetails={canViewTechnicalDetails}
                    readAloud={accommodations.readAloud}
                    onSimplify={
                      latestMessage.question
                        .toLowerCase()
                        .includes("more simply")
                        ? undefined
                        : () => void ask("Explain more simply")
                    }
                  />
                ) : null}
              </div>
              {earlierMessages.length ? (
                <details className="mt-5 border-y border-foreground/25">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-2 text-sm font-bold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                    <span>Earlier answers</span>
                    <span className="text-xs text-muted-foreground">
                      {earlierMessages.length}
                    </span>
                  </summary>
                  <div>
                    {earlierMessages.map(({ message }) => (
                      <ScoutAnswerCard
                        key={message.id}
                        message={message}
                        canViewTechnicalDetails={false}
                        readAloud={false}
                        compact
                      />
                    ))}
                  </div>
                </details>
              ) : null}
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
                rows={2}
                maxLength={500}
                className="mt-2 w-full border-2 border-foreground bg-background p-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Why is this my next lesson?"
              />
              <Button
                type="submit"
                className="mt-3 w-full"
                disabled={busy || !question.trim()}
              >
                <SendIcon />{" "}
                {busy
                  ? onDeviceAiProgress === null
                    ? "Getting an answer…"
                    : `Preparing free AI… ${Math.round(
                        onDeviceAiProgress * 100
                      )}%`
                  : "Ask Mr. Kim"}
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
            className="absolute right-0 bottom-0 max-h-[90svh] w-full overflow-y-auto border-2 border-foreground bg-background px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:top-0 sm:bottom-auto sm:h-full sm:max-h-none sm:max-w-md sm:pb-5"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 -mx-5 flex items-center justify-between gap-4 border-b border-border bg-background px-5 py-4">
              <h2 className="font-heading text-3xl font-black">Settings</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setToolsOpen(false)}
                aria-label="Close settings"
              >
                <XIcon />
              </Button>
            </div>
            <section className="divide-y border-b py-2">
              {onEditPlan ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-start rounded-none px-0"
                  onClick={() => {
                    setToolsOpen(false)
                    onEditPlan()
                  }}
                >
                  Goal and schedule
                </Button>
              ) : null}
              {onOpenDataPrivacy ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-start rounded-none px-0"
                  onClick={() => {
                    setToolsOpen(false)
                    onOpenDataPrivacy()
                  }}
                >
                  Data &amp; privacy
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start rounded-none px-0"
                onClick={() => {
                  setToolsOpen(false)
                  replayDashboardTour()
                }}
              >
                Replay website tour
              </Button>
            </section>
            <details className="group border-b">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-heading text-lg font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                Study access
                <span className="font-mono text-xs font-bold text-muted-foreground">
                  8 options
                </span>
              </summary>
              <div className="divide-y border-t">
                {ACCOMMODATION_OPTIONS.map(([key, label, detail]) => (
                  <label
                    key={key}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3.5"
                  >
                    <span>
                      <span className="block font-bold">{label}</span>
                      <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                        {detail}
                      </span>
                    </span>
                    <Switch
                      checked={accommodations[key]}
                      onCheckedChange={(enabled) =>
                        saveAccommodation(key, enabled)
                      }
                    />
                  </label>
                ))}
              </div>
            </details>
            <details className="group border-b">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-heading text-lg font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                Mr. Kim&apos;s answers
                <span className="font-mono text-xs font-bold text-muted-foreground">
                  Style
                </span>
              </summary>
              <div className="grid gap-4 border-t py-4">
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
                    className="h-11 rounded-lg border bg-background px-3"
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
                    className="h-11 rounded-lg border bg-background px-3"
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
                    className="h-11 rounded-lg border bg-background px-3"
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
                      Keep answers direct and learner-facing.
                    </span>
                  </span>
                  <Switch
                    checked={explanationPreferences.fewerTechnicalTerms}
                    onCheckedChange={(enabled) =>
                      saveExplanationPreference("fewerTechnicalTerms", enabled)
                    }
                  />
                </label>
              </div>
            </details>
          </aside>
        </div>
      ) : null}
    </ScoutContext.Provider>
  )
}
