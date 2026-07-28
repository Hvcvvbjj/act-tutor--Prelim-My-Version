import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
} from "lucide-react"

export const metadata: Metadata = {
  title: "How Scout Works",
  description:
    "See how Scout turns a scored answer into learning evidence and the next ACT study action.",
  alternates: {
    canonical: "/how-scout-works",
  },
}

const STEPS = [
  {
    label: "Score the answer",
    copy: "Scout checks original practice against a reviewed answer key. The AI tutor cannot change the score.",
  },
  {
    label: "Update one skill",
    copy: "The result updates the matching skill estimate. Scout keeps limited evidence and uncertainty visible.",
  },
  {
    label: "Guide later rounds",
    copy: "Scout weighs that evidence with your goal, test date, and study time before setting later-round priorities.",
  },
] as const

const PROOF_POINTS = [
  "The estimate before and after a scored answer.",
  "How many answers support the estimate.",
  "Why the next skill changed—or why it stayed the same.",
  "Whether Scout used a generated explanation or its reviewed fallback.",
] as const

export default function HowScoutWorksPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-[var(--canvas)] px-5 py-8 sm:px-8 sm:py-12"
    >
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Back to Scout
        </Link>

        <header className="mt-8 border-b-2 border-foreground pb-9 sm:mt-10 sm:pb-12">
          <p className="ink-label text-primary">How Scout works</p>
          <h1 className="mt-4 max-w-4xl font-heading text-4xl leading-[1.03] font-black tracking-[-0.035em] sm:text-6xl">
            Scout uses scored answers to guide what comes after Round 1.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Scoring, learning estimates, planning, and AI explanations are
            separate jobs. That keeps one answer from becoming a guess about
            everything you know.
          </p>
        </header>

        <section
          className="border-b-2 border-foreground py-9 sm:py-12"
          aria-labelledby="learning-loop-title"
        >
          <h2
            id="learning-loop-title"
            className="font-heading text-3xl font-black tracking-[-0.025em] sm:text-4xl"
          >
            One answer, three steps.
          </h2>
          <ol className="mt-7 divide-y-2 divide-foreground border-y-2 border-foreground">
            {STEPS.map((step, index) => (
              <li
                key={step.label}
                className="grid gap-2 py-5 sm:grid-cols-[3rem_13rem_minmax(0,1fr)] sm:items-start sm:gap-5"
              >
                <span className="font-mono text-sm font-black text-primary">
                  0{index + 1}
                </span>
                <h3 className="font-heading text-xl font-black">
                  {step.label}
                </h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  {step.copy}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-b-2 border-foreground py-9 sm:py-12">
          <h2 className="font-heading text-3xl font-black tracking-[-0.025em]">
            Quick Check and the full diagnostic do different jobs.
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="border-l-2 border-primary pl-4">
              <h3 className="font-heading text-xl font-black">Quick Check</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                8–12 adaptive questions refine a starting point quickly and
                update your skill estimates. Round 1 still teaches every
                question type.
              </p>
            </div>
            <div className="border-l-2 border-foreground pl-4">
              <h3 className="font-heading text-xl font-black">
                Full diagnostic
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                66 original English, Math, and Reading questions create a
                broader baseline or start a later lesson round.
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            Neither is an official ACT form. Both create study evidence, not an
            official score report.
          </p>
        </section>

        <details className="group border-b-2 border-foreground py-2">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-2 font-heading text-xl font-black focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            Technical details
            <ChevronDownIcon
              className="size-5 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <div className="grid gap-5 pt-3 pb-7 sm:grid-cols-3">
            <div>
              <p className="text-sm font-black text-primary">
                IRT · question picker
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Chooses a useful next Quick Check question while keeping section
                coverage balanced.
              </p>
            </div>
            <div>
              <p className="text-sm font-black text-primary">
                BKT · learning estimate
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Tracks each skill separately while allowing for guesses, slips,
                and limited evidence.
              </p>
            </div>
            <div>
              <p className="text-sm font-black text-primary">
                AI · explanation
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Changes teaching style using reviewed material. A reviewed
                fallback remains available if generation fails.
              </p>
            </div>
          </div>
        </details>

        <details className="group border-b-2 border-foreground py-2">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-2 font-heading text-xl font-black focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            What you can inspect
            <ChevronDownIcon
              className="size-5 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <ul className="space-y-3 pt-3 pb-7 text-sm leading-6 text-muted-foreground">
            {PROOF_POINTS.map((point) => (
              <li key={point} className="flex gap-3">
                <CheckCircle2Icon
                  className="mt-0.5 size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </details>

        <Link
          href="/"
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-black text-primary-foreground focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          Open Scout
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </main>
  )
}
