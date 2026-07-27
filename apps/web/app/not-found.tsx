import Link from "next/link"

import { RecoveryShell } from "./recovery-shell"

export default function NotFound() {
  return (
    <RecoveryShell
      eyebrow="Wrong trail"
      title="Scout can’t find that page."
      body="The link may be old, or the page may have moved. Return to Scout’s study home and keep going."
      actions={
        <Link
          href="/"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--primary-hover)] focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none motion-reduce:transition-none"
        >
          Return to Scout home
        </Link>
      }
    />
  )
}
