const DEVELOPMENT_RELEASE = "development"

export function createHealthPayload(release?: string) {
  return {
    status: "ok",
    service: "AlexACT",
    release: release?.trim() || DEVELOPMENT_RELEASE,
  } as const
}
