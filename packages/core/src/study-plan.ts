import { calendarDaysUntil } from "./planning";
import {
  CORE_SECTIONS,
  type CoreSection,
  type CoreSectionScores,
} from "./types";

export const STUDY_WEEKDAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export type StudyWeekday = (typeof STUDY_WEEKDAYS)[number];
export type StudyPlanTaskKind =
  "lesson" | "focus" | "review" | "timed" | "checkpoint" | "rehearsal";
export type StudyPlanTaskStatus = "scheduled" | "complete" | "skipped";
export type StudyPlanHealth = "on-track" | "tight" | "under-capacity";

export interface StudyAvailabilityEntry {
  weekday: StudyWeekday;
  minutes: number;
}

export interface StudyAvailability {
  entries: ReadonlyArray<StudyAvailabilityEntry>;
}

export interface StudySkillSignal {
  skill: string;
  label: string;
  section: CoreSection;
  mastery: number;
  evidence: number;
  nextReviewAt: string | null;
  priority?: number;
}

export interface StudyPlanTask {
  id: string;
  date: string;
  slot: number;
  kind: StudyPlanTaskKind;
  title: string;
  section: CoreSection | null;
  skill: string | null;
  skillLabel: string | null;
  minutes: number;
  reason: string;
  status: StudyPlanTaskStatus;
  locked: boolean;
  completedAt: string | null;
}

export interface StudyPlanMilestone {
  id: "first-checkpoint" | "halfway-proof" | "core-rehearsal" | "test-day";
  label: string;
  date: string;
  status: "complete" | "current" | "upcoming" | "at-risk";
}

export interface StudyPlanForecast {
  health: StudyPlanHealth;
  weeklyCapacity: number;
  scheduledMinutes: number;
  recommendedMinutes: number;
  capacityRatio: number;
  completionRate: number;
  readiness: number;
  evidenceCoverage: number;
  message: string;
}

export interface AdaptiveStudyPlan {
  version: 1;
  copyVersion: 2;
  today: string;
  testDate: string;
  current: CoreSectionScores;
  target: CoreSectionScores;
  availability: StudyAvailability;
  skills: ReadonlyArray<StudySkillSignal>;
  tasks: ReadonlyArray<StudyPlanTask>;
  milestones: ReadonlyArray<StudyPlanMilestone>;
  forecast: StudyPlanForecast;
  revision: number;
  revisionReason: string;
  generatedAt: string;
  updatedAt: string;
}

export interface GenerateStudyPlanInput {
  today: string;
  testDate: string;
  current: CoreSectionScores;
  target: CoreSectionScores;
  skills: ReadonlyArray<StudySkillSignal>;
  availability?: StudyAvailability;
  generatedAt?: string;
}

export interface RebalanceStudyPlanInput {
  today?: string;
  availability?: StudyAvailability;
  skills?: ReadonlyArray<StudySkillSignal>;
  updatedAt?: string;
  reason?: string;
}

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DEFAULT_AVAILABILITY: StudyAvailability = {
  entries: ["mon", "tue", "wed", "thu", "fri"].map((weekday) => ({
    weekday: weekday as StudyWeekday,
    minutes: 30,
  })),
};
const WEEKDAY_BY_UTC_DAY: ReadonlyArray<StudyWeekday> = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

function parseDate(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new RangeError("Study-plan dates must use YYYY-MM-DD.");
  const [, yearText, monthText, dayText] = match;
  const timestamp = Date.UTC(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
  );
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== Number(yearText) ||
    date.getUTCMonth() !== Number(monthText) - 1 ||
    date.getUTCDate() !== Number(dayText)
  ) {
    throw new RangeError("Study-plan date is not a valid calendar day.");
  }
  return timestamp;
}

function dateFromTimestamp(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  return dateFromTimestamp(parseDate(value) + days * DAY_MS);
}

function dateRange(start: string, endExclusive: string) {
  const startTime = parseDate(start);
  const endTime = parseDate(endExclusive);
  const values: string[] = [];
  for (let timestamp = startTime; timestamp < endTime; timestamp += DAY_MS) {
    values.push(dateFromTimestamp(timestamp));
  }
  return values;
}

function validateScores(scores: CoreSectionScores, label: string) {
  for (const section of CORE_SECTIONS) {
    if (
      !Number.isInteger(scores[section]) ||
      scores[section] < 1 ||
      scores[section] > 36
    ) {
      throw new RangeError(
        `${label} ${section} score must be an integer from 1 to 36.`,
      );
    }
  }
}

