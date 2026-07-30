import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import Loading from "./loading"

describe("route loading state", () => {
  it("keeps the first app response branded, honest, and accessible", () => {
    const markup = renderToStaticMarkup(<Loading />)

    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain("Getting your study space ready.")
    expect(markup).toContain(
      "AlexACT is checking for a saved plan and preparing the right starting screen."
    )
    expect(markup).toContain(
      "Your results stay labeled as official, practice, or planning estimates."
    )
    expect(markup).toContain("scout-icon-192.png")
  })
})
