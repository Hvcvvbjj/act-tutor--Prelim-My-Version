import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import TrustPage, { metadata } from "./page"

describe("trust center", () => {
  it("explains storage, learner control, AI boundaries, and product limits", () => {
    const markup = renderToStaticMarkup(<TrustPage />)

    expect(markup).toContain("What AlexACT saves—and what it does not.")
    expect(markup).toContain("Guest progress")
    expect(markup).toContain("Account progress")
    expect(markup).toContain("Settings → Data &amp; privacy")
    expect(markup).toContain("Email and phone details are optional")
    expect(markup).toContain("AI may explain. Evidence makes the decision.")
    expect(markup).toContain("Optional free cloud enhancement")
    expect(markup).toContain("accept a Puter sign-in")
    expect(markup).toContain("your question or reward prompt")
    expect(markup).toContain("a short recent Mr. Kim conversation history")
    expect(markup).toContain("The on-device option stays on your device.")
    expect(markup).toContain("separate server path")
    expect(markup).toContain("not an official score report")
    expect(markup).toContain("See how scoring, evidence, and planning connect")
    expect(markup).toContain('href="/how-scout-works"')
    expect(markup).toContain('href="/"')
  })

  it("publishes route-specific metadata", () => {
    expect(metadata).toMatchObject({
      title: "Data, Privacy, and Limits",
      alternates: {
        canonical: "/trust",
      },
    })
  })
})
