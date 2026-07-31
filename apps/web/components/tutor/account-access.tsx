"use client"

import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import {
  BellRingIcon,
  CheckCircle2Icon,
  KeyRoundIcon,
  LogInIcon,
  SaveIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react"

import {
  LessonReminderFields,
  lessonReminderDraftFromPreferences,
} from "@/components/tutor/lesson-reminder-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  AuthViewer,
  LessonReminderDraft,
  PendingTutorSetup,
  SavedTutorPlan,
} from "@/lib/auth-types"
import { cn } from "@/lib/utils"

interface AccountAccessProps {
  viewer: AuthViewer
  savedPlan: SavedTutorPlan | null
  pendingSetup?: PendingTutorSetup | null
  onViewerChange: (viewer: AuthViewer) => void
  className?: string
  guestLabel?: string
  showLabelOnMobile?: boolean
  showCompactLabelOnMobile?: boolean
}

type Mode = "login" | "signup"

interface AuthResponse {
  viewer?: AuthViewer
  error?: string
}

async function accountRequest(body: Record<string, unknown>) {
  let response: Response
  try {
    response = await fetch("/api/auth", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(
      "AlexACT could not reach the account service. Your work is still saved on this device; check your connection and try again."
    )
  }

  const responseText = await response.text()
  let payload: AuthResponse = {}
  if (responseText) {
    try {
      payload = JSON.parse(responseText) as AuthResponse
    } catch {
      payload = {}
    }
  }
  if (!response.ok || !payload.viewer) {
    throw new Error(
      payload.error ??
        (response.status >= 500
          ? "The account service is temporarily unavailable. Your work is still saved on this device; try again in a moment."
          : "The account request did not finish. Check the fields and try again.")
    )
  }
  return payload.viewer
}

export function AccountAccess({
  viewer,
  savedPlan,
  pendingSetup = null,
  onViewerChange,
  className,
  guestLabel,
  showLabelOnMobile = false,
  showCompactLabelOnMobile = false,
}: AccountAccessProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("login")
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [reminderStatus, setReminderStatus] = useState<string | null>(null)
  const [lessonReminders, setLessonReminders] = useState<LessonReminderDraft>(
    () => lessonReminderDraftFromPreferences(viewer.lessonReminders)
  )
  const [busy, setBusy] = useState(false)
  const operationInFlightRef = useRef(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return
    const trigger = triggerRef.current
    const selector =
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    const focusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => element.getClientRects().length > 0
      )
    focusable()[0]?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== "Tab") return
      const controls = focusable()
      if (controls.length === 0) return
      const first = controls[0]
      const last = controls.at(-1)
      const active =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown)
      window.setTimeout(() => trigger?.focus(), 0)
    }
  }, [open])

  function show(nextMode: Mode) {
    setMode(nextMode)
    setError(null)
    setReminderStatus(null)
    setPassword("")
    setOpen(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (operationInFlightRef.current) return
    operationInFlightRef.current = true
    setBusy(true)
    setError(null)
    try {
      const nextViewer = await accountRequest(
        mode === "signup"
          ? {
              action: "signup",
              username,
              displayName,
              password,
              savedPlan,
              pendingSetup,
              lessonReminders,
            }
          : {
              action: "login",
              username,
              password,
              pendingSetup,
            }
      )
      setLessonReminders(
        lessonReminderDraftFromPreferences(nextViewer.lessonReminders)
      )
      onViewerChange(nextViewer)
      setOpen(false)
      setPassword("")
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "AlexACT could not save the account. Your work is still on this device; try again."
      )
    } finally {
      operationInFlightRef.current = false
      setBusy(false)
    }
  }

  async function saveReminders(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (operationInFlightRef.current) return
    operationInFlightRef.current = true
    setBusy(true)
    setError(null)
    setReminderStatus(null)
    try {
      const nextViewer = await accountRequest({
        action: "save_reminders",
        lessonReminders,
      })
      setLessonReminders(
        lessonReminderDraftFromPreferences(nextViewer.lessonReminders)
      )
      onViewerChange(nextViewer)
      setReminderStatus(
        lessonReminders.enabled
          ? "Preferences saved. Reminders will begin when AlexACT's delivery service is enabled."
          : "Lesson reminders are off. Saved email and phone reminder contacts were removed."
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Lesson reminder preferences could not be saved."
      )
    } finally {
      operationInFlightRef.current = false
      setBusy(false)
    }
  }

  async function signOutAccount() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      })
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error ?? "Could not sign out.")
      }
      window.location.assign("/")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign out.")
      setBusy(false)
    }
  }

  const buttonLabel =
    viewer.role === "judge"
      ? "Developer mode"
      : viewer.role === "learner"
        ? viewer.displayName || viewer.username || "My account"
        : (guestLabel ?? "Sign in / save progress")
  const compactButtonLabel =
    viewer.role === "judge"
      ? "Developer"
      : viewer.role === "learner"
        ? "Account"
        : "Save"

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        aria-label={buttonLabel}
        className={cn("min-h-11 max-w-52 min-w-11", className)}
        onClick={() => show("login")}
      >
        {viewer.role === "judge" ? (
          <ShieldCheckIcon />
        ) : viewer.role === "learner" ? (
          <UserRoundIcon />
        ) : (
          <SaveIcon />
        )}
        {showLabelOnMobile ? (
          <span className="truncate">{buttonLabel}</span>
        ) : showCompactLabelOnMobile ? (
          <>
            <span className="truncate sm:hidden">{compactButtonLabel}</span>
            <span className="hidden truncate sm:inline">{buttonLabel}</span>
          </>
        ) : (
          <span className="hidden truncate sm:inline">{buttonLabel}</span>
        )}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-5"
          role="presentation"
          onMouseDown={() => setOpen(false)}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="max-h-[92svh] w-full overflow-y-auto border-2 border-foreground bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[8px_8px_0_rgb(20_35_58_/_0.2)] sm:max-w-lg sm:p-7"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-5 border-b-2 border-foreground pb-5">
              <div>
                <p className="ink-label text-primary">
                  {viewer.authenticated ? "Account" : "Optional account"}
                </p>
                <h2
                  id={titleId}
                  className="mt-2 font-heading text-4xl leading-none font-black"
                >
                  {viewer.authenticated
                    ? viewer.role === "judge"
                      ? "Developer mode is on."
                      : "Your progress is saved."
                    : mode === "login"
                      ? "Welcome back."
                      : "Keep your AlexACT progress."}
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close account panel"
                onClick={() => setOpen(false)}
              >
                <XIcon />
              </Button>
            </div>

            {viewer.authenticated ? (
              <div className="pt-6">
                <div className="border-l-4 border-primary bg-[var(--info-surface)] p-5">
                  <div className="flex items-center gap-3">
                    {viewer.role === "judge" ? (
                      <ShieldCheckIcon
                        className="size-6 text-primary"
                        aria-hidden="true"
                      />
                    ) : (
                      <CheckCircle2Icon
                        className="size-6 text-primary"
                        aria-hidden="true"
                      />
                    )}
                    <div>
                      <p className="font-bold">{viewer.displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        @{viewer.username}
                      </p>
                    </div>
                  </div>
                  <p id={descriptionId} className="mt-4 text-sm leading-6">
                    {viewer.role === "judge"
                      ? "Live learner-model evidence, assessment details, and protected demo controls are visible in this session."
                      : "Your latest AlexACT plan is saved to this account."}
                  </p>
                </div>
                {error ? (
                  <p
                    className="mt-4 text-sm font-semibold text-destructive"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
                {viewer.role === "learner" ? (
                  <form
                    className="mt-6 border-t-2 border-foreground pt-6"
                    onSubmit={saveReminders}
                  >
                    <div className="flex items-start gap-3">
                      <BellRingIcon
                        className="mt-0.5 size-5 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <div>
                        <h3 className="font-heading text-xl font-black">
                          Lesson reminders
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          Choose if and when AlexACT may contact you about your
                          schedule. These settings are optional.
                        </p>
                      </div>
                    </div>
                    <LessonReminderFields
                      value={lessonReminders}
                      onChange={setLessonReminders}
                      idPrefix="account-reminders"
                      className="mt-5"
                    />
                    {reminderStatus ? (
                      <p
                        className="mt-4 text-sm font-semibold text-primary"
                        role="status"
                      >
                        {reminderStatus}
                      </p>
                    ) : null}
                    <Button
                      type="submit"
                      variant="outline"
                      size="lg"
                      className="mt-5 w-full"
                      disabled={busy}
                    >
                      <BellRingIcon />
                      {busy ? "Saving…" : "Save reminder settings"}
                    </Button>
                  </form>
                ) : (
                  <div className="mt-6 border-t-2 border-foreground pt-6">
                    <p className="ink-label text-primary">Unlocked tools</p>
                    <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
                      <li>Live diagnostic and learner-model evidence</li>
                      <li>Adaptive-plan reasoning and model confidence</li>
                      <li>Protected seeded demos and recovery controls</li>
                    </ul>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="mt-6 w-full"
                  disabled={busy}
                  onClick={() => void signOutAccount()}
                >
                  {busy ? "Signing out…" : "Sign out"}
                </Button>
              </div>
            ) : (
              <>
                <p
                  id={descriptionId}
                  className="mt-5 text-sm leading-6 text-muted-foreground"
                >
                  Accounts are optional. Create one to save this plan across
                  devices.
                </p>

                <div
                  className="mt-5 grid grid-cols-2 border-b"
                  role="tablist"
                  aria-label="Account action"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "login"}
                    className={cn(
                      "min-h-11 border-b-2 px-3 text-sm font-bold",
                      mode === "login"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground"
                    )}
                    onClick={() => {
                      setMode("login")
                      setError(null)
                    }}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "signup"}
                    className={cn(
                      "min-h-11 border-b-2 px-3 text-sm font-bold",
                      mode === "signup"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground"
                    )}
                    onClick={() => {
                      setMode("signup")
                      setError(null)
                    }}
                  >
                    Create account
                  </button>
                </div>

                <form className="mt-6 grid gap-4" onSubmit={submit}>
                  {mode === "signup" ? (
                    <label className="grid gap-2 text-sm font-bold">
                      Your name
                      <Input
                        value={displayName}
                        autoComplete="name"
                        maxLength={60}
                        required
                        placeholder="Alex"
                        onChange={(event) => setDisplayName(event.target.value)}
                      />
                    </label>
                  ) : null}
                  <label className="grid gap-2 text-sm font-bold">
                    Username
                    <Input
                      value={username}
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="username"
                      minLength={3}
                      maxLength={32}
                      required
                      placeholder="alex-studies"
                      onChange={(event) => setUsername(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold">
                    Password
                    <Input
                      type="password"
                      value={password}
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                      minLength={mode === "signup" ? 12 : 1}
                      maxLength={128}
                      required
                      placeholder={
                        mode === "signup" ? "12+ characters" : "Your password"
                      }
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </label>
                  {mode === "signup" ? (
                    <>
                      <p className="-mt-1 text-xs leading-5 text-muted-foreground">
                        Use at least 12 characters with a letter, number, and
                        symbol. Your password is never stored in readable form.
                      </p>
                      <LessonReminderFields
                        value={lessonReminders}
                        onChange={setLessonReminders}
                        idPrefix="signup-reminders"
                      />
                    </>
                  ) : null}
                  {error ? (
                    <p
                      className="text-sm font-semibold text-destructive"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : null}
                  <Button type="submit" size="xl" disabled={busy}>
                    {mode === "login" ? <LogInIcon /> : <KeyRoundIcon />}
                    {busy
                      ? "Working…"
                      : mode === "login"
                        ? "Sign in"
                        : savedPlan
                          ? "Create account and save this plan"
                          : "Create my account"}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