export function normalizeStudyAvailability(
  availability: StudyAvailability = DEFAULT_AVAILABILITY,
): StudyAvailability {
  if (!availability || !Array.isArray(availability.entries)) {
    throw new RangeError("Study availability must include day entries.");
  }
  const seen = new Set<StudyWeekday>();
  const entries = availability.entries.map((entry) => {
    if (!STUDY_WEEKDAYS.includes(entry.weekday) || seen.has(entry.weekday)) {
      throw new RangeError("Study days must be unique valid weekdays.");
    }
    if (
      !Number.isInteger(entry.minutes) ||
      entry.minutes < 15 ||
      entry.minutes > 120
    ) {
      throw new RangeError(
        "Study-day minutes must be an integer from 15 to 120.",
      );
    }
    seen.add(entry.weekday);
    return { weekday: entry.weekday, minutes: entry.minutes };
  });
  if (entries.length === 0)
    throw new RangeError("Choose at least one study day.");
  return {
    entries: [...entries].sort(
      (left, right) =>
        STUDY_WEEKDAYS.indexOf(left.weekday) -
        STUDY_WEEKDAYS.indexOf(right.weekday),
    ),
  };
}

function normalizeSkills(skills: ReadonlyArray<StudySkillSignal>) {
  if (!Array.isArray(skills) || skills.length === 0) {
    throw new RangeError(
      "At least one skill signal is required to build a plan.",
    );
  }
  const seen = new Set<string>();
  return skills.map((skill) => {
    if (!skill.skill.trim() || !skill.label.trim() || seen.has(skill.skill)) {
      throw new RangeError("Study skills require unique slugs and labels.");
    }
    if (!CORE_SECTIONS.includes(skill.section)) {
      throw new RangeError("Study skill section is invalid.");
    }
    if (
      !Number.isFinite(skill.mastery) ||
      skill.mastery < 0 ||
      skill.mastery > 1 ||
      !Number.isFinite(skill.evidence) ||
      skill.evidence < 0 ||
      (skill.priority !== undefined &&
        (!Number.isFinite(skill.priority) ||
          skill.priority < 0 ||
          skill.priority > 1))
    ) {
      throw new RangeError("Study skill mastery evidence is invalid.");
    }
    if (
      skill.nextReviewAt !== null &&
      Number.isNaN(new Date(skill.nextReviewAt).getTime())
    ) {
      throw new RangeError("Study skill review date is invalid.");
    }
    seen.add(skill.skill);
    return { ...skill };
  });
}

function sectionMovement(
  current: CoreSectionScores,
  target: CoreSectionScores,
) {
  return Object.fromEntries(
    CORE_SECTIONS.map((section) => [
      section,
      Math.max(0, target[section] - current[section]),
    ]),
  ) as Record<CoreSection, number>;
}

function weeklyCapacity(availability: StudyAvailability) {
  return availability.entries.reduce((sum, entry) => sum + entry.minutes, 0);
}

function splitMinutes(minutes: number) {
  if (minutes <= 35) return [minutes];
  if (minutes <= 60) return [20, minutes - 20];
  return [25, 25, minutes - 50];
}

function checkpointInterval(daysUntilTest: number) {
  if (daysUntilTest >= 85) return 14;
  if (daysUntilTest >= 7) return 7;
  return 3;
}

function phaseCycle(daysUntilTest: number): ReadonlyArray<StudyPlanTaskKind> {
  if (daysUntilTest >= 85) {
    return ["lesson", "focus", "lesson", "focus", "review", "focus", "timed"];
  }
  if (daysUntilTest >= 35) {
    return ["lesson", "focus", "review", "focus", "timed", "focus", "timed"];
  }
  if (daysUntilTest >= 7) {
    return ["focus", "review", "timed", "focus", "timed", "review"];
  }
  return ["review", "timed", "focus", "timed"];
}

