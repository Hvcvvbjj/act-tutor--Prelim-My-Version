import { TutorApp } from "@/components/tutor/tutor-app"

export const dynamic = "force-dynamic"

export default function Page() {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const defaultTest = new Date(now)
  defaultTest.setUTCDate(defaultTest.getUTCDate() + 36)

  return (
    <TutorApp
      today={today}
      initialTestDate={defaultTest.toISOString().slice(0, 10)}
    />
  )
}
