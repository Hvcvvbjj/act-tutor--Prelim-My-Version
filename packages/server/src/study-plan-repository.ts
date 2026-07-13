import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  catchUpStudyPlan,
  generateStudyPlan,
  rebalanceStudyPlan,
  setStudyPlanTaskStatus,
  type AdaptiveStudyPlan,
  type GenerateStudyPlanInput,
  type StudyAvailability,
  type StudyPlanTaskStatus,
  type StudySkillSignal,
} from "@act-tutor/core";

interface StoredStudyPlanSession {
  id: string;
  plan: AdaptiveStudyPlan;
  createdAt: string;
  updatedAt: string;
}

interface StudyPlanStoreFile {
  version: 1;
  sessions: Record<string, StoredStudyPlanSession>;
}

const EMPTY_STORE: StudyPlanStoreFile = { version: 1, sessions: {} };
const queues = new Map<string, Promise<void>>();

function sameScores(
  left: AdaptiveStudyPlan["current"],
  right: AdaptiveStudyPlan["current"],
) {
  return (
    left.english === right.english &&
    left.math === right.math &&
    left.reading === right.reading
  );
}

function sameAvailability(left: StudyAvailability, right: StudyAvailability) {
  return JSON.stringify(left.entries) === JSON.stringify(right.entries);
}

function sameSkills(
  left: ReadonlyArray<StudySkillSignal>,
  right: ReadonlyArray<StudySkillSignal>,
) {
  if (left.length !== right.length) return false;
  const rightBySkill = new Map(right.map((skill) => [skill.skill, skill]));
  return left.every((skill) => {
    const candidate = rightBySkill.get(skill.skill);
    return (
      candidate?.label === skill.label &&
      candidate.section === skill.section &&
      candidate.mastery === skill.mastery &&
      candidate.evidence === skill.evidence &&
      candidate.nextReviewAt === skill.nextReviewAt &&
      candidate.priority === skill.priority
    );
  });
}

export class FileStudyPlanRepository {
  constructor(
    private readonly filePath: string,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  private async readStore(): Promise<StudyPlanStoreFile> {
    try {
      const parsed = JSON.parse(
        await readFile(this.filePath, "utf8"),
      ) as StudyPlanStoreFile;
      if (parsed.version !== 1 || !parsed.sessions) {
        throw new Error("Unsupported study-plan store format.");
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return structuredClone(EMPTY_STORE);
      }
      throw error;
    }
  }

  private async writeStore(store: StudyPlanStoreFile) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  private async transact<T>(
    operation: (store: StudyPlanStoreFile) => Promise<T> | T,
  ): Promise<T> {
    const previous = queues.get(this.filePath) ?? Promise.resolve();
    let release: () => void = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    queues.set(this.filePath, tail);
    await previous;
    try {
      return await operation(await this.readStore());
    } finally {
      release();
      if (queues.get(this.filePath) === tail) queues.delete(this.filePath);
    }
  }

  async get(sessionId: string) {
    return this.transact((store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Study plan not found.");
      return session.plan;
    });
  }

  async getOrCreate(sessionId: string | null, input: GenerateStudyPlanInput) {
    return this.transact(async (store) => {
      const existing = sessionId ? store.sessions[sessionId] : undefined;
      if (
        existing &&
        existing.plan.copyVersion === 2 &&
        existing.plan.today === input.today &&
        existing.plan.testDate === input.testDate &&
        sameScores(existing.plan.current, input.current) &&
        sameScores(existing.plan.target, input.target)
      ) {
        return { sessionId: existing.id, plan: existing.plan };
      }

      const now = this.now();
      const created: StoredStudyPlanSession = {
        id: randomUUID(),
        plan: generateStudyPlan({ ...input, generatedAt: now }),
        createdAt: now,
        updatedAt: now,
      };
      store.sessions[created.id] = created;
      if (existing) delete store.sessions[existing.id];
      await this.writeStore(store);
      return { sessionId: created.id, plan: created.plan };
    });
  }

  async updateAvailability(sessionId: string, availability: StudyAvailability) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Study plan not found.");
      if (sameAvailability(session.plan.availability, availability))
        return session.plan;
      const now = this.now();
      session.plan = rebalanceStudyPlan(session.plan, {
        availability,
        updatedAt: now,
        reason:
          "Your schedule changed, so Scout moved future work. Today’s work and finished tasks did not change.",
      });
      session.updatedAt = now;
      await this.writeStore(store);
      return session.plan;
    });
  }

  async syncEvidence(
    sessionId: string,
    skills: ReadonlyArray<StudySkillSignal>,
  ) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Study plan not found.");
      if (sameSkills(session.plan.skills, skills)) return session.plan;
      const now = this.now();
      session.plan = rebalanceStudyPlan(session.plan, {
        skills,
        updatedAt: now,
        reason:
          "Your recent answers changed what comes next. Today’s work and finished tasks did not change.",
      });
      session.updatedAt = now;
      await this.writeStore(store);
      return session.plan;
    });
  }

  async setTaskStatus(
    sessionId: string,
    taskId: string,
    status: StudyPlanTaskStatus,
  ) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Study plan not found.");
      const currentTask = session.plan.tasks.find((task) => task.id === taskId);
      if (!currentTask) throw new RangeError("Study-plan task not found.");
      if (currentTask.status === status) return session.plan;
      const now = this.now();
      session.plan = setStudyPlanTaskStatus(session.plan, taskId, status, now);
      session.updatedAt = now;
      await this.writeStore(store);
      return session.plan;
    });
  }

  async catchUp(sessionId: string, today: string) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Study plan not found.");
      const now = this.now();
      session.plan = catchUpStudyPlan(session.plan, today, now);
      session.updatedAt = now;
      await this.writeStore(store);
      return session.plan;
    });
  }

  async reset(sessionId: string) {
    return this.transact(async (store) => {
      if (!store.sessions[sessionId]) return;
      delete store.sessions[sessionId];
      await this.writeStore(store);
    });
  }
}