function rankSkills(
  skills: ReadonlyArray<StudySkillSignal>,
  current: CoreSectionScores,
  target: CoreSectionScores,
  taskDate: string,
  kind: StudyPlanTaskKind,
) {
  const movement = sectionMovement(current, target);
  return [...skills].sort((left, right) => {
    const score = (skill: StudySkillSignal) => {
      const weakness = 1 - skill.mastery;
      const uncertainty = 1 - Math.min(1, skill.evidence / 6);
      const opportunity = movement[skill.section] / 35;
      const reviewDue =
        skill.nextReviewAt && skill.nextReviewAt.slice(0, 10) <= taskDate
          ? 1
          : 0;
      return (
        weakness * (kind === "lesson" ? 0.48 : 0.4) +
        uncertainty * (kind === "lesson" ? 0.28 : 0.12) +
        opportunity * 0.3 +
        reviewDue * (kind === "review" ? 0.42 : 0.08) +
        (skill.priority ?? 0) * 0.35
      );
    };
    return score(right) - score(left) || left.label.localeCompare(right.label);
  });
}

function sectionLabel(section: CoreSection) {
  return section[0].toUpperCase() + section.slice(1);
}

function chooseRankedSkill(
  ranked: ReadonlyArray<StudySkillSignal>,
  current: CoreSectionScores,
  target: CoreSectionScores,
  index: number,
) {
  if (index === 0) {
    const recommended = [...ranked].sort(
      (left, right) => (right.priority ?? 0) - (left.priority ?? 0),
    )[0];
    if ((recommended?.priority ?? 0) > 0) return recommended;
  }
  const movement = sectionMovement(current, target);
  const sections = [...CORE_SECTIONS].sort(
    (left, right) => movement[right] - movement[left],
  );
  const sectionRotation = [sections[0], sections[1], sections[0], sections[2]];
  const preferredSection = sectionRotation[index % sectionRotation.length];
  const candidates = ranked.filter(
    (skill) => skill.section === preferredSection,
  );
  return (
    candidates[index % Math.min(2, candidates.length)] ??
    ranked[index % ranked.length]
  );
}

function taskCopy(
  kind: StudyPlanTaskKind,
  skill: StudySkillSignal | null,
  fallbackSection: CoreSection,
  current: CoreSectionScores,
  target: CoreSectionScores,
  taskDate: string,
) {
  if (kind === "checkpoint") {
    return {
      title: "3-skill progress check",
      reason:
        "This date reached Scout’s fixed checkpoint interval. The check samples three currently prioritized skills; each answer updates only its tested skill.",
    };
  }
  if (kind === "rehearsal") {
    return {
      title: "Half-length 66-question rehearsal",
      reason:
        "This is the final allowed study date before test day, so the fixed schedule rule placed the 66-question English, Math, and Reading rehearsal here. Results currently stay in Timed practice and do not update this calendar.",
    };
  }
  if (!skill) throw new RangeError("A skill task requires a skill signal.");
  const estimate = Math.round(skill.mastery * 100);
  const evidence = Math.round(skill.evidence);
  const movement = Math.max(0, target[skill.section] - current[skill.section]);
  const reviewDue =
    skill.nextReviewAt && skill.nextReviewAt.slice(0, 10) <= taskDate;
  const inputs = `${estimate}% BKT estimate; ${evidence} scored ${evidence === 1 ? "answer" : "answers"}; ${sectionLabel(skill.section)} planning target +${movement}; stored review ${reviewDue ? "due" : "not due"}`;
  if (kind === "lesson") {
    return {
      title: `${skill.label} lesson`,
      reason: `${inputs}. The fixed phase cycle calls for a lesson in this slot; Scout’s ranking selected ${skill.label}.`,
    };
  }
  if (kind === "review") {
    return {
      title: `${skill.label} review`,
      reason: `${inputs}. The fixed phase cycle calls for review in this slot; a due stored-review date adds extra ranking weight.`,
    };
  }
  if (kind === "timed") {
    return {
      title: `${sectionLabel(skill.section ?? fallbackSection)} timed practice`,
      reason: `${inputs}. The fixed phase cycle calls for timed practice in this slot. Timed-practice results currently stay on that screen and do not update this calendar.`,
    };
  }
  return {
    title: `${skill.label} lesson + focused set`,
    reason: `${inputs}. The fixed phase cycle calls for focused practice in this slot; Scout’s ranking selected ${skill.label}.`,
  };
}

function taskId(
  date: string,
  slot: number,
  kind: StudyPlanTaskKind,
  skill: string | null,
) {
  return `${date}-${slot}-${kind}-${skill ?? "mixed"}`.replace(
    /[^a-z0-9-]/gi,
    "-",
  );
}

