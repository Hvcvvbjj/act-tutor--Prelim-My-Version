import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import ErrorPage from "./error"
import GlobalError from "./global-error"
import NotFound from "./not-found"

describe("recovery pages", () => {
  it("offers a retry without exposing the original error message", () => {
    const error = Object.assign(new Error("private database detail"), {
      digest: "scout-123",
    })
    const markup = renderToStaticMarkup(
      <ErrorPage error={error} unstable_retry={() => undefined} />
    )

    expect(markup).toContain("Scout hit a snag.")
    expect(markup).toContain("Try again")
    expect(markup).toContain("Return to Scout home")
    expect(markup).toContain("scout-123")
    expect(markup).not.toContain("private database detail")
  })

  it("turns an unknown route into a clear path home", () => {
    const markup = renderToStaticMarkup(<NotFound />)

    expect(markup).toContain("Scout can’t find that page.")
    expect(markup).toContain('href="/"')
    expect(markup).toContain("Return to Scout home")
  })

  it("keeps a self-contained fallback for root-layout failures", () => {
    const markup = renderToStaticMarkup(
      <GlobalError
        error={new Error("layout failed")}
        unstable_retry={() => undefined}
      />
    )

    expect(markup).toContain("<html")
    expect(markup).toContain("<body")
    expect(markup).toContain("Scout needs a fresh start.")
    expect(markup).toContain("Try again")
  })
})
