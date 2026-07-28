import { describe, expect, it } from "vitest"

import { spotlightRect } from "./dashboard-tour-geometry"

const viewport = { width: 1440, height: 900 }

describe("dashboard tour spotlight geometry", () => {
  it("adds even padding around a target away from viewport edges", () => {
    expect(
      spotlightRect(
        {
          top: 200,
          left: 320,
          right: 520,
          bottom: 244,
          width: 200,
          height: 44,
        },
        viewport
      )
    ).toEqual({
      top: 192,
      left: 312,
      right: 528,
      bottom: 252,
      width: 216,
      height: 60,
    })
  })

  it("reduces vertical padding evenly near the top edge", () => {
    const result = spotlightRect(
      {
        top: 10,
        left: 320,
        right: 520,
        bottom: 54,
        width: 200,
        height: 44,
      },
      viewport
    )

    expect(result).toMatchObject({ top: 6, bottom: 58 })
    expect(((result?.top ?? 0) + (result?.bottom ?? 0)) / 2).toBe(32)
  })

  it("reduces horizontal padding evenly near the right edge", () => {
    const result = spotlightRect(
      {
        top: 120,
        left: 1310,
        right: 1430,
        bottom: 164,
        width: 120,
        height: 44,
      },
      viewport
    )

    expect(result).toMatchObject({ left: 1306, right: 1434 })
    expect(((result?.left ?? 0) + (result?.right ?? 0)) / 2).toBe(1370)
  })

  it("does not draw a false spotlight for a hidden target", () => {
    expect(
      spotlightRect(
        {
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
        },
        viewport
      )
    ).toBeNull()
  })
})
