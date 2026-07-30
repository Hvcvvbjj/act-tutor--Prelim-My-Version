import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import AccessibilityPage, { metadata } from "./page"

describe("AlexACT accessibility page", () => {
  it("uses the product name in learner-facing access guidance", () => {
    const markup = renderToStaticMarkup(<AccessibilityPage />)

    expect(markup).toContain("Accessibility at AlexACT")
    expect(markup).toContain(
      "AlexACT includes display, focus, pacing, and explanation controls."
    )
    expect(markup).toContain("Open AlexACT")
    expect(markup).toContain("AlexACT is a hackathon project")
  })

  it("publishes accessibility-specific metadata", () => {
    expect(metadata).toMatchObject({
      title: "Accessibility",
      description: expect.stringContaining("AlexACT"),
      alternates: { canonical: "/accessibility" },
    })
  })
})