function buildTasks(
  input: Pick<
    AdaptiveStudyPlan,
    "today" | "testDate" | "current" | "target" | "availability" | "skills"
  >,
) {
  const daysUntilTest = calendarDaysUntil(input.today, input.testDate);
  const minutesByWeekday = new Map(
    input.availability.entries.map((entry) => [entry.weekday, entry.minutes]),
  );
  const availableDates = dateRange(input.today, input.testDate).filter((date) =>
    minutesByWeekday.has(
      WEEKDAY_BY_UTC_DAY[new Date(`${date}T00:00:00.000Z`).getUTCDay()],
    ),
  );
  if (availableDates.length === 0) return [];

  const interval = checkpointInterval(daysUntilTest);
  const checkpointDates = new Set<string>();
  let checkpointTarget = interval;
  for (const date of availableDates) {
    const offset = calendarDaysUntil(input.today, date);
    if (offset >= checkpointTarget) {
      checkpointDates.add(date);
      checkpointTarget += interval;
    }
  }
  const rehearsalDate = availableDates.at(-1) ?? null;
  const cycle = phaseCycle(daysUntilTest);
  const tasks: StudyPlanTask[] = [];
  let ordinaryIndex = 0;

  for (const date of availableDates) {
    const weekday =
      WEEKDAY_BY_UTC_DAY[new Date(`${date}T00:00:00.000Z`).getUTCDay()];
    const minutes = minutesByWeekday.get(weekday);
    if (!minutes) continue;
    const chunks = splitMinutes(minutes);
    for (let slot = 0; slot < chunks.length; slot += 1) {
      let kind = cycle[ordinaryIndex % cycle.length];
      if (slot === 0 && date === rehearsalDate && daysUntilTest >= 4)
        kind = "rehearsal";
      else if (slot === 0 && checkpointDates.has(date)) kind = "checkpoint";

      const ranked = rankSkills(
        input.skills,
        input.current,
        input.target,
        date,
        kind,
      );
      const skill =
        kind === "checkpoint" || kind === "rehearsal"
          ? null
          : chooseRankedSkill(
              ranked,
              input.current,
              input.target,
              ordinaryIndex,
            );
      const movement = sectionMovement(input.current, input.target);
      const fallbackSection = [...CORE_SECTIONS].sort(
        (left, right) => movement[right] - movement[left],
      )[ordinaryIndex % CORE_SECTIONS.length];
      const copy = taskCopy(
        kind,
        skill,
        fallbackSection,
        input.current,
        input.target,
        date,
      );
      tasks.push({
        id: taskId(date, slot, kind, skill?.skill ?? null),
        date,
        slot,
        kind,
        title: copy.title,
        section: skill?.section ?? (kind === "timed" ? fallbackSection : null),
        skill: skill?.skill ?? null,
        skillLabel: skill?.label ?? null,
        minutes: chunks[slot],
        reason: copy.reason,
        status: "scheduled",
        locked: date <= input.today,
        completedAt: null,
      });
      if (kind !== "checkpoint" && kind !== "rehearsal") ordinaryIndex += 1;
    }
  }
  return tasks;
}

function taskForKind(
  tasks: ReadonlyArray<StudyPlanTask>,
  kind: StudyPlanTaskKind,
) {
  return tasks.find((task) => task.kind === kind);
}

function milestoneStatus(
  date: string,
  today: string,
  task: StudyPlanTask | undefined,
): StudyPlanMilestone["status"] {
  if (task?.status === "complete") return "complete";
  if (date === today) return "current";
  if (date < today) return "at-risk";
  return "upcoming";
}

function buildMilestones(
  today: string,
  testDate: string,
  tasks: ReadonlyArray<StudyPlanTask>,
): StudyPlanMilestone[] {
  const firstCheckpoint = taskForKind(tasks, "checkpoint");
  const rehearsal = taskForKind(tasks, "rehearsal");
  const halfwayTarget = addDays(
    today,
    Math.max(1, Math.floor(calendarDaysUntil(today, testDate) / 2)),
  );
  const halfwayTask = [...tasks].sort(
    (left, right) =>
      Math.abs(calendarDaysUntil(halfwayTarget, left.date)) -
      Math.abs(calendarDaysUntil(halfwayTarget, right.date)),
  )[0];
  const firstCheckpointDate =
    firstCheckpoint?.date ?? halfwayTask?.date ?? today;
  const halfwayDate = halfwayTask?.date ?? firstCheckpointDate;
  const rehearsalDate =
    rehearsal?.date ?? tasks.at(-1)?.date ?? addDays(testDate, -1);
  return [
    {
      id: "first-checkpoint",
      label: "First progress check",
      date: firstCheckpointDate,
      status: milestoneStatus(firstCheckpointDate, today, firstCheckpoint),
    },
    {
      id: "halfway-proof",
      label: "Halfway progress check",
      date: halfwayDate,
      status: milestoneStatus(halfwayDate, today, halfwayTask),
    },
    {
      id: "core-rehearsal",
      label: "Final practice test",
      date: rehearsalDate,
      status: milestoneStatus(rehearsalDate, today, rehearsal),
    },
    {
      id: "test-day",
      label: "ACT test day",
      date: testDate,
      status:
        testDate === today
          ? "current"
          : testDate < today
            ? "at-risk"
            : "upcoming",
    },
  ];
}

