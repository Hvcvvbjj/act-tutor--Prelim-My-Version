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
  it("keeps prior scores optional and identifies the diagnostic as original practice", async () => {
    const onboarding = await compactSource("./onboarding.tsx")
    const diagnostic = await compactSource("./diagnostic-intro.tsx")

    expect(onboarding).toContain(
      "Share a recent score if you have one, then take Scout&apos;s full 66-question diagnostic."
    )
    expect(diagnostic).toContain(
      "66 original practice questions—not official ACT items—across English, Math, and Reading"
    )
  })
})
