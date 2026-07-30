import type {
  CoreSection,
  DiagnosticSkillResult,
  KnowledgeState,
} from "@act-tutor/core"
import { requiredCorrectForLessonCheck } from "@act-tutor/core"

export const NEEDS_WORK_MR_KIM_EVENT = "scout:open-mr-kim" as const

export type NeedsWorkSeverity = "priority" | "developing"

export interface NeedsWorkMrKimRequest {
  source: "needs-work"
  skill: string
  skillLabel: string
  section: CoreSection
  question: string
}

export interface NeedsWorkVideoGuide {
  channel: "Khan Academy" | "The Organic Chemistry Tutor"
  topic: string
  href: string
}

export interface NeedsWorkItem {
  rank: number
  skill: string
  label: string
  section: CoreSection
  readiness: number
  targetReadiness: number
  severity: NeedsWorkSeverity
  diagnosticCorrect: number | null
  diagnosticTotal: number
  practiceEvidence: number
  latestAnswerMissed: boolean
  evidenceLabel: string
  mrKimRequest: NeedsWorkMrKimRequest
  video: NeedsWorkVideoGuide
}

type DiagnosticSignal = Pick<
  DiagnosticSkillResult,
  "skill" | "label" | "section" | "correct" | "total" | "accuracy"
>

type KnowledgeSignal = Pick<
  KnowledgeState,
  | "skill"
  | "label"
  | "section"
  | "predictedCorrectProbability"
  | "baselineEvidence"
  | "observations"
  | "evidenceCount"
  | "priorSource"
  | "lastUpdate"
>

const VIDEO_GUIDES: Record<
  string,
  Omit<NeedsWorkVideoGuide, "href"> & { channelPath: string }
> = {
  "sentence-boundaries": {
    channel: "Khan Academy",
    channelPath: "@khanacademy",
    topic: "sentence fragments and run-ons",
  },
  "concision-and-redundancy": {
    channel: "Khan Academy",
    channelPath: "@khanacademy",
    topic: "concise writing and redundancy",
  },
  "punctuation-and-commas": {
    channel: "Khan Academy",
    channelPath: "@khanacademy",
    topic: "commas and punctuation",
  },
  "logical-transitions": {
    channel: "Khan Academy",
    channelPath: "@khanacademy",
    topic: "logical transitions in writing",
  },
  "linear-equations": {
    channel: "The Organic Chemistry Tutor",
    channelPath: "@TheOrganicChemistryTutor",
    topic: "linear equations",
  },
  "functions-and-modeling": {
    channel: "The Organic Chemistry Tutor",
    channelPath: "@TheOrganicChemistryTutor",
    topic: "functions and mathematical modeling",
  },
  "ratios-and-percent": {
    channel: "The Organic Chemistry Tutor",
    channelPath: "@TheOrganicChemistryTutor",
    topic: "ratios proportions and percent",
  },
  "geometry-and-measurement": {
    channel: "The Organic Chemistry Tutor",
    channelPath: "@TheOrganicChemistryTutor",
    topic: "geometry area perimeter and volume",
  },
  "central-ideas-and-details": {
    channel: "Khan Academy",
    channelPath: "@khanacademy",
    topic: "central ideas and supporting details",
  },
  "supported-inference": {
    channel: "Khan Academy",
    channelPath: "@khanacademy",
    topic: "reading inferences with evidence",
  },
  "textual-evidence-and-details": {
    channel: "Khan Academy",
    channelPath: "@khanacademy",
    topic: "command of textual evidence",
  },
  "author-purpose-and-structure": {
    channel: "Khan Academy",
    channelPath: "@khanacademy",
    topic: "author purpose and text structure",
  },
}

const SECTION_FALLBACK_VIDEO: Record<
  CoreSection,
  Omit<NeedsWorkVideoGuide, "href"> & { channelPath: string }
> = {
  english: {
    channel: "Khan Academy",
    channelPath: "@khanacademy",
    topic: "ACT English grammar",
  },
  math: {
    channel: "The Organic Chemistry Tutor",
    channelPath: "@TheOrganicChemistryTutor",
    topic: "ACT math review",
  },
  reading: {
    channel: "Khan Academy",
    channelPath: "@khanacademy",
    topic: "ACT reading evidence",
  },
}

