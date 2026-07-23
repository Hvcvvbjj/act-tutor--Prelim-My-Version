import { TutorApp } from "@/components/tutor/tutor-app"
import { currentAuthViewer } from "@/lib/auth.server"
import { addCalendarDaysFrom, toIsoCalendarDate } from "@/lib/dates"

export const dynamic = "force-dynamic"

export default async function Page() {
  const now = new Date()
  const today = toIsoCalendarDate(now)
  const defaultTest = addCalendarDaysFrom(today, 36)
  const initialViewer = await currentAuthViewer()

  return (
    <TutorApp
      today={today}
      initialTestDate={defaultTest}
      initialViewer={initialViewer}
    />
  )
}
