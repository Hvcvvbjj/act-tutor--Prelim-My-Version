import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowLeftIcon,
  BotIcon,
  DownloadIcon,
  KeyRoundIcon,
  LaptopIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Data, Privacy, and Limits",
  description:
    "A plain-language explanation of what Scout ACT saves, how learners control it, and where AI is—and is not—allowed to act.",
  alternates: {
    canonical: "/trust",
  },
}

const STUDY_DATA = [
  "Your goal, score source, test date, and study schedule.",
  "Diagnostic, Quick Check, lesson, practice, and timed-practice responses.",
  "Skill estimates, dated assignments, saved corrections, and resume point.",
]

const AI_CAN = [
  "Compose a lesson or debrief from reviewed content and learner evidence.",
  "Adjust explanation depth and examples to a learner’s saved preferences.",
  "Fall back to reviewed deterministic teaching when generation is unavailable or fails a check.",
]

const AI_CANNOT = [
  "Choose or invent answer keys, or score a learner response.",
  "Award mastery, XP, or a score without server-verified evidence.",
  "Choose the next skill or rewrite the calendar by itself.",
]

export default function TrustPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-[var(--canvas)] px-5 py-8 sm:px-8 sm:py-12"
    >
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Back to Scout
        </Link>

        <header className="mt-8 border-b-2 border-foreground pb-8 sm:mt-10 sm:pb-10">
          <div className="flex items-center gap-3 text-primary">
            <ShieldCheckIcon className="size-6" aria-hidden="true" />
            <p className="ink-label">Scout trust center</p>
          </div>
          <h1 className="mt-4 max-w-4xl font-heading text-4xl leading-[1.02] font-black tracking-[-0.035em] sm:text-6xl">
            What Scout saves—and what it does not.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Scout needs study evidence to resume your work and adapt the next
            lesson. This page explains that data in regular English, including
            what changes when you create an account.
          </p>
        </header>

        <section
          className="grid gap-8 border-b-2 border-foreground py-9 lg:grid-cols-3"
          aria-label="How Scout saves progress"
        >
          <article>
            <LaptopIcon className="size-6 text-primary" aria-hidden="true" />
            <h2 className="mt-4 font-heading text-2xl font-black">
              Guest progress
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              No account is required. This browser keeps your setup, plan
              snapshot, preferences, and resume point. A private session cookie
              connects this browser to its saved study sessions.
            </p>
          </article>

          <article>
            <KeyRoundIcon className="size-6 text-primary" aria-hidden="true" />
            <h2 className="mt-4 font-heading text-2xl font-black">
              Account progress
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              An optional account stores a display name, username, protected
              password record, latest plan, and linked Scout session. It lets
              another device restore the latest saved plan; signing in does not
              change how Scout chooses questions or lessons.
            </p>
          </article>

          <article>
            <div className="flex gap-3 text-primary" aria-hidden="true">
              <DownloadIcon className="size-6" />
              <Trash2Icon className="size-6" />
            </div>
            <h2 className="mt-4 font-heading text-2xl font-black">
              Your controls
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              After setup, open <strong>More → Data &amp; privacy</strong> to
              export a readable copy or delete Scout study sessions and the
              saved plan. Study-data deletion does not delete an account’s
              sign-in.
            </p>
          </article>
        </section>

        <section className="grid gap-8 py-9 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <p className="ink-label text-primary">Study data</p>
            <h2 className="mt-3 font-heading text-3xl font-black">
              Evidence Scout may save
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
              {STUDY_DATA.map((item) => (
                <li key={item} className="flex gap-3">
                  <span
                    className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-l-4 border-primary bg-[var(--info-surface)] px-4 py-3 text-sm leading-6">
              This hackathon build does not ask for an email address, school,
              demographic profile, or payment information.
            </p>
          </div>

          <div className="border-y-2 border-foreground py-7 lg:border-y-0 lg:border-l-2 lg:py-0 lg:pl-8">
            <div className="flex items-center gap-3 text-primary">
              <BotIcon className="size-6" aria-hidden="true" />
              <p className="ink-label">AI boundary</p>
            </div>
            <h2 className="mt-3 font-heading text-3xl font-black">
              AI may explain. Evidence makes the decision.
            </h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="font-bold">AI can</h3>
                <ul className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                  {AI_CAN.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-bold">AI cannot</h3>
                <ul className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                  {AI_CANNOT.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border-2 border-foreground bg-[#10243d] p-6 text-[#f7fbff] shadow-[8px_8px_0_var(--foreground)] sm:p-8">
          <p className="font-mono text-xs font-black tracking-[0.12em] text-[var(--scout-sun)] uppercase">
            Product limits
          </p>
          <h2 className="mt-3 font-heading text-3xl font-black">
            Scout is a study coach, not an official score report.
          </h2>
          <div className="mt-5 grid gap-4 text-sm leading-6 text-white/75 md:grid-cols-2">
            <p>
              Practice questions are original. Skill percentages, planning
              baselines, and practice score ranges are study estimates—not
              official ACT results or promises that a target score is reachable.
            </p>
            <p>
              Scout ACT is an independent hackathon project and is not
              affiliated with or endorsed by ACT. Mr. Kim is a fictional AI
              tutor, not a teacher, counselor, or ACT representative.
            </p>
          </div>
        </section>

        <div className="mt-10 flex flex-col items-start gap-3 border-t pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Ready to study? Returning to Scout preserves this browser’s guest
            progress.
          </p>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none motion-reduce:transition-none"
          >
            Return to Scout
          </Link>
        </div>
      </div>
    </main>
  )
}
