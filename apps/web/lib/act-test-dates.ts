export const NATIONAL_ACT_TEST_DATES = [
  { date: "2026-07-11", label: "July 11, 2026" },
  { date: "2026-09-19", label: "September 19, 2026" },
  { date: "2026-10-17", label: "October 17, 2026" },
  { date: "2026-12-12", label: "December 12, 2026" },
  { date: "2027-02-27", label: "February 27, 2027" },
  { date: "2027-04-10", label: "April 10, 2027" },
  { date: "2027-06-12", label: "June 12, 2027" },
  { date: "2027-07-10", label: "July 10, 2027" },
] as const

export type NationalActTestDate = (typeof NATIONAL_ACT_TEST_DATES)[number]

export function upcomingNationalActTestDates(
  today: string,
  limit: number = NATIONAL_ACT_TEST_DATES.length
): ReadonlyArray<NationalActTestDate> {
  return NATIONAL_ACT_TEST_DATES.filter((entry) => entry.date > today).slice(
    0,
    Math.max(0, limit)
  )
}

export function nextNationalActTestDate(today: string): string {
  return upcomingNationalActTestDates(today, 1)[0]?.date ?? ""
}

export function isNationalActTestDate(value: string): boolean {
  return NATIONAL_ACT_TEST_DATES.some((entry) => entry.date === value)
}

export function upcomingNationalActTestDateOrNext(
  value: string,
  today: string
): string {
  return isNationalActTestDate(value) && value > today
    ? value
    : nextNationalActTestDate(today)
}
