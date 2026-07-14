"use client"

import { useState } from "react"

import type { ScoutOperationsLabProps } from "@/components/tutor/scout-operations/types"
import { Button } from "@/components/ui/button"

const ACT_SECTIONS = [
  { id: "english", label: "English", questions: 50, minutes: 35 },
  { id: "math", label: "Math", questions: 45, minutes: 50 },
  { id: "reading", label: "Reading", questions: 36, minutes: 40 },
] as const

export function ActStrategyView({ plan, learning }: Pick<ScoutOperationsLabProps, "plan" | "learning">) {
  const [goal, setGoal] = useState<"accuracy" | "speed" | "both">("both")
  const baseline = plan.evidence.planningBaseline ?? {
    english: plan.currentComposite,
    math: plan.currentComposite,
    reading: plan.currentComposite,
  }
  const [sectionScores, setSectionScores] = useState({
    english: baseline.english,
    math: baseline.math,
    reading: baseline.reading,
  })
  const [strategyChoice, setStrategyChoice] = useState<"answer" | "skip" | "flag" | "return">("flag")
  const simulatedComposite = Math.round(
    (sectionScores.english + sectionScores.math + sectionScores.reading) / 3
  )

  return (
    <div className="space-y-12">
      <section>
        <p className="ink-label text-primary">Current enhanced ACT format</p>
        <h2 className="mt-2 font-heading text-4xl font-black">Train to the real clock.</h2>
        <div className="mt-6 overflow-x-auto border-y-2 border-foreground">
          <table className="w-full min-w-[38rem] text-left">
            <thead className="bg-foreground text-background">
              <tr><th className="px-4 py-3">Section</th><th className="px-4 py-3">Questions</th><th className="px-4 py-3">Minutes</th><th className="px-4 py-3">Average pace</th></tr>
            </thead>
            <tbody className="divide-y">
              {ACT_SECTIONS.map((section) => (
                <tr key={section.id}>
                  <td className="px-4 py-3 font-bold">{section.label}</td>
                  <td className="px-4 py-3">{section.questions}</td>
                  <td className="px-4 py-3">{section.minutes}</td>
                  <td className="px-4 py-3">{Math.round((section.minutes * 60) / section.questions)} sec/question</td>
                </tr>
              ))}
              <tr>
                <td className="px-4 py-3 font-bold">Science <span className="text-xs text-muted-foreground">optional</span></td>
                <td className="px-4 py-3">40</td>
                <td className="px-4 py-3">40</td>
                <td className="px-4 py-3">60 sec/question</td>
              </tr>
            </tbody>
          </table>
        </div>
        <a className="mt-3 inline-block text-sm font-semibold text-primary underline" href="https://www.act.org/content/act/en/products-and-services/the-act/test-preparation/act-exam-sections-and-structure.html" target="_blank" rel="noreferrer">
          Official ACT section structure
        </a>
        <details className="mt-5 border-y-2 border-foreground py-4">
          <summary className="cursor-pointer font-bold">Show the official content blueprint</summary>
          <div className="mt-4 grid gap-5 text-sm leading-6 md:grid-cols-3">
            <div><p className="font-bold">English</p><p>Production of Writing 38–43% · Knowledge of Language 18–23% · Standard English conventions 38–43%.</p></div>
            <div><p className="font-bold">Math</p><p>Preparing for Higher Math 80% · Integrating Essential Skills 20% · Modeling appears throughout.</p></div>
            <div><p className="font-bold">Reading</p><p>Key Ideas and Details 44–52% · Craft and Structure 26–33% · Integration of Knowledge and Ideas 19–26%.</p></div>
          </div>
        </details>
      </section>

      <section className="grid border-y-2 border-foreground lg:grid-cols-2 lg:divide-x-2 lg:divide-foreground">
        <div className="py-7 lg:pr-8">
          <p className="ink-label text-primary">Pacing coach</p>
          <h2 className="mt-2 font-heading text-3xl font-black">What are we training?</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["accuracy", "speed", "both"] as const).map((value) => (
              <Button key={value} type="button" size="sm" variant={goal === value ? "secondary" : "outline"} onClick={() => setGoal(value)} className="capitalize">{value}</Button>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {goal === "accuracy"
              ? "Work untimed until the rule is reliable. Scout will not rush an unlearned skill."
              : goal === "speed"
                ? "Use short sets at standard pace. A slow correct answer stays correct; speed never lowers mastery."
                : "Keep accuracy first, then shorten the clock in small steps."}
          </p>
        </div>
        <div className="py-7 lg:pl-8">
          <p className="ink-label text-muted-foreground">Time-pressure ramp</p>
          <ol className="mt-4 divide-y border-y text-sm">
            <li className="py-3"><strong>1. Learn:</strong> untimed, explain the rule.</li>
            <li className="py-3"><strong>2. Controlled:</strong> standard time + 25%.</li>
            <li className="py-3"><strong>3. Test pace:</strong> official section timing.</li>
            <li className="py-3"><strong>4. Pressure finish:</strong> last five questions at target pace.</li>
          </ol>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <p className="ink-label text-primary">Section strategy trainer</p>
          <h2 className="mt-2 font-heading text-3xl font-black">A question has taken too long. What now?</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["answer", "skip", "flag", "return"] as const).map((value) => (
              <Button key={value} type="button" size="sm" variant={strategyChoice === value ? "secondary" : "outline"} onClick={() => setStrategyChoice(value)} className="capitalize">{value}</Button>
            ))}
          </div>
          <div className="mt-5 border-l-4 border-primary bg-[var(--info-surface)] p-5 text-sm leading-6">
            {strategyChoice === "flag"
              ? "Good first move: choose your best answer, flag it, and protect time for questions you can still earn. Return only after the section is complete."
              : strategyChoice === "skip"
                ? "Do not leave it blank. The ACT has no wrong-answer penalty; make a best guess before moving."
                : strategyChoice === "return"
                  ? "Return is useful only after every question has an answer. Otherwise you may trade several reachable points for one hard item."
                  : "Answer now only if you have a clear method. If you are stuck, guess, flag, and keep the section moving."}
          </div>
        </div>
        <div>
          <p className="ink-label text-muted-foreground">What Scout will not claim</p>
          <h3 className="mt-2 font-heading text-3xl font-black">Practice skill estimates are not score predictions.</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Short skill sets can guide the next lesson, but they do not support a defensible 1–36 ACT prediction. Use a timed reviewed form to measure timed performance.
          </p>
        </div>
      </section>

      <section>
        <p className="ink-label text-primary">Target-score simulator</p>
        <h2 className="mt-2 font-heading text-4xl font-black">See the composite tradeoff.</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          {ACT_SECTIONS.map((section) => (
            <label key={section.id} className="border-t-2 border-foreground pt-4 text-sm font-bold">
              {section.label}
              <input
                type="number"
                min={1}
                max={36}
                value={sectionScores[section.id]}
                onChange={(event) => setSectionScores((current) => ({ ...current, [section.id]: Math.max(1, Math.min(36, Number(event.target.value))) }))}
                className="mt-2 block h-12 w-full border-2 border-foreground bg-background px-3 font-heading text-2xl font-black"
              />
            </label>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-5 border-y-2 border-foreground py-5">
          <div>
            <p className="ink-label text-muted-foreground">Simulated composite</p>
            <p className="mt-1 font-heading text-6xl font-black text-primary">{simulatedComposite}</p>
          </div>
          <div className="max-w-xl">
            <p className="font-bold">Manual score scenario</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              This only averages the three scores you entered. It does not predict readiness or decide whether you will reach {plan.draft.goal}.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y-2 border-foreground py-6">
        <p className="ink-label text-primary">Parallel forms and exposure protection</p>
        <p className="mt-3 text-sm leading-6">
          Scout chooses the least-exposed reviewed item for repair, retention,
          challenge, and recovery sets. {learning.trustReport.exposure.filter((item) => item.protected).length} question(s) are currently marked high-exposure and are held back when an alternative exists.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Current bank: reviewed alternate forms. Scout does not claim a fresh form when every available item has already been seen.
        </p>
      </section>
    </div>
  )
}
