import {
  catchUpStudyPlan,
  generateStudyPlan,
  rebalanceStudyPlan,
  setStudyPlanTaskStatus,
  type AdaptiveStudyPlan,
  type StudySkillSignal,
} from "@act-tutor/core"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  defaultStudyAvailability,
  loadInitialStudyPlan,
  type InitialStudyPlanInput,
} from "./adaptive-plan-studio-client"

const SKILLS: StudySkillSignal[] = [
  {
    skill: "boundaries",
    label: "Sentence boundaries",
    section: "english",
    mastery: 0.42,
    evidence: 3,
    nextReviewAt: null,
    priority: 1,
  },
  {
    skill: "linear",
    label: "Linear equations",
    section: "math",
    mastery: 0.36,
    evidence: 2,
    nextReviewAt: null,
    priority: 0.5,
  },
  {
    skill: "inference",
    label: "Supported inference",
    section: "reading",
    mastery: 0.58,
    evidence: 4,
    nextReviewAt: null,
    priority: 0,
  },
]

const INPUT: InitialStudyPlanInput = {
  today: "2026-07-25",
  testDate: "2026-08-29",
  current: { english: 24, math: 21, reading: 25 },
  target: { english: 29, math: 28, reading: 30 },
  skills: SKILLS,
  studyDaysPerWeek: 3,
  minutesPerSession: 30,
}

function makePlan(
  input: InitialStudyPlanInput = INPUT,
  availability = defaultStudyAvailability(
    input.today,
    input.studyDaysPerWeek,
    input.minutesPerSession
  )
) {
  return generateStudyPlan({
    today: input.today,
    testDate: input.testDate,
    current: input.current,
    target: input.target,
    skills: input.skills,
    availability,
    generatedAt: "2026-07-25T12:00:00.000Z",
  })
}

