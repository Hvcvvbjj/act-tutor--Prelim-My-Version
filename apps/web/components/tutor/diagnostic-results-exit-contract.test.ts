import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

async function diagnosticRunnerSource() {
  return readFile(
    fileURLToPath(new URL("./diagnostic-runner.tsx", import.meta.url)),
    "utf8"
  )
}

describe("completed diagnostic result controls", () => {
  it("does not send a completed result back to the diagnostic introduction", async () => {
    const source = await diagnosticRunnerSource()

    expect(source).toContain('phase === "results" ? null')
    expect(source).toContain("Save and exit")
  })
})
