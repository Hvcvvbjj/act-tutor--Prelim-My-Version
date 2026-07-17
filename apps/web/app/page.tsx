import { TutorApp } from "@/components/tutor/tutor-app"
import { addCalendarDaysFrom, toIsoCalendarDate } from "@/lib/dates"

export const dynamic = "force-dynamic"

export default function Page() {
  const now = new Date()
  const today = toIsoCalendarDate(now)
  const defaultTest = addCalendarDaysFrom(today, 36)

  return <TutorApp today={today} initialTestDate={defaultTest} />
}
