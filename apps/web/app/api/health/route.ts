const DEVELOPMENT_RELEASE = "development"

export const dynamic = "force-dynamic"

export function createHealthPayload(release?: string) {
  return {
    status: "ok",
    service: "Scout ACT",
    release: release?.trim() || DEVELOPMENT_RELEASE,
  } as const
}

export function GET() {
  return Response.json(createHealthPayload(process.env.SCOUT_BUILD_COMMIT), {
    headers: {
      "Cache-Control": "no-store",
    },
  })
}
