import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { GenerateStudyPlanInput, StudySkillSignal } from "@act-tutor/core";
import { afterEach, describe, expect, it } from "vitest";

import { FileStudyPlanRepository } from "./study-plan-repository";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const SKILLS: StudySkillSignal[] = [
  {
    skill: "boundaries",
    label: "Sentence boundaries",
    section: "english",
    mastery: 0.4,
    evidence: 2,
    nextReviewAt: null,
  },
  {
    skill: "concision",
    label: "Concision",
    section: "english",
    mastery: 0.55,
    evidence: 1,
    nextReviewAt: null,
  },
  {
    skill: "linear",
    label: "Linear equations",
    section: "math",
    mastery: 0.32,
    evidence: 3,
    nextReviewAt: null,
  },
  {
    skill: "geometry",
    label: "Geometry",
    section: "math",
    mastery: 0.5,
    evidence: 2,
    nextReviewAt: null,
  },
  {
    skill: "inference",
    label: "Supported inference",
    section: "reading",
    mastery: 0.42,
    evidence: 4,
    nextReviewAt: null,
  },
  {
    skill: "purpose",
    label: "Author purpose",
    section: "reading",
    mastery: 0.6,
    evidence: 2,
    nextReviewAt: null,
  },
];

const INPUT: GenerateStudyPlanInput = {
  today: "2026-07-13",
  testDate: "2026-08-18",
  current: { english: 26, math: 20, reading: 25 },
  target: { english: 31, math: 31, reading: 29 },
  skills: SKILLS,
};

async function repository() {
  const directory = await mkdtemp(join(tmpdir(), "act-study-plan-"));
  temporaryDirectories.push(directory);
  const filePath = join(directory, "plans.json");
  let tick = 0;
  const now = () => `2026-07-13T12:00:0${tick++}.000Z`;
  return { filePath, repo: new FileStudyPlanRepository(filePath, now) };
}

describe("FileStudyPlanRepository", () => {
  it("persists and resumes one cookie-bound plan", async () => {
    const { filePath, repo } = await repository();
    const started = await repo.getOrCreate(null, INPUT);
    const resumed = await new FileStudyPlanRepository(filePath).get(
      started.sessionId,
    );

    expect(resumed.tasks).toEqual(started.plan.tasks);
    expect(JSON.parse(await readFile(filePath, "utf8")).version).toBe(1);
  });

  it("updates availability and freezes today's tasks", async () => {
    const { repo } = await repository();
    const started = await repo.getOrCreate(null, INPUT);
    const todayTasks = started.plan.tasks.filter(
      (task) => task.date === INPUT.today,
    );
    const updated = await repo.updateAvailability(started.sessionId, {
      entries: [
        { weekday: "mon", minutes: 60 },
        { weekday: "wed", minutes: 45 },
        { weekday: "sat", minutes: 30 },
      ],
    });

    expect(updated.forecast.weeklyCapacity).toBe(135);
    expect(updated.tasks.filter((task) => task.date === INPUT.today)).toEqual(
      todayTasks,
    );
    expect(updated.revisionReason).toContain("schedule changed");
  });

  it("idempotently records completion", async () => {
    const { repo } = await repository();
    const started = await repo.getOrCreate(null, INPUT);
    const task = started.plan.tasks[0];
    const completed = await repo.setTaskStatus(
      started.sessionId,
      task.id,
      "complete",
    );
    const duplicate = await repo.setTaskStatus(
      started.sessionId,
      task.id,
      "complete",
    );

    expect(duplicate.revision).toBe(completed.revision);
    expect(duplicate.tasks[0].status).toBe("complete");
    expect(duplicate.tasks[0].completedAt).toBe(completed.tasks[0].completedAt);
  });

  it("reorders future work when mastery evidence changes", async () => {
    const { repo } = await repository();
    const started = await repo.getOrCreate(null, INPUT);
    const before = started.plan.tasks
      .filter((task) => task.date > INPUT.today && task.skill)
      .map((task) => task.skill);
    const synced = await repo.syncEvidence(
      started.sessionId,
      SKILLS.map((skill) =>
        skill.skill === "linear"
          ? { ...skill, mastery: 0.91, evidence: 10 }
          : skill.skill === "purpose"
            ? { ...skill, mastery: 0.21, evidence: 5 }
            : skill,
      ),
    );
    const after = synced.tasks
      .filter((task) => task.date > INPUT.today && task.skill)
      .map((task) => task.skill);

    expect(after).not.toEqual(before);
    expect(synced.revisionReason).toContain("recent answers");
  });

  it("replaces a stale plan when baseline identity changes", async () => {
    const { repo } = await repository();
    const first = await repo.getOrCreate(null, INPUT);
    const replacement = await repo.getOrCreate(first.sessionId, {
      ...INPUT,
      current: { english: 27, math: 22, reading: 26 },
    });

    expect(replacement.sessionId).not.toBe(first.sessionId);
    await expect(repo.get(first.sessionId)).rejects.toThrow("not found");
  });
});
