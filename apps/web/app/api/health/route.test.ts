import { describe, expect, it } from "vitest"

import { createHealthPayload } from "./health-payload"
import { GET } from "./route"

describe("GET /api/health", () => {
  it("reports liveness and the build-frozen release", async () => {
    const response = GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(await response.json()).toEqual(
      createHealthPayload(process.env.SCOUT_BUILD_COMMIT)
    )
  })

  it("uses a safe development label when no release is available", () => {
    expect(createHealthPayload()).toEqual({
      status: "ok",
      service: "AlexACT",
      release: "development",
    })
  })
})
