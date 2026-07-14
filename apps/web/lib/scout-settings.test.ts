import { beforeEach, describe, expect, it } from "vitest"

import {
  DEFAULT_ACCOMMODATIONS,
  readScoutSettings,
  SCOUT_SETTINGS_KEY,
  updateScoutAccommodations,
  updateScoutExplanation,
} from "./scout-settings"

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: new MemoryStorage() },
  })
})

describe("versioned Scout settings", () => {
  it("migrates both legacy preference keys without dropping either side", () => {
    window.localStorage.setItem(
      "scout-explanation-preferences-v1",
      JSON.stringify({ readingLevel: "plain", exampleStyle: "sports" })
    )
    window.localStorage.setItem(
      "scout-accommodations-v1",
      JSON.stringify({ readAloud: true, reducedMotion: true })
    )

    const settings = readScoutSettings()

    expect(settings).toMatchObject({
      version: 2,
      explanationCustomized: true,
      explanation: { readingLevel: "plain", exampleStyle: "sports" },
      accommodations: { readAloud: true, reducedMotion: true },
    })
    expect(window.localStorage.getItem(SCOUT_SETTINGS_KEY)).not.toBeNull()
    expect(
      window.localStorage.getItem("scout-explanation-preferences-v1")
    ).toBeNull()
  })

  it("updates one preference group without overwriting the other", () => {
    readScoutSettings()
    updateScoutAccommodations({
      ...DEFAULT_ACCOMMODATIONS,
      highContrast: true,
    })
    updateScoutExplanation({
      depth: "detailed",
      readingLevel: "advanced",
      exampleStyle: "gaming",
      fewerTechnicalTerms: false,
    })

    expect(readScoutSettings()).toMatchObject({
      explanationCustomized: true,
      explanation: { depth: "detailed", exampleStyle: "gaming" },
      accommodations: { highContrast: true },
    })
  })
})
