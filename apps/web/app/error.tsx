"use client"

import Link from "next/link"

import { RecoveryShell } from "./recovery-shell"

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <RecoveryShell
      eyebrow="Temporary detour"
      title="AlexACT hit a snag."
      body="AlexACT couldn’t finish loading this screen. Try once more, or return to the study home without submitting anything new."
      reference={error.digest}
      actions={
        <>
          <button
            type="button"
            onClick={unstable_retry}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--primary-hover)] focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none motion-reduce:transition-none"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-background px-5 py-3 text-sm font-bold text-foreground transition-colors hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none motion-reduce:transition-none"
          >
            Return to AlexACT home
          </Link>
        </>
      }
    />
  )
}