function buildForecast(
  plan: Pick<
    AdaptiveStudyPlan,
    | "today"
    | "testDate"
    | "current"
    | "target"
    | "availability"
    | "skills"
    | "tasks"
  >,
): StudyPlanForecast {
  const movement = sectionMovement(plan.current, plan.target);
  const totalMovement = CORE_SECTIONS.reduce(
    (sum, section) => sum + movement[section],
    0,
  );
  const developingSkills = plan.skills.filter(
    (skill) => skill.mastery < 0.65,
  ).length;
  const recommendedMinutes = 120 + totalMovement * 25 + developingSkills * 15;
  const scheduledMinutes = plan.tasks
    .filter((task) => task.status !== "skipped")
    .reduce((sum, task) => sum + task.minutes, 0);
  const capacityRatio =
    recommendedMinutes === 0 ? 1 : scheduledMinutes / recommendedMinutes;
  const health: StudyPlanHealth =
    capacityRatio >= 0.95
      ? "on-track"
      : capacityRatio >= 0.72
        ? "tight"
        : "under-capacity";
  const dueTasks = plan.tasks.filter((task) => task.date <= plan.today);
  const completionRate = dueTasks.length
    ? dueTasks.filter((task) => task.status === "complete").length /
      dueTasks.length
    : 0;
  const evidenceCoverage =
    plan.skills.filter((skill) => skill.evidence >= 2).length /
    plan.skills.length;
  const averageMastery =
    plan.skills.reduce((sum, skill) => sum + skill.mastery, 0) /
    plan.skills.length;
  const readiness = Math.round(
    Math.min(
      1,
      averageMastery * 0.55 + evidenceCoverage * 0.25 + completionRate * 0.2,
    ) * 100,
  );
  const message =
    health === "on-track"
      ? "You have enough study time scheduled for the current plan. Quick quizzes may still change what comes next."
      : health === "tight"
        ? "The plan can work, but missed sessions will matter. Add one short study block or use catch-up soon."
        : "Your current schedule does not have enough study time for this goal. Add more time or lower the goal for now.";
  return {
    health,
    weeklyCapacity: weeklyCapacity(plan.availability),
    scheduledMinutes,
    recommendedMinutes,
    capacityRatio,
    completionRate,
    readiness,
    evidenceCoverage,
    message,
  };
}

function validatePlanWindow(today: string, testDate: string) {
  const daysUntilTest = calendarDaysUntil(today, testDate);
  if (
    !Number.isInteger(daysUntilTest) ||
    daysUntilTest < 1 ||
    daysUntilTest > 730
  ) {
    throw new RangeError(
      "Test day must be 1 to 730 calendar days after today.",
    );
  }
}

export function generateStudyPlan(
  input: GenerateStudyPlanInput,
): AdaptiveStudyPlan {
  validatePlanWindow(input.today, input.testDate);
  validateScores(input.current, "Current");
  validateScores(input.target, "Target");
  for (const section of CORE_SECTIONS) {
    if (input.target[section] < input.current[section]) {
      throw new RangeError(
        "Target section scores cannot be below current scores.",
      );
    }
  }
  const availability = normalizeStudyAvailability(input.availability);
  const skills = normalizeSkills(input.skills);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const shell = {
    today: input.today,
    testDate: input.testDate,
    current: { ...input.current },
    target: { ...input.target },
    availability,
    skills,
  };
  const tasks = buildTasks(shell);
  const plan: AdaptiveStudyPlan = {
    version: 1,
    copyVersion: 2,
    ...shell,
    tasks,
    milestones: buildMilestones(input.today, input.testDate, tasks),
    forecast: {} as StudyPlanForecast,
    revision: 1,
    revisionReason:
      "Scout built this plan from your starting scores, goal scores, study time, and skill results.",
    generatedAt,
    updatedAt: generatedAt,
  };
  return { ...plan, forecast: buildForecast(plan) };
}

