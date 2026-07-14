import type { ScoutExplanationPreferences } from "@act-tutor/core"

export interface AccommodationPreferences {
  reducedMotion: boolean
  largeText: boolean
  highContrast: boolean
  keyboardOnly: boolean
  readAloud: boolean
  simplified: boolean
  extendedTime: boolean
  distractionReduced: boolean
}

export const DEFAULT_ACCOMMODATIONS: AccommodationPreferences = {
  reducedMotion: false,
  largeText: false,
  highContrast: false,
  keyboardOnly: false,
  readAloud: false,
  simplified: false,
  extendedTime: false,
  distractionReduced: false,
}

export const DEFAULT_EXPLANATION_PREFERENCES: ScoutExplanationPreferences = {
  depth: "normal",
  readingLevel: "standard",
  exampleStyle: "everyday",
  fewerTechnicalTerms: true,
}

export const SCOUT_SETTINGS_KEY = "scout-settings-v2"
const LEGACY_EXPLANATION_KEY = "scout-explanation-preferences-v1"
const LEGACY_ACCOMMODATIONS_KEY = "scout-accommodations-v1"

export interface ScoutSettings {
  version: 2
  explanation: ScoutExplanationPreferences
  accommodations: AccommodationPreferences
  explanationUpdatedAt: string
  accommodationsUpdatedAt: string
  explanationCustomized: boolean
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function explanationFrom(value: unknown): ScoutExplanationPreferences {
  const input = record(value)
  return {
    depth:
      input.depth === "quick" ||
      input.depth === "normal" ||
      input.depth === "detailed"
        ? input.depth
        : DEFAULT_EXPLANATION_PREFERENCES.depth,
    readingLevel:
      input.readingLevel === "plain" ||
      input.readingLevel === "standard" ||
      input.readingLevel === "advanced"
        ? input.readingLevel
        : DEFAULT_EXPLANATION_PREFERENCES.readingLevel,
    exampleStyle:
      input.exampleStyle === "school" ||
      input.exampleStyle === "sports" ||
      input.exampleStyle === "gaming" ||
      input.exampleStyle === "everyday"
        ? input.exampleStyle
        : DEFAULT_EXPLANATION_PREFERENCES.exampleStyle,
    fewerTechnicalTerms:
      typeof input.fewerTechnicalTerms === "boolean"
        ? input.fewerTechnicalTerms
        : DEFAULT_EXPLANATION_PREFERENCES.fewerTechnicalTerms,
  }
}

function accommodationsFrom(value: unknown): AccommodationPreferences {
  const input = record(value)
  return Object.fromEntries(
    Object.entries(DEFAULT_ACCOMMODATIONS).map(([key, fallback]) => [
      key,
      typeof input[key] === "boolean" ? input[key] : fallback,
    ])
  ) as unknown as AccommodationPreferences
}

function validTimestamp(value: unknown, fallback: string) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : fallback
}

export function readScoutSettings(): ScoutSettings {
  const now = new Date().toISOString()
  try {
    const parsed = record(
      JSON.parse(window.localStorage.getItem(SCOUT_SETTINGS_KEY) ?? "null")
    )
    if (parsed.version === 2) {
      return {
        version: 2,
        explanation: explanationFrom(parsed.explanation),
        accommodations: accommodationsFrom(parsed.accommodations),
        explanationUpdatedAt: validTimestamp(parsed.explanationUpdatedAt, now),
        accommodationsUpdatedAt: validTimestamp(
          parsed.accommodationsUpdatedAt,
          now
        ),
        explanationCustomized:
          typeof parsed.explanationCustomized === "boolean"
            ? parsed.explanationCustomized
            : JSON.stringify(explanationFrom(parsed.explanation)) !==
              JSON.stringify(DEFAULT_EXPLANATION_PREFERENCES),
      }
    }
  } catch {
    window.localStorage.removeItem(SCOUT_SETTINGS_KEY)
  }

  let legacyExplanation: unknown = null
  let legacyAccommodations: unknown = null
  const hadLegacyExplanation =
    window.localStorage.getItem(LEGACY_EXPLANATION_KEY) !== null
  try {
    legacyExplanation = JSON.parse(
      window.localStorage.getItem(LEGACY_EXPLANATION_KEY) ?? "null"
    )
  } catch {
    window.localStorage.removeItem(LEGACY_EXPLANATION_KEY)
  }
  try {
    legacyAccommodations = JSON.parse(
      window.localStorage.getItem(LEGACY_ACCOMMODATIONS_KEY) ?? "null"
    )
  } catch {
    window.localStorage.removeItem(LEGACY_ACCOMMODATIONS_KEY)
  }
  const migrated: ScoutSettings = {
    version: 2,
    explanation: explanationFrom(legacyExplanation),
    accommodations: accommodationsFrom(legacyAccommodations),
    explanationUpdatedAt: now,
    accommodationsUpdatedAt: now,
    explanationCustomized: hadLegacyExplanation,
  }
  writeScoutSettings(migrated)
  window.localStorage.removeItem(LEGACY_EXPLANATION_KEY)
  window.localStorage.removeItem(LEGACY_ACCOMMODATIONS_KEY)
  return migrated
}

export function writeScoutSettings(settings: ScoutSettings) {
  window.localStorage.setItem(SCOUT_SETTINGS_KEY, JSON.stringify(settings))
}

export function updateScoutExplanation(
  explanation: ScoutExplanationPreferences,
  updatedAt = new Date().toISOString(),
  customized = true
) {
  const current = readScoutSettings()
  const next = {
    ...current,
    explanation,
    explanationUpdatedAt: updatedAt,
    explanationCustomized: customized,
  }
  writeScoutSettings(next)
  return next
}

export function updateScoutAccommodations(
  accommodations: AccommodationPreferences,
  updatedAt = new Date().toISOString()
) {
  const current = readScoutSettings()
  const next = {
    ...current,
    accommodations,
    accommodationsUpdatedAt: updatedAt,
  }
  writeScoutSettings(next)
  return next
}
