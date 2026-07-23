import type { NormalizedScoreEvidence } from "@act-tutor/core"

import type { PlacementDraft } from "@/components/tutor/types"

export type AuthRole = "guest" | "learner" | "judge"

export interface SavedTutorPlan {
  version: 1
  savedAt: string
  draft: PlacementDraft
  evidence: NormalizedScoreEvidence
  currentComposite: number
  adaptiveBaselineRequired: boolean
  baselineSkipped: boolean
}

export interface AuthViewer {
  authenticated: boolean
  role: AuthRole
  username: string | null
  displayName: string | null
  technicalDetails: boolean
  savedPlan: SavedTutorPlan | null
}

export const GUEST_VIEWER: AuthViewer = {
  authenticated: false,
  role: "guest",
  username: null,
  displayName: null,
  technicalDetails: false,
  savedPlan: null,
}