function jsonResponse(plan: AdaptiveStudyPlan | null, status = 200) {
  return new Response(JSON.stringify({ plan }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, callIndex: number) {
  const init = fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined
  return JSON.parse(String(init?.body)) as Record<string, unknown>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("defaultStudyAvailability", () => {
  it("always includes the current plan date in a deterministic day-count schedule", () => {
    const first = defaultStudyAvailability("2026-07-25", 3, 30)
    const second = defaultStudyAvailability("2026-07-25", 3, 30)

    expect(first).toEqual(second)
    expect(first.entries).toEqual([
      { weekday: "sat", minutes: 30 },
      { weekday: "mon", minutes: 30 },
      { weekday: "wed", minutes: 30 },
    ])
  })

  it("distributes every multi-day starter schedule evenly across the week", () => {
    const dates = [
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
      "2026-07-25",
      "2026-07-26",
    ]
    const weekdayIndex = new Map([
      ["sun", 0],
      ["mon", 1],
      ["tue", 2],
      ["wed", 3],
      ["thu", 4],
      ["fri", 5],
      ["sat", 6],
    ])

    for (const date of dates) {
      for (let studyDays = 2; studyDays <= 7; studyDays += 1) {
        const indices = defaultStudyAvailability(date, studyDays, 30)
          .entries.map((entry) => weekdayIndex.get(entry.weekday) ?? -1)
          .sort((left, right) => left - right)
        const cyclicGaps = indices.map(
          (value, index) =>
            ((indices[(index + 1) % indices.length] ?? value) - value + 7) % 7
        )
        const widestGap = Math.max(...cyclicGaps)
        const narrowestGap = Math.min(...cyclicGaps)

        expect(widestGap - narrowestGap).toBeLessThanOrEqual(1)
        if (studyDays <= 3) {
          expect(narrowestGap).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  it("includes each possible current weekday even for a one-day plan", () => {
    const dates = [
      ["2026-07-20", "mon"],
      ["2026-07-21", "tue"],
      ["2026-07-22", "wed"],
      ["2026-07-23", "thu"],
      ["2026-07-24", "fri"],
      ["2026-07-25", "sat"],
      ["2026-07-26", "sun"],
    ] as const

    for (const [date, weekday] of dates) {
      expect(defaultStudyAvailability(date, 1, 45).entries).toEqual([
        { weekday, minutes: 45 },
      ])
    }
  })
})

describe("loadInitialStudyPlan", () => {
  it("reuses a matching saved plan without posting starter availability", async () => {
    const editedAvailability = {
      entries: [
        { weekday: "tue" as const, minutes: 45 },
        { weekday: "sat" as const, minutes: 75 },
      ],
    }
    const saved = makePlan(INPUT, editedAvailability)
    const completed = setStudyPlanTaskStatus(
      saved,
      saved.tasks[0].id,
      "complete",
      "2026-07-25T13:00:00.000Z"
    )
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(completed))
    vi.stubGlobal("fetch", fetchMock)

    const resumed = await loadInitialStudyPlan(INPUT)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      cache: "no-store",
    })
    expect(resumed.availability).toEqual(editedAvailability)
    expect(
      resumed.tasks.find((task) => task.id === saved.tasks[0].id)
    ).toMatchObject({
      status: "complete",
      completedAt: "2026-07-25T13:00:00.000Z",
    })
  })

  it("starts only when GET confirms no saved plan exists", async () => {
    const started = makePlan()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(null))
      .mockResolvedValueOnce(jsonResponse(started))
    vi.stubGlobal("fetch", fetchMock)

    await loadInitialStudyPlan(INPUT)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(requestBody(fetchMock, 1)).toMatchObject({
      action: "start",
      today: INPUT.today,
      availability: {
        entries: [
          { weekday: "sat", minutes: 30 },
          { weekday: "mon", minutes: 30 },
          { weekday: "wed", minutes: 30 },
        ],
      },
    })
  })

  it("rebalances a default calendar when setup availability changes", async () => {
    const saved = makePlan()
    const changedInput = {
      ...INPUT,
      studyDaysPerWeek: 5,
      minutesPerSession: 60,
    }
    const rebalanced = makePlan(
      changedInput,
      defaultStudyAvailability(changedInput.today, 5, 60)
    )
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(saved))
      .mockResolvedValueOnce(jsonResponse(rebalanced))
    vi.stubGlobal("fetch", fetchMock)

    await loadInitialStudyPlan(changedInput)

    expect(requestBody(fetchMock, 1)).toMatchObject({
      action: "start",
      availability: defaultStudyAvailability(changedInput.today, 5, 60),
    })
  })

  it("replaces a legacy clustered starter calendar with the spaced default", async () => {
    const tuesdayInput = { ...INPUT, today: "2026-07-21" }
    const legacyAvailability = {
      entries: [
        { weekday: "tue" as const, minutes: 30 },
        { weekday: "mon" as const, minutes: 30 },
        { weekday: "wed" as const, minutes: 30 },
      ],
    }
    const saved = makePlan(tuesdayInput, legacyAvailability)
    const spacedAvailability = defaultStudyAvailability(
      tuesdayInput.today,
      tuesdayInput.studyDaysPerWeek,
      tuesdayInput.minutesPerSession
    )
    const rebalanced = makePlan(tuesdayInput, spacedAvailability)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(saved))
      .mockResolvedValueOnce(jsonResponse(rebalanced))
    vi.stubGlobal("fetch", fetchMock)

    const result = await loadInitialStudyPlan(tuesdayInput)

    expect(requestBody(fetchMock, 1)).toMatchObject({
      action: "start",
      availability: spacedAvailability,
    })
    expect(result.availability).toEqual(spacedAvailability)
  })

  it("catches up a default calendar across days without rebuilding progress", async () => {
    const saved = makePlan()
    const nextInput = { ...INPUT, today: "2026-07-26" }
    const caughtUp = catchUpStudyPlan(saved, nextInput.today)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(saved))
      .mockResolvedValueOnce(jsonResponse(caughtUp))
    vi.stubGlobal("fetch", fetchMock)

    const resumed = await loadInitialStudyPlan(nextInput)

    expect(requestBody(fetchMock, 1)).toEqual({
      action: "catch_up",
      today: nextInput.today,
    })
    expect(resumed.today).toBe(nextInput.today)
  })

  it("still recognizes a caught-up default calendar when setup capacity changes", async () => {
    const saved = makePlan()
    const caughtUp = catchUpStudyPlan(saved, "2026-07-26")
    const changedInput = {
      ...INPUT,
      today: "2026-07-26",
      studyDaysPerWeek: 5,
      minutesPerSession: 60,
    }
    const replaced = makePlan(
      changedInput,
      defaultStudyAvailability(changedInput.today, 5, 60)
    )
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(caughtUp))
      .mockResolvedValueOnce(jsonResponse(replaced))
    vi.stubGlobal("fetch", fetchMock)

    await loadInitialStudyPlan(changedInput)

    expect(requestBody(fetchMock, 1)).toMatchObject({
      action: "start",
      availability: defaultStudyAvailability(changedInput.today, 5, 60),
    })
  })

  it("preserves a custom calendar while score evidence changes", async () => {
    const customAvailability = {
      entries: [
        { weekday: "tue" as const, minutes: 45 },
        { weekday: "sat" as const, minutes: 75 },
      ],
    }
    const saved = makePlan(INPUT, customAvailability)
    const changedInput = {
      ...INPUT,
      current: { ...INPUT.current, math: 22 },
    }
    const replaced = makePlan(changedInput, customAvailability)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(saved))
      .mockResolvedValueOnce(jsonResponse(replaced))
    vi.stubGlobal("fetch", fetchMock)

    await loadInitialStudyPlan(changedInput)

    expect(requestBody(fetchMock, 1)).toMatchObject({
      action: "start",
      availability: customAvailability,
    })
  })

  it("syncs changed evidence without reposting starter availability", async () => {
    const saved = makePlan(INPUT, {
      entries: [
        { weekday: "tue", minutes: 45 },
        { weekday: "sat", minutes: 75 },
      ],
    })
    const completed = setStudyPlanTaskStatus(
      saved,
      saved.tasks[0].id,
      "complete",
      "2026-07-25T13:00:00.000Z"
    )
    const changedSkills = SKILLS.map((skill) =>
      skill.skill === "linear"
        ? { ...skill, mastery: 0.64, evidence: 5 }
        : skill
    )
    const synced = rebalanceStudyPlan(completed, {
      skills: changedSkills,
      updatedAt: "2026-07-25T14:00:00.000Z",
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(completed))
      .mockResolvedValueOnce(jsonResponse(synced))
    vi.stubGlobal("fetch", fetchMock)

    const resumed = await loadInitialStudyPlan({
      ...INPUT,
      skills: changedSkills,
    })

    expect(requestBody(fetchMock, 1)).toMatchObject({
      action: "sync_evidence",
      skills: changedSkills,
    })
    expect(resumed.availability).toEqual(completed.availability)
    expect(
      resumed.tasks.find((task) => task.id === saved.tasks[0].id)
    ).toMatchObject({
      status: "complete",
      completedAt: "2026-07-25T13:00:00.000Z",
    })
  })

  it("advances a matching saved plan without losing completed history", async () => {
    const priorInput = { ...INPUT, today: "2026-07-24" }
    const prior = makePlan(priorInput, {
      entries: [
        { weekday: "fri", minutes: 45 },
        { weekday: "sat", minutes: 60 },
      ],
    })
    const completed = setStudyPlanTaskStatus(
      prior,
      prior.tasks[0].id,
      "complete",
      "2026-07-24T13:00:00.000Z"
    )
    const advanced = catchUpStudyPlan(
      completed,
      INPUT.today,
      "2026-07-25T12:00:00.000Z"
    )
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(completed))
      .mockResolvedValueOnce(jsonResponse(advanced))
    vi.stubGlobal("fetch", fetchMock)

    const resumed = await loadInitialStudyPlan(INPUT)

    expect(requestBody(fetchMock, 1)).toEqual({
      action: "catch_up",
      today: INPUT.today,
    })
    expect(resumed.availability).toEqual(completed.availability)
    expect(
      resumed.tasks.find((task) => task.id === prior.tasks[0].id)
    ).toMatchObject({
      status: "complete",
      completedAt: "2026-07-24T13:00:00.000Z",
    })
  })

  it("does not fall through to start when the resume read fails", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Temporary read failure." }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(loadInitialStudyPlan(INPUT)).rejects.toThrow(
      "Temporary read failure."
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
