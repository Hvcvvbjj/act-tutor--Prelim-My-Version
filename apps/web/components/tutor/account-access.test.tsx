import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { GUEST_VIEWER } from "@/lib/auth-types"

import { AccountAccess } from "./account-access"

describe("account access mobile labels", () => {
  it("keeps the complete accessible name while showing a compact guest label", () => {
    const markup = renderToStaticMarkup(
      <AccountAccess
        viewer={GUEST_VIEWER}
        savedPlan={null}
        onViewerChange={() => undefined}
        showCompactLabelOnMobile
      />
    )

    expect(markup).toContain('aria-label="Sign in / save progress"')
    expect(markup).toContain('<span class="truncate sm:hidden">Save</span>')
    expect(markup).toContain(
      '<span class="hidden truncate sm:inline">Sign in / save progress</span>'
    )
  })

  it("uses an account label without replacing the learner's accessible name", () => {
    const markup = renderToStaticMarkup(
      <AccountAccess
        viewer={{
          ...GUEST_VIEWER,
          authenticated: true,
          role: "learner",
          username: "alex-studies",
          displayName: "Alex",
        }}
        savedPlan={null}
        onViewerChange={() => undefined}
        showCompactLabelOnMobile
      />
    )

    expect(markup).toContain('aria-label="Alex"')
    expect(markup).toContain('<span class="truncate sm:hidden">Account</span>')
    expect(markup).toContain(
      '<span class="hidden truncate sm:inline">Alex</span>'
    )
  })
})
