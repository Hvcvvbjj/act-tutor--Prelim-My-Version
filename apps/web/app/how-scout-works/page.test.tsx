import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import HowScoutWorksPage, { metadata } from "./page"

describe("How AlexACT works", () => {
  it("explains the learner loop and model boundaries in plain English", () => {
    const markup = renderToStaticMarkup(<HowScoutWorksPage />)

    expect(markup).toContain(
      "AlexACT uses scored answers to guide what comes after Round 1."
    )
    expect(markup).toContain("One answer, three steps.")
    expect(markup).toContain("IRT · question picker")
    expect(markup).toContain("BKT · learning estimate")
    expect(markup).toContain("AI · explanation")
    expect(markup).toContain(
      "Quick Check and the full diagnostic do different jobs."
    )
    expect(markup).toContain("Round 1 still teaches every question type.")
    expect(markup).toContain(
      "A demo should prove behavior—not promise an outcome."
    )
    expect(markup).toContain("What this demo demonstrates")
    expect(markup).toContain("What AlexACT does not claim")
    expect(markup).toContain(
      "Guaranteed score improvement or proof that a learner will reach a target."
    )
    expect(markup).toContain('href="/trust"')
    expect(markup).not.toContain("update the lesson order")
    expect(markup).toContain("What you can inspect")
    expect(markup).not.toContain("The product promise")
    expect(markup).not.toContain("Try the one-answer adaptive demo.")
  })

  it("publishes route-specific metadata", () => {
    expect(metadata).toMatchObject({
      title: "How AlexACT Works",
      alternates: {
        canonical: "/how-scout-works",
      },
    })
  })
})
