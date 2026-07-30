import { readFile } from "node:fs/promises"

import { FULL_LENGTH_PRACTICE_FORM } from "@act-tutor/content"
import { selectExamLabQuestions, type CoreSection } from "@act-tutor/core"
import { describe, expect, it } from "vitest"

import { shouldShowExamLabDifficulty } from "@/components/tutor/assessment-display"

const root = new URL("../../", import.meta.url)

async function source(path: string) {
  return readFile(new URL(path, root), "utf8")
}

describe("assessment presentation contract", () => {
  it("shows difficulty on lesson and progress checks, but not diagnostics", async () => {
    const [lesson, diagnostic, examRunner] = await Promise.all([
      source("components/tutor/lesson-workspace.tsx"),
      source("components/tutor/diagnostic-runner.tsx"),
      source("components/tutor/exam-lab-runner.tsx"),
    ])

    expect(lesson).toContain('data-testid="practice-difficulty"')
    expect(lesson).toContain(
      "PRACTICE_DIFFICULTY_LABELS[displayedQuestion.difficulty]"
    )
    expect(diagnostic).not.toContain("practice-difficulty")
    expect(diagnostic).not.toContain("question.difficulty")
    expect(examRunner).toContain('data-testid="progress-check-difficulty"')
    expect(examRunner).toContain("shouldShowExamLabDifficulty(assessmentLabel)")
    expect(examRunner).toContain(
      "PRACTICE_DIFFICULTY_LABELS[question.difficulty]"
    )
  })

  it("limits exam-lab difficulty tags to progress checks", () => {
    expect(shouldShowExamLabDifficulty("Progress check")).toBe(true)
    expect(shouldShowExamLabDifficulty("Timed Practice")).toBe(false)
    expect(shouldShowExamLabDifficulty("Full-length practice test")).toBe(false)
  })

  it("renders countdowns in both the diagnostic and timed test runners", async () => {
    const [diagnostic, examRunner] = await Promise.all([
      source("components/tutor/diagnostic-runner.tsx"),
      source("components/tutor/exam-lab-runner.tsx"),
    ])

    expect(diagnostic).toContain('role="timer"')
    expect(diagnostic).toContain("Diagnostic time remaining")
    expect(diagnostic).toContain("session.form.estimatedMinutes * 60")
    expect(examRunner).toContain("formatTime(timeLeft)")
    expect(examRunner).toContain("examLabTimerControls")
  })

  it("uses complete official-length sections for progress-check presentation", () => {
    const expected: Record<CoreSection, number> = {
      english: 50,
      math: 45,
      reading: 36,
    }

    for (const [section, count] of Object.entries(expected) as Array<
      [CoreSection, number]
    >) {
      expect(
        selectExamLabQuestions(FULL_LENGTH_PRACTICE_FORM, "section", section)
      ).toHaveLength(count)
    }
  })

  it("exposes a dedicated progress-check label without changing test content", async () => {
    const [testDayLab, setup, runner] = await Promise.all([
      source("components/tutor/test-day-lab.tsx"),
      source("components/tutor/exam-lab-setup.tsx"),
      source("components/tutor/exam-lab-runner.tsx"),
    ])

    expect(testDayLab).toContain('assessmentLabel = "Timed Practice"')
    expect(testDayLab).toContain("assessmentLabel={assessmentLabel}")
    expect(setup).toContain('assessmentLabel === "Progress check"')
    expect(setup).toContain("complete ACT-length section")
    expect(runner).toContain("{assessmentLabel}")
  })

  it("requires focused missed-question remediation only after round assessments", async () => {
    const [remediation, diagnostic, testDayLab, learningRoute] =
      await Promise.all([
        source("components/tutor/assessment-remediation.tsx"),
        source("components/tutor/diagnostic-runner.tsx"),
        source("components/tutor/test-day-lab.tsx"),
        source("app/api/learning/route.ts"),
      ])

    expect(remediation).toContain("Let&apos;s fix this one.")
    expect(remediation).toContain("Check answer")
    expect(remediation).toContain("Ask Mr. Kim about this")
    expect(diagnostic).toContain('purpose === "round"')
    expect(diagnostic).toContain('action: "answer_remediation"')
    expect(testDayLab).toContain('action: "answer_remediation"')
    expect(testDayLab).toContain("requireRoundRemediation")
    expect(learningRoute).toContain("assertRoundRemediationComplete")
  })
})
