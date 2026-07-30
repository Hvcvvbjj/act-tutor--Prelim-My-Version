import { describe, expect, it } from "vitest"

import {
  spotlightRect,
  tourDialogPlacement,
} from "./dashboard-tour-geometry"

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
      top: 196,
      left: 316,
      right: 524,
      bottom: 248,
      width: 208,
      height: 52,
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

  it("puts the dialog to the left of a right-rail action", () => {
    expect(
      tourDialogPlacement(
        {
          top: 412,
          left: 934,
          right: 1220,
          bottom: 464,
          width: 286,
          height: 52,
        },
        { width: 1265, height: 720 },
        { width: 420, height: 244 }
      )
    ).toEqual({
      top: 316,
      left: 496,
      width: 420,
      side: "left",
    })
  })

  it("keeps top-navigation dialogs below their highlighted control", () => {
    expect(
      tourDialogPlacement(
        {
          top: 12,
          left: 980,
          right: 1024,
          bottom: 56,
          width: 44,
          height: 44,
        },
        { width: 1265, height: 720 },
        { width: 420, height: 244 }
      )
    ).toEqual({
      top: 74,
      left: 792,
      width: 420,
      side: "below",
    })
  })
})