function mergePreservedTasks(
  existing: AdaptiveStudyPlan,
  generated: ReadonlyArray<StudyPlanTask>,
  today: string,
) {
  const frozenDates = new Set(
    existing.tasks
      .filter((task) => task.date <= today || task.status === "complete")
      .map((task) => task.date),
  );
  const preserved = existing.tasks.filter(
    (task) => task.date <= today || task.status === "complete",
  );
  const previousById = new Map(existing.tasks.map((task) => [task.id, task]));
  const future = generated
    .filter((task) => !frozenDates.has(task.date))
    .map((task) => {
      const previous = previousById.get(task.id);
      return previous
        ? {
            ...task,
            status: previous.status,
            completedAt: previous.completedAt,
          }
        : task;
    });
  return [...preserved, ...future].sort(
    (left, right) =>
      left.date.localeCompare(right.date) || left.slot - right.slot,
  );
}

export function rebalanceStudyPlan(
  existing: AdaptiveStudyPlan,
  input: RebalanceStudyPlanInput,
): AdaptiveStudyPlan {
  const today = input.today ?? existing.today;
  validatePlanWindow(today, existing.testDate);
  const availability = normalizeStudyAvailability(
    input.availability ?? existing.availability,
  );
  const skills = normalizeSkills(input.skills ?? existing.skills);
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const generated = buildTasks({ ...existing, today, availability, skills });
  const tasks = mergePreservedTasks(existing, generated, today);
  const plan: AdaptiveStudyPlan = {
    ...existing,
    today,
    availability,
    skills,
    tasks,
    milestones: buildMilestones(today, existing.testDate, tasks),
    forecast: existing.forecast,
    revision: existing.revision + 1,
    revisionReason:
      input.reason ??
      "Scout updated your future work from your new schedule and recent answers. Today’s work and finished tasks did not change.",
    updatedAt,
  };
  return { ...plan, forecast: buildForecast(plan) };
}

export function setStudyPlanTaskStatus(
  existing: AdaptiveStudyPlan,
  taskId: string,
  status: StudyPlanTaskStatus,
  updatedAt = new Date().toISOString(),
): AdaptiveStudyPlan {
  if (!taskId) throw new RangeError("A study-plan task ID is required.");
  let found = false;
  const tasks = existing.tasks.map((task) => {
    if (task.id !== taskId) return task;
    found = true;
    return {
      ...task,
      status,
      completedAt:
        status === "complete" ? (task.completedAt ?? updatedAt) : null,
    };
  });
  if (!found) throw new RangeError("Study-plan task not found.");
  const plan: AdaptiveStudyPlan = {
    ...existing,
    tasks,
    milestones: buildMilestones(existing.today, existing.testDate, tasks),
    forecast: existing.forecast,
    revision: existing.revision + 1,
    revisionReason:
      status === "complete"
        ? "Scout marked this task complete without moving the rest of today’s work."
        : "You changed a task. Scout can still move future work if needed.",
    updatedAt,
  };
  return { ...plan, forecast: buildForecast(plan) };
}

export function catchUpStudyPlan(
  existing: AdaptiveStudyPlan,
  today: string,
  updatedAt = new Date().toISOString(),
) {
  const withMissedTasks: AdaptiveStudyPlan = {
    ...existing,
    tasks: existing.tasks.map((task) =>
      task.date < today && task.status === "scheduled"
        ? { ...task, status: "skipped" as const }
        : task,
    ),
  };
  return rebalanceStudyPlan(withMissedTasks, {
    today,
    updatedAt,
    reason:
      "Scout marked the missed work and moved it into future study sessions.",
  });
}

export function tasksForStudyWeek(
  tasks: ReadonlyArray<StudyPlanTask>,
  weekStart: string,
) {
  const weekEnd = addDays(weekStart, 7);
  return tasks.filter((task) => task.date >= weekStart && task.date < weekEnd);
}

export function studyWeekStart(value: string) {
  const timestamp = parseDate(value);
  const day = new Date(timestamp).getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return dateFromTimestamp(timestamp - daysSinceMonday * DAY_MS);
}

export function shiftStudyWeek(weekStart: string, weeks: number) {
  if (!Number.isInteger(weeks))
    throw new RangeError("Week shift must be an integer.");
  return addDays(weekStart, weeks * 7);
}
