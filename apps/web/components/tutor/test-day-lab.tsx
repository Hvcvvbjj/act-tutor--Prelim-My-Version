"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  CoreSection,
  ExamConfidence,
  ExamLabMode,
  ExamLabResponse,
  ExamLabSessionPayload,
} from "@act-tutor/core"
import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react"

import { ExamLabReport } from "@/components/tutor/exam-lab-report"
import { ExamLabReview } from "@/components/tutor/exam-lab-review"
import { ExamLabRunner } from "@/components/tutor/exam-lab-runner"
import { ExamLabSetup } from "@/components/tutor/exam-lab-setup"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type LabScreen = "loading" | "setup" | "runner" | "review" | "results"
type SaveStatus = "saved" | "saving" | "error"

interface SessionResponse {
  session: ExamLabSessionPayload | null
  error?: string
}

function screenFor(session: ExamLabSessionPayload): LabScreen {
  if (session.status === "completed") return "results"
  return session.progress.phase === "review" ? "review" : "runner"
}

async function labRequest(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>
) {
  const response = await fetch("/api/exam-lab", {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = (await response.json()) as SessionResponse
  if (!response.ok)
    throw new Error(payload.error ?? "The timed-practice request failed.")
  return payload.session
}

export function TestDayLab({
  extendedTime = false,
  initialMode = "sprint",
  initialSection = "english",
}: {
  extendedTime?: boolean
  initialMode?: ExamLabMode
  initialSection?: CoreSection
}) {
  const [screen, setScreen] = useState<LabScreen>("loading")
  const [session, setSession] = useState<ExamLabSessionPayload | null>(null)
  const [mode, setMode] = useState<ExamLabMode>(initialMode)
  const [section, setSection] = useState<CoreSection>(initialSection)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved")
  const [timeLeft, setTimeLeft] = useState(0)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const saveRevision = useRef(0)
  const openedAt = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/exam-lab", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Could not load timed-practice progress.")
        return (await response.json()) as SessionResponse
      })
      .then(({ session: resumed }) => {
        if (resumed) {
          setSession(resumed)
          setScreen(screenFor(resumed))
          openedAt.current = Date.now()
        } else {
          setScreen("setup")
        }
      })
      .catch((caught) => {
        if (controller.signal.aborted) return
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load timed-practice progress."
        )
        setScreen("setup")
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!session || screen !== "runner") return
    function updateClock() {
      setTimeLeft(
        Math.max(
          0,
          Math.ceil(
            (new Date(session!.sectionDeadlineAt).getTime() - Date.now()) / 1000
          )
        )
      )
    }
    updateClock()
    const interval = window.setInterval(updateClock, 1000)
    return () => window.clearInterval(interval)
  }, [screen, session])

  const persist = useCallback(
    (
      nextSession: ExamLabSessionPayload,
      nextResponses: Record<string, ExamLabResponse>,
      nextIndex: number,
      phase: "questions" | "review"
    ) => {
      const revision = ++saveRevision.current
      setSaveStatus("saving")
      const operation = saveQueue.current
        .catch(() => undefined)
        .then(async () => {
          const updated = await labRequest("PATCH", {
            responses: nextResponses,
            currentIndex: nextIndex,
            phase,
          })
          if (updated) setSession(updated)
        })
      saveQueue.current = operation
      operation.then(
        () => {
          if (saveRevision.current === revision) setSaveStatus("saved")
        },
        (caught) => {
          if (saveRevision.current === revision) setSaveStatus("error")
          setError(
            caught instanceof Error ? caught.message : "Autosave failed."
          )
        }
      )
      setSession(nextSession)
    },
    []
  )

  function localSession(
    current: ExamLabSessionPayload,
    responses: Record<string, ExamLabResponse>,
    currentIndex = current.progress.currentIndex,
    phase: "questions" | "review" = current.progress.phase === "review"
      ? "review"
      : "questions"
  ): ExamLabSessionPayload {
    return {
      ...current,
      progress: {
        ...current.progress,
        responses,
        currentIndex,
        phase,
        updatedAt: new Date().toISOString(),
      },
    }
  }

  function captureCurrent(patch: Partial<ExamLabResponse>, current = session) {
    if (!current) return null
    const question = current.questions[current.progress.currentIndex]
    const previous = current.progress.responses[question.id]
    const addedSeconds = openedAt.current
      ? Math.max(0, Math.floor((Date.now() - openedAt.current) / 1000))
      : 0
    openedAt.current = Date.now()
    const response: ExamLabResponse = {
      choiceId: previous?.choiceId ?? null,
      confidence: previous?.confidence ?? "unsure",
      flagged: previous?.flagged ?? false,
      elapsedSeconds: Math.min(
        7200,
        (previous?.elapsedSeconds ?? 0) + addedSeconds
      ),
      ...patch,
    }
    const responses = { ...current.progress.responses, [question.id]: response }
    const next = localSession(current, responses)
    persist(
      next,
      responses,
      current.progress.currentIndex,
      next.progress.phase === "review" ? "review" : "questions"
    )
    return next
  }

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const started = await labRequest("POST", {
        action: "start",
        mode,
        section,
        timeMultiplier: extendedTime ? 1.5 : 1,
      })
      if (!started) throw new Error("The timed-practice session is missing.")
      setSession(started)
      setScreen("runner")
      setSaveStatus("saved")
      openedAt.current = Date.now()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not start timed practice."
      )
    } finally {
      setBusy(false)
    }
  }

  function answer(choiceId: string) {
    captureCurrent({ choiceId })
  }

  function confidence(value: ExamConfidence) {
    captureCurrent({ confidence: value })
  }

  function toggleFlag() {
    if (!session) return
    const question = session.questions[session.progress.currentIndex]
    captureCurrent({
      flagged: !session.progress.responses[question.id]?.flagged,
    })
  }

  function move(index: number) {
    if (!session || index < 0 || index >= session.questions.length) return
    const currentQuestion = session.questions[session.progress.currentIndex]
    const previous = session.progress.responses[currentQuestion.id]
    const addedSeconds = openedAt.current
      ? Math.max(0, Math.floor((Date.now() - openedAt.current) / 1000))
      : 0
    openedAt.current = Date.now()
    const responses = previous
      ? {
          ...session.progress.responses,
          [currentQuestion.id]: {
            ...previous,
            elapsedSeconds: Math.min(
              7200,
              previous.elapsedSeconds + addedSeconds
            ),
          },
        }
      : session.progress.responses
    const phase = session.progress.phase === "review" ? "review" : "questions"
    const next = localSession(session, responses, index, phase)
    persist(next, responses, index, phase)
  }

  async function endSection() {
    if (!session) return
    if (session.progress.phase === "review") {
      setScreen("review")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const current = captureCurrent({}) ?? session
      await saveQueue.current
      const advanced = await labRequest("POST", { action: "advance_section" })
      if (!advanced) throw new Error("The next section is missing.")
      setSession(advanced)
      setScreen(advanced.progress.phase === "review" ? "review" : "runner")
      openedAt.current = Date.now()
      if (current.progress.currentSection !== advanced.progress.currentSection)
        setSaveStatus("saved")
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not end this section."
      )
    } finally {
      setBusy(false)
    }
  }

  async function finalize() {
    setBusy(true)
    setError(null)
    try {
      await saveQueue.current
      const completed = await labRequest("POST", { action: "finalize" })
      if (!completed?.result)
        throw new Error("The timed-practice report is missing.")
      setSession(completed)
      setScreen("results")
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not score this simulation."
      )
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    setBusy(true)
    try {
      await labRequest("DELETE")
      setSession(null)
      setScreen("setup")
      setError(null)
      setSaveStatus("saved")
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not reset timed practice."
      )
    } finally {
      setBusy(false)
    }
  }

  if (screen === "loading") {
    return (
      <main className="flex min-h-[60svh] items-center justify-center">
        <div className="text-center">
          <LoaderCircleIcon className="mx-auto size-8 animate-spin text-primary" />
          <p className="mt-4 font-semibold">Loading timed practice…</p>
        </div>
      </main>
    )
  }

  return (
    <>
      {error ? (
        <div className="mx-auto max-w-6xl px-5 pt-6 sm:px-8">
          <Alert className="bg-background">
            <CircleAlertIcon />
            <AlertTitle>Timed practice could not continue</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      {screen === "setup" ? (
        <ExamLabSetup
          mode={mode}
          section={section}
          busy={busy}
          extendedTime={extendedTime}
          onModeChange={setMode}
          onSectionChange={setSection}
          onStart={start}
        />
      ) : screen === "runner" && session ? (
        <ExamLabRunner
          session={session}
          timeLeft={timeLeft}
          saveStatus={saveStatus}
          busy={busy}
          onAnswer={answer}
          onConfidence={confidence}
          onToggleFlag={toggleFlag}
          onMove={move}
          onEndSection={endSection}
        />
      ) : screen === "review" && session ? (
        <ExamLabReview
          session={session}
          busy={busy}
          onReturn={(index) => {
            setScreen("runner")
            move(index)
          }}
          onSubmit={finalize}
        />
      ) : screen === "results" && session ? (
        <ExamLabReport session={session} onNewRun={reset} />
      ) : null}
    </>
  )
}
