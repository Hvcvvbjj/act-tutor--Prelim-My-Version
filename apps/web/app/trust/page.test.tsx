import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import TrustPage, { metadata } from "./page"

describe("trust center", () => {
  it("explains storage, learner control, AI boundaries, and product limits", () => {
    const markup = renderToStaticMarkup(<TrustPage />)

    expect(markup).toContain("What Scout saves—and what it does not.")
    expect(markup).toContain("Guest progress")
    expect(markup).toContain("Account progress")
    expect(markup).toContain("More → Learning data")
    expect(markup).toContain(
      "Study-data deletion does not delete an account’s sign-in."
    )
    expect(markup).toContain("AI may explain. Evidence makes the decision.")
    expect(markup).toContain("not an official score report")
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
