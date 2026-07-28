import { describe, expect, it } from "vitest"

import nextConfig, { BUILD_COMMIT, SECURITY_HEADERS } from "./next.config"

describe("public response security", () => {
  it("applies a compatible browser security policy to every route", async () => {
    const configuredHeaders = await nextConfig.headers?.()

    expect(configuredHeaders).toEqual([
      {
        source: "/:path*",
        headers: [...SECURITY_HEADERS],
      },
    ])

    const headers = Object.fromEntries(
      SECURITY_HEADERS.map(({ key, value }) => [key, value])
    )
    expect(headers["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'"
    )
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'")
    expect(headers["Content-Security-Policy"]).toContain(
      "upgrade-insecure-requests"
    )
    expect(headers["Permissions-Policy"]).toContain("camera=()")
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin")
    expect(headers["Strict-Transport-Security"]).toContain("max-age=31536000")
    expect(headers["X-Content-Type-Options"]).toBe("nosniff")
    expect(headers["X-Frame-Options"]).toBe("DENY")
    expect(headers["X-Scout-Release"]).toBe(BUILD_COMMIT)
  })

  it("does not advertise the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false)
  })

  it("freezes the source commit into the build and build identifier", async () => {
    expect(BUILD_COMMIT).toMatch(/^(?:[0-9a-f]{40}|development)$/)
    expect(nextConfig.env?.SCOUT_BUILD_COMMIT).toBe(BUILD_COMMIT)
    await expect(nextConfig.generateBuildId?.()).resolves.toBe(BUILD_COMMIT)
  })
})
