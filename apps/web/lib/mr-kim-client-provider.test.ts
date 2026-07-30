import { describe, expect, it } from "vitest"

import { chooseMrKimClientProvider } from "./mr-kim-client-provider"

describe("Mr. Kim client provider selection", () => {
  it("blocks an early Ask until the free cloud connection can start from that click", () => {
    expect(
      chooseMrKimClientProvider({
        serverAiAvailable: false,
        onDeviceStatus: "checking",
        freeCloudStatus: "loading",
      })
    ).toEqual({ askBlocked: true, provider: "none" })

    expect(
      chooseMrKimClientProvider({
        serverAiAvailable: false,
        onDeviceStatus: "unavailable",
        freeCloudStatus: "ready",
      })
    ).toEqual({ askBlocked: false, provider: "free-cloud" })
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
