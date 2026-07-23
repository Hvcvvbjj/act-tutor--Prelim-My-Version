import type { LearningSessionPayload } from "@act-tutor/core"

import type { GeneratedPlan } from "@/components/tutor/types"

export interface ScoutOperationsLabProps {
  plan: GeneratedPlan
  learning: LearningSessionPayload
  busy: boolean
  canViewTechnicalDetails: boolean
  onCorrectModel: (input: {
    skill: string
    kind: "too-high" | "too-low" | "wrong-misconception"
    note: string
  }) => void
  onStartChallenge: (skill?: string) => void
  onStartRecovery: () => void
  onDeleteData: () => void
}

export type ScoutOperationsView = "learner" | "act" | "trust"
