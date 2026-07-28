import { describe, expect, it } from "vitest"

import { buildLessonPathItems } from "./lesson-path"

const skills = [
  {
    skill: "sentence-boundaries",
    label: "Sentence boundaries",
    section: "english",
  },
  {
    skill: "linear-equations",
    label: "Linear equations",
    section: "math",
  },
  {
    skill: "supported-inference",
    label: "Supported inference",
    section: "reading",
  },
] as const

describe("lesson path", () => {
  it("marks completed, current, and later lessons without cutting content", () => {
    expect(
      buildLessonPathItems({
        requiredSkills: skills.map((skill) => skill.skill),
        completedSkills: ["sentence-boundaries"],
        currentSkill: "linear-equations",
        skills,
        currentLessonMinutes: 12,
      })
    ).toEqual([
      {
        id: "sentence-boundaries",
        title: "Sentence boundaries",
        section: "english",
        minutes: undefined,
        status: "completed",
      },
      {
        id: "linear-equations",
        title: "Linear equations",
        section: "math",
        minutes: 12,
        status: "current",
      },
      {
        id: "supported-inference",
        title: "Supported inference",
        section: "reading",
        minutes: undefined,
        status: "locked",
      },
    ])
  })

  it("uses the first unfinished lesson when no active skill is supplied", () => {
    const path = buildLessonPathItems({
      requiredSkills: skills.map((skill) => skill.skill),
      completedSkills: [],
      skills,
    })

    expect(path.map((lesson) => lesson.status)).toEqual([
      "current",
      "locked",
      "locked",
    ])
  })

  it("keeps a readable fallback title when skill metadata is unavailable", () => {
    const path = buildLessonPathItems({
      requiredSkills: ["author-purpose-and-structure"],
      completedSkills: [],
      skills: [],
    })

    expect(path[0]?.title).toBe("Author Purpose And Structure")
  })
})
