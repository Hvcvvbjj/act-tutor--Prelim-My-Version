import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import AccessibilityPage, { metadata } from "./page"

describe("Accessibility page", () => {
  it("publishes the real study-access controls without claiming formal compliance", () => {
    const markup = renderToStaticMarkup(<AccessibilityPage />)

    expect(markup).toContain("Study tools should adapt to how you work.")
    expect(markup).toContain("8 study-access options")
    expect(markup).toContain("Settings → Study access")
    expect(markup).toContain("Reading and contrast")
    expect(markup).toContain("Motion and focus")
    expect(markup).toContain("Pacing")
    expect(markup).toContain("Teaching style")
    expect(markup).toContain("not a formal WCAG conformance claim")
    expect(markup).toContain("Report an accessibility issue")
    expect(markup).not.toContain("WCAG compliant")
  })

  it("publishes route-specific metadata", () => {
    expect(metadata).toMatchObject({
      title: "Accessibility",
      alternates: {
        canonical: "/accessibility",
      },
    })
  })
})
