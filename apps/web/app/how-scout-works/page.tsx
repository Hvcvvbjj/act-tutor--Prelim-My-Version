import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
} from "lucide-react"

export const metadata: Metadata = {
  title: "How AlexACT Works",
  description:
    "See how AlexACT turns a scored answer into learning evidence and the next ACT study action.",
  alternates: {
    canonical: "/how-scout-works",
  },
}

const STEPS = [
  {
    label: "Score the answer",
    copy: "AlexACT checks original practice against a reviewed answer key. The AI tutor cannot change the score.",
  },
  {
    label: "Update one skill",
    copy: "The result updates the matching skill estimate. AlexACT keeps limited evidence and uncertainty visible.",
  },
  {
    label: "Guide later rounds",
    copy: "AlexACT weighs that evidence with your goal, test date, and study time before setting later-round priorities.",
  },
] as const

const PROOF_POINTS = [
  "The estimate before and after a scored answer.",
  "How many answers support the estimate.",
  "Why the next skill changed—or why it stayed the same.",
  "Whether AlexACT used a generated explanation or its reviewed fallback.",
] as const

const DEMONSTRATED_BOUNDARIES = [
  "Reviewed answer keys—not generated prose—decide whether original practice is correct.",
  "A scored answer updates the matching skill estimate, evidence count, and uncertainty.",
  "Stored evidence, goals, test date, and study time shape later-round priorities.",
  "Reviewed teaching remains available when an AI explanation is unavailable.",
] as const

const CLAIM_BOUNDARIES = [
  "An official ACT score, ACT-equated prediction, or licensed ACT practice form.",
  "Guaranteed score improvement or proof that a learner will reach a target.",
  "Independent psychometric validation, fairness certification, or school approval.",
  "A replacement for a teacher, counselor, or official ACT resources.",
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
          Back to AlexACT
        </Link>

        <header className="mt-8 border-b-2 border-foreground pb-9 sm:mt-10 sm:pb-12">
          <p className="ink-label text-primary">How AlexACT works</p>
          <h1 className="mt-4 max-w-4xl font-heading text-4xl leading-[1.03] font-black tracking-[-0.035em] sm:text-6xl">
            AlexACT uses scored answers to guide what comes after Round 1.
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

        <section
          className="border-b-2 border-foreground py-9 sm:py-12"
          aria-labelledby="proof-boundary-title"
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.55fr)] lg:items-end">
            <div>
              <p className="ink-label text-primary">Proof boundary</p>
              <h2
                id="proof-boundary-title"
                className="mt-3 max-w-2xl font-heading text-3xl font-black tracking-[-0.025em] sm:text-4xl"
              >
                A demo should prove behavior—not promise an outcome.
              </h2>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Each claim below maps to behavior a reviewer can reproduce.
              Longer-term results need real learner studies, so AlexACT does not
              present them as finished evidence.
            </p>
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-2">
            <article className="rounded-xl border-2 border-foreground bg-[#10243d] p-5 text-[#f7fbff] shadow-[5px_5px_0_var(--foreground)] sm:p-6">
              <p className="font-mono text-xs font-black tracking-[0.12em] text-[var(--scout-sun)] uppercase">
                Demonstrates
              </p>
              <h3 className="mt-3 font-heading text-2xl font-black">
                What this demo demonstrates
              </h3>
              <ul className="mt-5 space-y-4 text-sm leading-6 text-white/75">
                {DEMONSTRATED_BOUNDARIES.map((boundary) => (
                  <li key={boundary} className="flex gap-3">
                    <CheckCircle2Icon
                      className="mt-0.5 size-5 shrink-0 text-[var(--scout-sun)]"
                      aria-hidden="true"
                    />
                    <span>{boundary}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-xl border-2 border-foreground bg-[var(--info-surface)] p-5 sm:p-6">
              <p className="font-mono text-xs font-black tracking-[0.12em] text-primary uppercase">
                Does not claim
              </p>
              <h3 className="mt-3 font-heading text-2xl font-black">
                What AlexACT does not claim
              </h3>
              <ul className="mt-5 space-y-4 text-sm leading-6 text-muted-foreground">
                {CLAIM_BOUNDARIES.map((boundary) => (
                  <li key={boundary} className="flex gap-3">
                    <span
                      className="font-mono text-sm font-black text-primary"
                      aria-hidden="true"
                    >
                      —
                    </span>
                    <span>{boundary}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/trust"
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-black text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                Read data, AI, and product limits
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
            </article>
          </div>
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
          Open AlexACT
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </main>
  )
}
