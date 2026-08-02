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
export const DASHBOARD_VIEW_QUERY_KEY = "view"

export function isDashboardDestination(
  value: string
): value is DashboardDestination {
  return DASHBOARD_DESTINATIONS.some((destination) => destination === value)
}

export function dashboardDestinationFromSearch(
  search: string
): DashboardDestination | null {
  const destination = new URLSearchParams(search).get(DASHBOARD_VIEW_QUERY_KEY)
  return destination && isDashboardDestination(destination) ? destination : null
}

export function dashboardUrlForDestination(
  currentHref: string,
  destination: DashboardDestination
): string {
  const url = new URL(currentHref)
  if (destination === "today") {
    url.searchParams.delete(DASHBOARD_VIEW_QUERY_KEY)
  } else {
    url.searchParams.set(DASHBOARD_VIEW_QUERY_KEY, destination)
  }
  return `${url.pathname}${url.search}${url.hash}`
}

export function resolveDashboardDestination({
  initialTab,
  representativeDemo,
  adaptiveBaselineRequired,
  urlTab,
  storedTab,
}: {
  initialTab?: Extract<DashboardDestination, "today" | "calibrate">
  representativeDemo: boolean
  adaptiveBaselineRequired: boolean
  urlTab: string | null
  storedTab: string | null
}): DashboardDestination {
  if (initialTab) return initialTab
  if (representativeDemo || adaptiveBaselineRequired) return "calibrate"
  if (urlTab && isDashboardDestination(urlTab)) return urlTab
  return storedTab && isDashboardDestination(storedTab) ? storedTab : "today"
}
