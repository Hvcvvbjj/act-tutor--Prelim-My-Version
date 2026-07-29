import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

async function resultsViewSource() {
  const source = await readFile(
    fileURLToPath(new URL("./diagnostic-runner.tsx", import.meta.url)),
    "utf8"
  )

  return source.slice(
    source.indexOf("function ResultsView"),
    source.indexOf("export function DiagnosticRunner")
  )
}

describe("completed diagnostic focus", () => {
  it("moves focus to the result heading without moving the viewport", async () => {
    const source = await resultsViewSource()

    expect(source).toContain(
      "headingRef.current?.focus({ preventScroll: true })"
    )
    expect(source).toContain("ref={headingRef}")
    expect(source).toContain("tabIndex={-1}")
  })

  it("keeps the result explanation readable as one complete sentence", async () => {
    const source = await resultsViewSource()

    expect(source).toContain(
      "to build your plan. It isn't an official ACT score or prediction."
    )
  })
})
