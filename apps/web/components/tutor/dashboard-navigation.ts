export const DASHBOARD_DESTINATIONS = [
  "today",
  "needs-work",
  "plan",
  "calibrate",
  "progress",
  "history",
  "badges",
  "lab",
  "control",
] as const

export type DashboardDestination = (typeof DASHBOARD_DESTINATIONS)[number]

export const ACTIVE_DASHBOARD_TAB_STORAGE_KEY = "scout-active-dashboard-tab-v1"

export function isDashboardDestination(
  value: string
): value is DashboardDestination {
  return DASHBOARD_DESTINATIONS.some((destination) => destination === value)
}

export function resolveDashboardDestination({
  initialTab,
  representativeDemo,
  adaptiveBaselineRequired,
  storedTab,
}: {
  initialTab?: Extract<DashboardDestination, "today" | "calibrate">
  representativeDemo: boolean
  adaptiveBaselineRequired: boolean
  storedTab: string | null
}): DashboardDestination {
  if (initialTab) return initialTab
  if (representativeDemo || adaptiveBaselineRequired) return "calibrate"
  return storedTab && isDashboardDestination(storedTab) ? storedTab : "today"
}
