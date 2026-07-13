import { describe, expect, it } from "vitest";

import {
  catchUpStudyPlan,
  generateStudyPlan,
  normalizeStudyAvailability,
  rebalanceStudyPlan,
  setStudyPlanTaskStatus,
  shiftStudyWeek,
  studyWeekStart,
  tasksForStudyWeek,
  type StudySkillSignal,
} from "./study-plan";

const SKILLS: StudySkillSignal[] = [
  {
    skill: "sentence-boundaries",
    label: "Sentence boundaries",
    section: "english",
    mastery: 0.38,
    evidence: 4,
    nextReviewAt: "2026-07-14T12:00:00.000Z",
  },
  {
    skill: "concision",
    label: "Concision and redundancy",
    section: "english",
    mastery: 0.56,
    evidence: 2,
    nextReviewAt: null,
  },
  {
    skill: "linear-equations",
    label: "Linear equations",
    section: "math",
    mastery: 0.31,
    evidence: 3,
    nextReviewAt: "2026-07-13T12:00:00.000Z",
  },
  {
    skill: "functions",
    label: "Functions and modeling",
    section: "math",
    mastery: 0.49,
    evidence: 1,
    nextReviewAt: null,
  },
  {
    skill: "supported-inference",
    label: "Supported inference",
    section: "reading",
    mastery: 0.44,
    evidence: 4,
    nextReviewAt: null,
  },
  {
    skill: "central-ideas",
    label: "Central ideas and details",
    section: "reading",
    mastery: 0.61,
    evidence: 2,
    nextReviewAt: null,
  },
];

function plan() {
  return generateStudyPlan({
    today: "2026-07-13",
    testDate: "2026-08-18",
    current: { english: 26, math: 20, reading: 25 },
    target: { english: 31, math: 31, reading: 29 },
    skills: SKILLS,
    generatedAt: "2026-07-13T12:00:00.000Z",
  });
}

