import { TutorApp } from "@/components/tutor/tutor-app"
import { nextNationalActTestDate } from "@/lib/act-test-dates"
import { currentAuthViewer } from "@/lib/auth.server"
import { toIsoCalendarDate } from "@/lib/dates"

export const dynamic = "force-dynamic"

export default async function Page() {
  const now = new Date()
  const today = toIsoCalendarDate(now)
  const defaultTest = nextNationalActTestDate(today)
  const initialViewer = await currentAuthViewer()

  return (
    <TutorApp
      today={today}
      initialTestDate={defaultTest}
      initialViewer={initialViewer}
    />
  )
}
