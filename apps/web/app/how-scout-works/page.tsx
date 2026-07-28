import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  MessageSquareTextIcon,
  RouteIcon,
  ScanSearchIcon,
} from "lucide-react"

export const metadata: Metadata = {
  title: "How Scout Works",
  description:
    "See how Scout turns a scored answer into learning evidence, a skill estimate, and the next ACT study action.",
  alternates: {
    canonical: "/how-scout-works",
  },
}

const PROOF_POINTS = [
  "The estimate before and after a scored answer.",
  "How much evidence Scout has and how uncertain the estimate remains.",
  "Why the next skill changed—or why Scout deliberately kept it.",
  "Whether an explanation was generated or used the reviewed fallback.",
]

export default function HowScoutWorksPage() {
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

        <header className="mt-8 grid gap-8 border-b-2 border-foreground pb-9 sm:mt-10 sm:pb-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)] lg:items-end">
          <div>
            <div className="flex items-center gap-3 text-primary">
              <RouteIcon className="size-6" aria-hidden="true" />
              <p className="ink-label">How Scout works</p>
            </div>
            <h1 className="mt-4 max-w-4xl font-heading text-4xl leading-[1.02] font-black tracking-[-0.04em] sm:text-6xl">
              One answer becomes evidence—not a guess.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              Scout separates scoring, learning estimates, planning, and AI
              explanation. That separation lets a learner see what changed, what
              stayed uncertain, and why the next lesson earned its place.
            </p>
          </div>

          <aside className="rounded-2xl border-2 border-foreground bg-[var(--scout-sun-soft)] p-5 shadow-[6px_6px_0_var(--foreground)]">
            <p className="font-mono text-xs font-black tracking-[0.12em] uppercase">
              The product promise
            </p>
            <p className="mt-3 font-heading text-2xl leading-tight font-black">
              Every question earns its place. Every answer teaches the plan.
            </p>
          </aside>
        </header>

        <section
          className="border-b-2 border-foreground py-9 sm:py-12"
          aria-labelledby="learning-loop-title"
        >
          <p className="ink-label text-primary">The learning loop</p>
          <h2
            id="learning-loop-title"
            className="mt-3 max-w-3xl font-heading text-3xl font-black tracking-[-0.025em] sm:text-4xl"
          >
            Answer → evidence → next action
          </h2>

          <ol className="mt-8 grid gap-6 lg:grid-cols-3">
            <li className="border-t-2 border-foreground pt-5">
              <div className="flex items-center justify-between gap-4">
                <p className="ink-label text-primary">01 · Answer</p>
                <CheckCircle2Icon
                  className="size-6 text-primary"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-4 font-heading text-2xl font-black">
                Trusted scoring comes first.
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Scout scores original practice on the server. The AI tutor
                cannot invent an answer key, award mastery, or change a score.
              </p>
            </li>

            <li className="border-t-2 border-foreground pt-5">
              <div className="flex items-center justify-between gap-4">
                <p className="ink-label text-primary">02 · Evidence</p>
                <ScanSearchIcon
                  className="size-6 text-primary"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-4 font-heading text-2xl font-black">
                The learner estimate updates.
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Correctness, skill, question difficulty, and prior evidence
                update a skill estimate. Scout also keeps uncertainty visible
                instead of turning one answer into false confidence.
              </p>
            </li>

            <li className="border-t-2 border-foreground pt-5">
              <div className="flex items-center justify-between gap-4">
                <p className="ink-label text-primary">03 · Next action</p>
                <ArrowRightIcon
                  className="size-6 text-primary"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-4 font-heading text-2xl font-black">
                The plan responds carefully.
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The planner weighs the learner’s gap, uncertainty, test date,
                and available time. It can change the next lesson—or hold the
                plan steady when the evidence is not strong enough.
              </p>
            </li>
          </ol>
        </section>

        <section
          className="py-9 sm:py-12"
          aria-labelledby="model-handoff-title"
        >
          <p className="ink-label text-primary">The model handoff</p>
          <h2
            id="model-handoff-title"
            className="mt-3 max-w-3xl font-heading text-3xl font-black tracking-[-0.025em] sm:text-4xl"
          >
            Three jobs, with clear boundaries.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            Scout uses different systems for different decisions. In regular
            English: one chooses useful questions, one tracks learning, and one
            turns reviewed material into a clearer explanation.
          </p>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <article className="rounded-2xl border-2 border-foreground bg-background p-6">
              <ScanSearchIcon
                className="size-7 text-primary"
                aria-hidden="true"
              />
              <p className="mt-5 font-mono text-xs font-black tracking-[0.12em] text-primary uppercase">
                IRT · question picker
              </p>
              <h3 className="mt-2 font-heading text-2xl font-black">
                What should Scout ask next?
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                During Quick Check, question-selection math looks for useful new
                evidence while covering English, Math, and Reading. It stops
                between 8 and 12 questions, never after a single lucky answer.
              </p>
            </article>

            <article className="rounded-2xl border-2 border-foreground bg-background p-6">
              <BrainCircuitIcon
                className="size-7 text-primary"
                aria-hidden="true"
              />
              <p className="mt-5 font-mono text-xs font-black tracking-[0.12em] text-primary uppercase">
                BKT · learning estimate
              </p>
              <h3 className="mt-2 font-heading text-2xl font-black">
                What is ready to learn next?
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Learning-estimate math tracks each skill separately. It allows
                for guessing, slips, practice, and limited evidence, then feeds
                that honest estimate to the planner.
              </p>
            </article>

            <article className="rounded-2xl border-2 border-foreground bg-background p-6">
              <MessageSquareTextIcon
                className="size-7 text-primary"
                aria-hidden="true"
              />
              <p className="mt-5 font-mono text-xs font-black tracking-[0.12em] text-primary uppercase">
                AI · explanation
              </p>
              <h3 className="mt-2 font-heading text-2xl font-black">
                How should Scout explain it?
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Generative AI can change teaching style and compose a lesson
                from reviewed content and learner evidence. If generation is
                unavailable or fails a check, Scout uses a reviewed fallback.
              </p>
            </article>
          </div>
        </section>

        <section className="grid gap-8 border-y-2 border-foreground py-9 sm:py-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <p className="ink-label text-primary">Two starting paths</p>
            <h2 className="mt-3 font-heading text-3xl font-black">
              A Quick Check is not the full diagnostic.
            </h2>
            <div className="mt-6 space-y-5 text-sm leading-6 text-muted-foreground">
              <p>
                <strong className="text-foreground">Quick Check</strong> asks
                8–12 adaptive questions to refine a starting point quickly and
                choose the first lesson.
              </p>
              <p>
                <strong className="text-foreground">The full diagnostic</strong>{" "}
                uses 66 original English, Math, and Reading questions when a
                learner wants a broader baseline.
              </p>
              <p>
                Neither is an official ACT form. Both create study evidence, not
                an official score report.
              </p>
            </div>
          </div>

          <div className="border-t-2 border-foreground pt-7 lg:border-t-0 lg:border-l-2 lg:pt-0 lg:pl-8">
            <p className="ink-label text-primary">Inspectable proof</p>
            <h2 className="mt-3 font-heading text-3xl font-black">
              You do not have to trust a magic “adaptive” label.
            </h2>
            <ul className="mt-6 space-y-4 text-sm leading-6 text-muted-foreground">
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
          </div>
        </section>

        <section className="mt-10 rounded-2xl border-2 border-foreground bg-[#10243d] p-6 text-[#f7fbff] shadow-[8px_8px_0_var(--foreground)] sm:p-8">
          <p className="font-mono text-xs font-black tracking-[0.12em] text-[var(--scout-sun)] uppercase">
            See it move
          </p>
          <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <h2 className="font-heading text-3xl font-black">
                Try the one-answer adaptive demo.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
                On Scout’s welcome screen, choose “See one answer change the
                plan.” It loads a clearly labeled sample learner on the final
                Quick Check question so the evidence update is immediate.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--scout-sun)] px-5 text-sm font-black text-[#10243d] transition-transform hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-white/40 focus-visible:outline-none motion-reduce:transition-none"
            >
              Open Scout
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <div className="mt-10 flex flex-col items-start gap-3 border-t pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Want the storage, privacy, and product-limit details too?
          </p>
          <Link
            href="/trust"
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-1 text-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            Read the trust center
          </Link>
        </div>
      </div>
    </main>
  )
}
