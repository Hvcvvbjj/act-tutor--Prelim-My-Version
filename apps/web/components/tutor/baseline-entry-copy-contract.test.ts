import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

async function compactSource(relativePath: string) {
  const source = await readFile(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8"
  )
  return source.replace(/\s+/g, " ")
}

describe("baseline entry copy", () => {
  it("keeps prior scores optional and identifies the diagnostic as original and unofficial", async () => {
    const onboarding = await compactSource("./onboarding.tsx")
    const diagnostic = await compactSource("./diagnostic-intro.tsx")

    expect(onboarding).toContain(
      "Start with a recent score if you have one. Everyone then takes AlexACT&apos;s full 66-question diagnostic"
    )
    expect(onboarding).toContain("Continue to full diagnostic")
    expect(diagnostic).toContain(
      "66 original questions across English, Math, and Reading—not official ACT items."
    )
  })
})