describe("adaptive study plans", () => {
  it("builds a dated route only on available days before test day", () => {
    const result = plan();

    expect(result.availability.entries).toHaveLength(5);
    expect(result.tasks.length).toBeGreaterThan(20);
    expect(result.tasks.every((task) => task.date >= result.today)).toBe(true);
    expect(result.tasks.every((task) => task.date < result.testDate)).toBe(
      true,
    );
    expect(
      result.tasks.every((task) => {
        const day = new Date(`${task.date}T00:00:00.000Z`).getUTCDay();
        return day >= 1 && day <= 5;
      }),
    ).toBe(true);
    expect(result.tasks.some((task) => task.kind === "checkpoint")).toBe(true);
    expect(result.tasks.some((task) => task.kind === "rehearsal")).toBe(true);
  });

  it("uses skill weakness, evidence, and section opportunity in task reasons", () => {
    const result = plan();
    const skillTasks = result.tasks.filter((task) => task.skill);

    expect(skillTasks.length).toBeGreaterThan(10);
    expect(skillTasks.some((task) => task.skill === "linear-equations")).toBe(
      true,
    );
    expect(skillTasks.every((task) => task.reason.length > 30)).toBe(true);
    expect(new Set(skillTasks.map((task) => task.section))).toEqual(
      new Set(["english", "math", "reading"]),
    );
  });

  it("keeps the live Daily Mission aligned when evidence is otherwise tied", () => {
    const aligned = generateStudyPlan({
      today: "2026-07-13",
      testDate: "2026-08-18",
      current: { english: 24, math: 24, reading: 24 },
      target: { english: 30, math: 30, reading: 30 },
      skills: SKILLS.map((skill) => ({
        ...skill,
        mastery: 0.5,
        evidence: 0,
        priority: skill.skill === "sentence-boundaries" ? 1 : 0,
      })),
      generatedAt: "2026-07-13T12:00:00.000Z",
    });

    expect(
      aligned.tasks.find((task) => task.date === aligned.today)?.skill,
    ).toBe("sentence-boundaries");
  });

  it("summarizes capacity, honest health, milestones, and evidence readiness", () => {
    const result = plan();

    expect(result.forecast.weeklyCapacity).toBe(150);
    expect(result.forecast.scheduledMinutes).toBeGreaterThan(600);
    expect(result.forecast.recommendedMinutes).toBeGreaterThan(0);
    expect(result.forecast.readiness).toBeGreaterThan(0);
    expect(result.forecast.readiness).toBeLessThan(100);
    expect(result.milestones.map((milestone) => milestone.id)).toEqual([
      "first-checkpoint",
      "halfway-proof",
      "core-rehearsal",
      "test-day",
    ]);
  });

  it("validates unique days and per-day capacity", () => {
    expect(() =>
      normalizeStudyAvailability({
        entries: [
          { weekday: "mon", minutes: 30 },
          { weekday: "mon", minutes: 45 },
        ],
      }),
    ).toThrow("unique");
    expect(() =>
      normalizeStudyAvailability({ entries: [{ weekday: "sun", minutes: 5 }] }),
    ).toThrow("15 to 120");
  });

  it("rebalances only future work while freezing today and completion history", () => {
    const initial = plan();
    const todayTasks = initial.tasks.filter(
      (task) => task.date === initial.today,
    );
    const futureTask = initial.tasks.find((task) => task.date > initial.today);
    expect(todayTasks.length).toBeGreaterThan(0);
    expect(futureTask).toBeDefined();

    const completed = setStudyPlanTaskStatus(
      initial,
      futureTask!.id,
      "complete",
      "2026-07-13T13:00:00.000Z",
    );
    const rebalanced = rebalanceStudyPlan(completed, {
      availability: {
        entries: [
          { weekday: "mon", minutes: 45 },
          { weekday: "wed", minutes: 45 },
          { weekday: "sat", minutes: 60 },
        ],
      },
      skills: SKILLS.map((skill) =>
        skill.skill === "linear-equations"
          ? { ...skill, mastery: 0.82, evidence: 8 }
          : skill,
      ),
      updatedAt: "2026-07-13T14:00:00.000Z",
    });

    expect(
      rebalanced.tasks.filter((task) => task.date === initial.today),
    ).toEqual(todayTasks);
    expect(
      rebalanced.tasks.find((task) => task.id === futureTask!.id)?.status,
    ).toBe("complete");
    expect(rebalanced.forecast.weeklyCapacity).toBe(150);
    expect(rebalanced.revision).toBe(initial.revision + 2);
    expect(rebalanced.revisionReason).toContain("did not change");
  });

  it("records task completion idempotently without inventing score gains", () => {
    const initial = plan();
    const task = initial.tasks[0];
    const completed = setStudyPlanTaskStatus(
      initial,
      task.id,
      "complete",
      "2026-07-13T13:00:00.000Z",
    );
    const repeated = setStudyPlanTaskStatus(
      completed,
      task.id,
      "complete",
      "2026-07-13T14:00:00.000Z",
    );

    expect(repeated.tasks[0].completedAt).toBe("2026-07-13T13:00:00.000Z");
    expect(repeated.current).toEqual(initial.current);
    expect(repeated.target).toEqual(initial.target);
  });

  it("marks missed work before redistributing a catch-up route", () => {
    const initial = plan();
    const caughtUp = catchUpStudyPlan(
      initial,
      "2026-07-16",
      "2026-07-16T08:00:00.000Z",
    );

    expect(
      caughtUp.tasks
        .filter((task) => task.date < "2026-07-16")
        .every((task) => task.status === "skipped"),
    ).toBe(true);
    expect(
      caughtUp.tasks.some(
        (task) => task.date > "2026-07-16" && task.status === "scheduled",
      ),
    ).toBe(true);
    expect(caughtUp.revisionReason).toContain("moved it into future");
  });

  it("groups and shifts Monday-based study weeks", () => {
    const result = plan();
    expect(studyWeekStart("2026-07-13")).toBe("2026-07-13");
    expect(studyWeekStart("2026-07-19")).toBe("2026-07-13");
    expect(shiftStudyWeek("2026-07-13", 1)).toBe("2026-07-20");
    expect(
      tasksForStudyWeek(result.tasks, "2026-07-13").length,
    ).toBeGreaterThan(0);
    expect(
      tasksForStudyWeek(result.tasks, "2026-07-13").every(
        (task) => task.date >= "2026-07-13" && task.date < "2026-07-20",
      ),
    ).toBe(true);
  });
});
