"use client"

import type { ScoutOperationsLabProps } from "@/components/tutor/scout-operations/types"

const ACT_SECTIONS = [
  { id: "english", label: "English", questions: 50, minutes: 35 },
  { id: "math", label: "Math", questions: 45, minutes: 50 },
  { id: "reading", label: "Reading", questions: 36, minutes: 40 },
] as const

export function ActStrategyView({
  plan,
}: Pick<ScoutOperationsLabProps, "plan">) {
  return (
    <div className="mx-auto max-w-4xl">
      <section>
        <p className="ink-label text-primary">ACT timing reference</p>
        <h2 className="mt-2 max-w-3xl font-heading text-4xl font-black">
          Learn the method first. Add the clock in steps.
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
          These are the official section clocks Scout uses when preparing timed
          practice toward your goal of {plan.draft.goal}. A slow correct answer
          is still useful while you are learning.
        </p>

        <div className="mt-7 overflow-x-auto border-y-2 border-foreground">
          <table className="w-full min-w-[38rem] text-left">
            <thead className="bg-foreground text-background">
              <tr>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Questions</th>
                <th className="px-4 py-3">Minutes</th>
                <th className="px-4 py-3">Average pace</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ACT_SECTIONS.map((section) => (
                <tr key={section.id}>
                  <td className="px-4 py-3 font-bold">{section.label}</td>
                  <td className="px-4 py-3">{section.questions}</td>
                  <td className="px-4 py-3">{section.minutes}</td>
                  <td className="px-4 py-3">
                    {Math.round((section.minutes * 60) / section.questions)}{" "}
                    sec/question
                  </td>
                </tr>
              ))}
              <tr>
                <td className="px-4 py-3 font-bold">
                  Science{" "}
                  <span className="text-xs text-muted-foreground">
                    optional
                  </span>
                </td>
                <td className="px-4 py-3">40</td>
                <td className="px-4 py-3">40</td>
                <td className="px-4 py-3">60 sec/question</td>
              </tr>
            </tbody>
          </table>
        </div>
        <a
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline"
          href="https://www.act.org/content/act/en/products-and-services/the-act/test-preparation/act-exam-sections-and-structure.html"
          target="_blank"
          rel="noreferrer"
        >
          Check the official ACT section structure
        </a>
      </section>

      <section className="mt-9 grid gap-8 border-y-2 border-foreground py-7 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)]">
        <div>
          <p className="ink-label text-primary">A simple pacing ladder</p>
          <ol className="mt-4 divide-y border-y text-sm leading-6">
            <li className="py-3">
              <strong>1. Learn:</strong> work without a timer until the steps
              make sense.
            </li>
            <li className="py-3">
              <strong>2. Controlled:</strong> use the standard time plus 25%.
            </li>
            <li className="py-3">
              <strong>3. Test pace:</strong> use the official section clock.
            </li>
          </ol>
        </div>
        <div className="border-l-4 border-primary bg-[var(--info-surface)] p-5">
          <p className="font-heading text-2xl font-black">
            If one question takes too long
          </p>
          <p className="mt-3 text-sm leading-6">
            Choose your best answer, flag it, and move on. Return only after
            every question has an answer.
          </p>
        </div>
      </section>
    </div>
  )
}
