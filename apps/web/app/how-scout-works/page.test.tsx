import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import HowScoutWorksPage, { metadata } from "./page"

describe("How Scout works", () => {
  it("explains the learner loop and model boundaries in plain English", () => {
    const markup = renderToStaticMarkup(<HowScoutWorksPage />)

    expect(markup).toContain("One answer becomes evidence—not a guess.")
    expect(markup).toContain("Answer → evidence → next action")
    expect(markup).toContain("IRT · question picker")
    expect(markup).toContain("BKT · learning estimate")
    expect(markup).toContain("AI · explanation")
    expect(markup).toContain("A Quick Check is not the full diagnostic.")
    expect(markup).toContain("Try the one-answer adaptive demo.")
    expect(markup).toContain('href="/trust"')
  })

  it("publishes route-specific metadata", () => {
    expect(metadata).toMatchObject({
      title: "How Scout Works",
      alternates: {
        canonical: "/how-scout-works",
      },
    })
  })
})
