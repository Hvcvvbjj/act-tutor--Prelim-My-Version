import { randomUUID } from "node:crypto";

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

import {
  resolveJsonDocumentStore,
  type JsonDocumentStore,
} from "./atomic-json-repository";

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
  private readonly store: JsonDocumentStore;

  constructor(
    source: string | JsonDocumentStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    this.store = resolveJsonDocumentStore(source);
  }

  private async readStore(): Promise<StudyPlanStoreFile> {
    const value = await this.store.read();
    if (value === null) return structuredClone(EMPTY_STORE);
    const parsed = value as StudyPlanStoreFile;
    if (parsed.version !== 1 || !parsed.sessions) {
      throw new Error("Unsupported study-plan store format.");
    }
    return parsed;
  }

  private async writeStore(store: StudyPlanStoreFile) {
    await this.store.write(store);
  }

  private async transact<T>(
    operation: (store: StudyPlanStoreFile) => Promise<T> | T,
  ): Promise<T> {
    const previous = queues.get(this.store.key) ?? Promise.resolve();
    let release: () => void = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    queues.set(this.store.key, tail);
    await previous;
    try {
      return await operation(await this.readStore());
    } finally {
      release();
      if (queues.get(this.store.key) === tail) queues.delete(this.store.key);
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
      const samePlanWindow =
        existing &&
        existing.plan.copyVersion === 2 &&
        existing.plan.today === input.today &&
        existing.plan.testDate === input.testDate &&
        sameScores(existing.plan.current, input.current) &&
        sameScores(existing.plan.target, input.target);
      if (existing && samePlanWindow) {
        const availabilityChanged =
          input.availability &&
          !sameAvailability(existing.plan.availability, input.availability);
        const skillsChanged = !sameSkills(existing.plan.skills, input.skills);
        if (!availabilityChanged && !skillsChanged) {
          return { sessionId: existing.id, plan: existing.plan };
        }
        const now = this.now();
        existing.plan = rebalanceStudyPlan(existing.plan, {
          ...(availabilityChanged ? { availability: input.availability } : {}),
          ...(skillsChanged ? { skills: input.skills } : {}),
          updatedAt: now,
          reason:
            "Calendar capacity or skill evidence changed, so Scout rebuilt future dates. Tasks dated today and completed tasks were kept.",
        });
        existing.updatedAt = now;
        await this.writeStore(store);
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
