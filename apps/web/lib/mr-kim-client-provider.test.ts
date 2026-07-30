import { describe, expect, it } from "vitest"

import { chooseMrKimClientProvider } from "./mr-kim-client-provider"

describe("Mr. Kim client provider selection", () => {
  it("keeps reviewed help available while optional AI is still loading", () => {
    expect(
      chooseMrKimClientProvider({
        serverAiAvailable: false,
        onDeviceStatus: "checking",
        freeCloudStatus: "loading",
      })
    ).toEqual({ askBlocked: false, provider: "none" })

    expect(
      chooseMrKimClientProvider({
        serverAiAvailable: false,
        onDeviceStatus: "unavailable",
        freeCloudStatus: "ready",
      })
    ).toEqual({ askBlocked: false, provider: "free-cloud" })
  })

  it("keeps reviewed help available while a cloud connection is pending", () => {
    expect(
      chooseMrKimClientProvider({
        serverAiAvailable: false,
        onDeviceStatus: "unavailable",
        freeCloudStatus: "connecting",
      })
    ).toEqual({ askBlocked: false, provider: "none" })
  })

  it("uses ready free cloud AI instead of waiting for a Chrome model download", () => {
    expect(
      chooseMrKimClientProvider({
        serverAiAvailable: false,
        onDeviceStatus: "downloadable",
        freeCloudStatus: "ready",
      })
    ).toEqual({ askBlocked: false, provider: "free-cloud" })
  })

  it("prefers an already-downloaded on-device model and keeps reviewed fallback available", () => {
    expect(
      chooseMrKimClientProvider({
        serverAiAvailable: false,
        onDeviceStatus: "available",
        freeCloudStatus: "ready",
      })
    ).toEqual({ askBlocked: false, provider: "on-device" })

    expect(
      chooseMrKimClientProvider({
        serverAiAvailable: false,
        onDeviceStatus: "unavailable",
        freeCloudStatus: "unavailable",
      })
    ).toEqual({ askBlocked: false, provider: "none" })
  })
})
