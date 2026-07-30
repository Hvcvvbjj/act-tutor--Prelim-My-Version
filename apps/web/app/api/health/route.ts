import { createHealthPayload } from "./health-payload"

export const dynamic = "force-dynamic"

export function GET() {
  return Response.json(createHealthPayload(process.env.SCOUT_BUILD_COMMIT), {
    headers: {
      "Cache-Control": "no-store",
    },
  })
}
