export function toIsoCalendarDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function addCalendarDaysFrom(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function formatCalendarDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day, 12))
}
