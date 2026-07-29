import type { KnowledgeConfidence } from "@act-tutor/core"

export type LearnerEvidenceStatus = {
  description: string
  label: string
}

const EVIDENCE_STATUS: Record<KnowledgeConfidence, LearnerEvidenceStatus> = {
  exploring: {
    label: "Early estimate",
    description:
      "Fewer than 3 scored answers support this skill, so the percentage can still move quickly.",
  },
  forming: {
    label: "Developing estimate",
    description:
      "Several scored answers support this skill, but more practice can still change the percentage.",
  },
  stable: {
    label: "Steadier estimate",
    description:
      "At least 7 scored answers support this skill. New evidence can still change the percentage.",
  },
}

export function describeLearnerEvidence(
  confidence: KnowledgeConfidence,
  evidenceCount: number
): LearnerEvidenceStatus {
  if (evidenceCount <= 0) {
    return {
      label: "Starting estimate",
      description:
        "No skill-specific scored answers support this yet. Use it only as a starting point until you practice this skill.",
    }
  }

  return EVIDENCE_STATUS[confidence]
}