function clampProbability(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function targetReadinessForGoal(goalScore: number) {
  return requiredCorrectForLessonCheck(goalScore) / 5
}

export function needsWorkVideoGuide(
  skill: string,
  section: CoreSection
): NeedsWorkVideoGuide {
  const guide = VIDEO_GUIDES[skill] ?? SECTION_FALLBACK_VIDEO[section]
  const query = new URLSearchParams({ query: guide.topic })
  return {
    channel: guide.channel,
    topic: guide.topic,
    href: `https://www.youtube.com/${guide.channelPath}/search?${query.toString()}`,
  }
}

function buildMrKimRequest(input: {
  skill: string
  label: string
  section: CoreSection
}): NeedsWorkMrKimRequest {
  return {
    source: "needs-work",
    skill: input.skill,
    skillLabel: input.label,
    section: input.section,
    question: `Help me with ${input.label}. Explain what this ACT question type is testing, show me one worked example, then let me try one.`,
  }
}

function evidenceLabel(input: {
  diagnostic: DiagnosticSignal | undefined
  knowledge: KnowledgeSignal | undefined
  readiness: number
}) {
  const { diagnostic, knowledge, readiness } = input
  if (knowledge?.lastUpdate && !knowledge.lastUpdate.correct) {
    return `Latest scored answer missed · current estimate ${Math.round(readiness * 100)}%`
  }
  if (diagnostic && diagnostic.total > 0) {
    return `${diagnostic.correct} of ${diagnostic.total} correct on the diagnostic`
  }
  const answerCount = knowledge?.evidenceCount ?? 0
  return `${answerCount} scored ${answerCount === 1 ? "answer" : "answers"} · current estimate ${Math.round(readiness * 100)}%`
}

export function buildNeedsWorkItems(input: {
  diagnosticSkillResults?: ReadonlyArray<DiagnosticSignal>
  knowledgeStates?: ReadonlyArray<KnowledgeSignal>
  goalScore: number
  limit?: number
}): NeedsWorkItem[] {
  const diagnostics = input.diagnosticSkillResults ?? []
  const knowledgeStates = input.knowledgeStates ?? []
  const knowledgeBySkill = new Map(
    knowledgeStates.map((state) => [state.skill, state])
  )
  const diagnosticBySkill = new Map(
    diagnostics
      .filter((result) => result.total > 0)
      .map((result) => [result.skill, result])
  )
  const skillIds = new Set([
    ...diagnosticBySkill.keys(),
    ...knowledgeStates
      .filter(
        (state) =>
          state.evidenceCount > 0 ||
          state.priorSource === "diagnostic" ||
          state.baselineEvidence > 0
      )
      .map((state) => state.skill),
  ])
  const targetReadiness = targetReadinessForGoal(input.goalScore)
  const limit = Math.max(1, Math.floor(input.limit ?? 6))

  return [...skillIds]
    .map((skill) => {
      const diagnostic = diagnosticBySkill.get(skill)
      const knowledge = knowledgeBySkill.get(skill)
      const diagnosticAccuracy = diagnostic
        ? clampProbability(
            diagnostic.total > 0
              ? diagnostic.correct / diagnostic.total
              : diagnostic.accuracy
          )
        : null
      const readiness =
        knowledge && knowledge.observations > 0
          ? clampProbability(knowledge.predictedCorrectProbability)
          : (diagnosticAccuracy ??
            clampProbability(knowledge?.predictedCorrectProbability ?? 0))
      const label = diagnostic?.label ?? knowledge?.label ?? skill
      const section = diagnostic?.section ?? knowledge?.section
      if (!section) return null
      const latestAnswerMissed = Boolean(
        knowledge?.lastUpdate && !knowledge.lastUpdate.correct
      )

      return {
        rank: 0,
        skill,
        label,
        section,
        readiness,
        targetReadiness,
        severity: readiness < targetReadiness - 0.2 ? "priority" : "developing",
        diagnosticCorrect: diagnostic?.correct ?? null,
        diagnosticTotal: diagnostic?.total ?? 0,
        practiceEvidence: knowledge?.observations ?? 0,
        latestAnswerMissed,
        evidenceLabel: evidenceLabel({ diagnostic, knowledge, readiness }),
        mrKimRequest: buildMrKimRequest({ skill, label, section }),
        video: needsWorkVideoGuide(skill, section),
      } satisfies NeedsWorkItem
    })
    .filter((item): item is NeedsWorkItem => Boolean(item))
    .filter((item) => item.readiness < targetReadiness)
    .sort((left, right) => {
      if (left.readiness !== right.readiness)
        return left.readiness - right.readiness
      if (left.latestAnswerMissed !== right.latestAnswerMissed)
        return left.latestAnswerMissed ? -1 : 1
      if (left.diagnosticTotal !== right.diagnosticTotal)
        return right.diagnosticTotal - left.diagnosticTotal
      return left.label.localeCompare(right.label)
    })
    .slice(0, limit)
    .map((item, index) => ({ ...item, rank: index + 1 }))
}
