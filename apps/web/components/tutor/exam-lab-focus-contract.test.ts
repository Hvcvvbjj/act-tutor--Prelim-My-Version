import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

async function source(relativePath: string) {
  return readFile(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8")
}

describe("timed practice keyboard handoffs", () => {
  it("focuses and reveals each new question heading", async () => {
    const runner = await source("./exam-lab-runner.tsx")

    expect(runner).toContain("questionHeadingRef.current?.focus")
    expect(runner).toContain("questionHeadingRef.current?.scrollIntoView")
    expect(runner).toContain("ref={questionHeadingRef}")
    expect(runner).toContain("}, [question.id])")
  })

  it("moves focus to the review heading", async () => {
    const review = await source("./exam-lab-review.tsx")

    expect(review).toContain("reviewHeadingRef.current?.focus")
    expect(review).toContain("reviewHeadingRef.current?.scrollIntoView")
    expect(review).toContain("ref={reviewHeadingRef}")
    expect(review).toContain("tabIndex={-1}")
  })

  it("moves focus to the result heading", async () => {
    const report = await source("./exam-lab-report.tsx")

    expect(report).toContain("reportHeadingRef.current?.focus")
    expect(report).toContain("reportHeadingRef.current?.scrollIntoView")
    expect(report).toContain("ref={reportHeadingRef}")
    expect(report).toContain("tabIndex={-1}")
  })
})
