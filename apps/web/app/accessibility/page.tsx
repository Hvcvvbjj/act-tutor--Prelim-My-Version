import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  ExternalLinkIcon,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Accessibility",
  description:
    "Review Scout's built-in study-access controls, accessibility commitments, and current limits.",
  alternates: {
    canonical: "/accessibility",
  },
}

const ACCESS_OPTIONS = [
  {
    label: "Reading and contrast",
    copy: "Use larger text, higher contrast, or extra-visible keyboard focus across the study workspace.",
  },
  {
    label: "Motion and focus",
    copy: "Reduce nonessential movement or remove the practice sidebar for a quieter question view.",
  },
  {
    label: "Pacing",
    copy: "Give Timed Practice a 1.5× allowance without changing how answers are scored.",
  },
  {
    label: "Teaching style",
    copy: "Request simpler wording or device-supported read-aloud controls for lessons and Scout answers.",
  },
] as const

const ACCESS_COMMITMENTS = [
  "A skip link and visible focus treatment support keyboard navigation.",
  "Primary study controls are designed for comfortable keyboard and touch targets.",
  "Reduced-motion preferences stop nonessential animation.",
  "Study-access choices stay on this device and can be changed at any time.",
] as const

export default function AccessibilityPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-[var(--canvas)] px-5 py-8 sm:px-8 sm:py-12"
    >
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Back to Scout
        </Link>

        <header className="mt-8 border-b-2 border-foreground pb-9 sm:mt-10 sm:pb-12">
          <p className="ink-label text-primary">Accessibility at Scout</p>
          <h1 className="mt-4 max-w-4xl font-heading text-4xl leading-[1.03] font-black tracking-[-0.035em] sm:text-6xl">
            Study tools should adapt to how you work.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Scout includes display, focus, pacing, and explanation controls.
            This page explains what is available, where to find it, and what is
            still being checked.
          </p>
        </header>

        <section
          aria-labelledby="access-options-title"
          className="border-b-2 border-foreground py-9 sm:py-12"
        >
          <div className="grid gap-7 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-12">
            <div>
              <p className="ink-label text-primary">8 study-access options</p>
              <h2
                id="access-options-title"
                className="mt-3 font-heading text-3xl font-black tracking-[-0.025em] sm:text-4xl"
              >
                Choose support without changing the evidence.
              </h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                These controls change presentation, pacing, or teaching style.
                They do not turn an unanswered question into evidence or let the
                AI tutor change a score.
              </p>
            </div>

            <ol className="grid gap-px overflow-hidden rounded-2xl border-2 border-foreground bg-foreground sm:grid-cols-2">
              {ACCESS_OPTIONS.map((option, index) => (
                <li key={option.label} className="bg-background p-5 sm:p-6">
                  <span className="font-mono text-xs font-black tracking-[0.12em] text-primary">
                    0{index + 1}
                  </span>
                  <h3 className="mt-3 font-heading text-xl font-black">
                    {option.label}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {option.copy}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="find-controls-title"
          className="border-b-2 border-foreground py-9 sm:py-12"
        >
          <div className="grid gap-7 rounded-[2rem] border border-border bg-[var(--info-surface)] p-6 shadow-sm sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="ink-label text-primary">Find the controls</p>
              <h2
                id="find-controls-title"
                className="mt-3 font-heading text-3xl font-black tracking-[-0.025em]"
              >
                Settings → Study access
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                After you build a plan, open Settings and expand Study access.
                Every option has a plain-language description before you turn it
                on.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-black text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none motion-reduce:transition-none"
            >
              Open Scout
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="commitments-title"
          className="border-b-2 border-foreground py-9 sm:py-12"
        >
          <h2
            id="commitments-title"
            className="font-heading text-3xl font-black tracking-[-0.025em]"
          >
            What the current build supports.
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {ACCESS_COMMITMENTS.map((commitment) => (
              <li
                key={commitment}
                className="flex gap-3 border-l-2 border-primary py-1 pl-4 text-sm leading-6 text-muted-foreground"
              >
                <CheckCircle2Icon
                  className="mt-0.5 size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>{commitment}</span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="limits-title"
          className="border-b-2 border-foreground py-9 sm:py-12"
        >
          <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
            <CircleAlertIcon
              className="size-7 text-[var(--scout-coral-text)]"
              aria-hidden="true"
            />
            <div>
              <h2
                id="limits-title"
                className="font-heading text-3xl font-black tracking-[-0.025em]"
              >
                Current limits
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                <p>
                  Scout is a hackathon project, not a formal WCAG conformance
                  claim or a replacement for an official accommodation plan.
                </p>
                <p>
                  Read-aloud depends on browser and device speech support.
                  Official ACT test-day accommodations must still be arranged
                  through the ACT process.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="pt-9 sm:pt-12" aria-labelledby="report-title">
          <p className="ink-label text-primary">Help improve access</p>
          <h2
            id="report-title"
            className="mt-3 max-w-3xl font-heading text-3xl font-black tracking-[-0.025em]"
          >
            Tell us what blocked you.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
            Include the page, device or browser, what you expected, and what
            happened. Do not include a password, account recovery code, or
            private score details.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://github.com/Hvcvvbjj/act-tutor--Prelim-My-Version/issues"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-black text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none motion-reduce:transition-none"
            >
              Report an accessibility issue
              <ExternalLinkIcon className="size-4" aria-hidden="true" />
            </a>
            <Link
              href="/trust"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border-2 border-foreground bg-background px-5 text-sm font-black text-foreground transition-colors hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none motion-reduce:transition-none"
            >
              Read data and privacy limits
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
