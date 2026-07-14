import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { POST } from "./route"

describe("student learning API permissions", () => {
  it.each(["tutor_override", "review_lesson"])(
    "denies the removed %s staff action",
    async (action) => {
      const response = await POST(
        new NextRequest("http://localhost/api/learning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            skill: "linear-equations",
            reason: "forged student request",
            approved: true,
          }),
        })
      )
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: "Unknown learning action.",
      })
    }
  )
})
