import { describe, expect, it } from "vitest"

import {
  isNationalActTestDate,
  NATIONAL_ACT_TEST_DATES,
  nextNationalActTestDate,
  upcomingNationalActTestDateOrNext,
  upcomingNationalActTestDates,
} from "@/lib/act-test-dates"

describe("official national ACT dates", () => {
  it("matches ACT's published 2025-26 and 2026-27 national schedule", () => {
    expect(NATIONAL_ACT_TEST_DATES).toEqual([
      { date: "2026-07-11", label: "July 11, 2026" },
      { date: "2026-09-19", label: "September 19, 2026" },
      { date: "2026-10-17", label: "October 17, 2026" },
      { date: "2026-12-12", label: "December 12, 2026" },
      { date: "2027-02-27", label: "February 27, 2027" },
      { date: "2027-04-10", label: "April 10, 2027" },
      { date: "2027-06-12", label: "June 12, 2027" },
      { date: "2027-07-10", label: "July 10, 2027" },
    ])
  })

  it("uses the next real administration instead of a relative placeholder", () => {
    expect(nextNationalActTestDate("2026-07-29")).toBe("2026-09-19")
    expect(upcomingNationalActTestDates("2026-07-29", 3)).toEqual([
      { date: "2026-09-19", label: "September 19, 2026" },
      { date: "2026-10-17", label: "October 17, 2026" },
      { date: "2026-12-12", label: "December 12, 2026" },
    ])
  })

  it("rejects nearby Saturdays that are not national ACT dates", () => {
    expect(isNationalActTestDate("2026-09-19")).toBe(true)
    expect(isNationalActTestDate("2026-09-03")).toBe(false)
    expect(isNationalActTestDate("2026-09-12")).toBe(false)
  })

  it("migrates an old saved placeholder date to the next official date", () => {
    expect(upcomingNationalActTestDateOrNext("2026-08-27", "2026-07-29")).toBe(
      "2026-09-19"
    )
    expect(upcomingNationalActTestDateOrNext("2026-09-19", "2026-07-29")).toBe(
      "2026-09-19"
    )
  })
})
