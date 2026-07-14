"use client"

import { useEffect, useMemo, useState } from "react"
import type { LearningSessionPayload } from "@act-tutor/core"
import {
  BrainCircuitIcon,
  CloudOffIcon,
  DownloadIcon,
  GaugeIcon,
  GraduationCapIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react"

import { ScoutCoach } from "@/components/tutor/scout"
import { useScoutContext } from "@/components/tutor/scout-assistant"
import type { GeneratedPlan } from "@/components/tutor/types"
import { Button } from "@/components/ui/button"

interface ScoutOperationsLabProps {
  plan: GeneratedPlan
  learning: LearningSessionPayload
  busy: boolean
  onCorrectModel: (input: {
    skill: string
    kind: "too-high" | "too-low" | "wrong-misconception"
    note: string
  }) => void
  onTutorOverride: (input: { skill: string; reason: string }) => void
  onStartChallenge: (skill?: string) => void
  onStartRecovery: () => void
  onDeleteData: () => void
  onContentDecision: (input: {
    approved: boolean
    editedExplanation?: string
  }) => void
}

type LabView = "learner" | "act" | "coach" | "trust"

interface FairnessAuditRecord {
  group: string
  questionSelectionRate: number
  predictionError: number
  stoppingQuestions: number
}

interface FairnessAuditRow extends FairnessAuditRecord {
  records: number
}

interface PolicySimulationResult {
  policy: string
  startingMastery: number
  endingMastery: number
  gain: number
}

const ACT_SECTIONS = [
  { id: "english", label: "English", questions: 50, minutes: 35 },
  { id: "math", label: "Math", questions: 45, minutes: 50 },
  { id: "reading", label: "Reading", questions: 36, minutes: 40 },
] as const

function copyText(value: string) {
  return navigator.clipboard.writeText(value)
}

function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function simulatePolicies(learning: LearningSessionPayload) {
  const starting = learning.learningTwin.skills.map((skill) => ({
    mastery: skill.learnedProbability,
    uncertainty: skill.uncertainty,
  }))
  const policies = [
    "Scout adaptive",
    "Weakest only",
    "Explore uncertainty",
    "Random control",
  ] as const
  return policies.map((policy, policyIndex): PolicySimulationResult => {
    const random = seededRandom(3417 + policyIndex * 911)
    let startingTotal = 0
    let endingTotal = 0
    for (let learnerIndex = 0; learnerIndex < 100; learnerIndex += 1) {
      const skills = starting.map((skill) => ({
        mastery: Math.max(
          0.05,
          Math.min(0.95, skill.mastery + (random() - 0.5) * 0.18)
        ),
        uncertainty: skill.uncertainty,
      }))
      startingTotal +=
        skills.reduce((sum, skill) => sum + skill.mastery, 0) / skills.length
      for (let sessionIndex = 0; sessionIndex < 20; sessionIndex += 1) {
        let selected = 0
        if (policy === "Random control") {
          selected = Math.floor(random() * skills.length)
        } else {
          selected = skills.reduce((bestIndex, skill, index) => {
            const score =
              policy === "Weakest only"
                ? 1 - skill.mastery
                : policy === "Explore uncertainty"
                  ? skill.uncertainty
                  : (1 - skill.mastery) * 0.7 + skill.uncertainty * 0.3
            const best = skills[bestIndex]
            const bestScore =
              policy === "Weakest only"
                ? 1 - best.mastery
                : policy === "Explore uncertainty"
                  ? best.uncertainty
                  : (1 - best.mastery) * 0.7 + best.uncertainty * 0.3
            return score > bestScore ? index : bestIndex
          }, 0)
        }
        const target = skills[selected]
        const correct = random() < target.mastery
        target.mastery = Math.min(
          0.99,
          target.mastery + (correct ? 0.028 : 0.045)
        )
        target.uncertainty = Math.max(0.02, target.uncertainty * 0.86)
      }
      endingTotal +=
        skills.reduce((sum, skill) => sum + skill.mastery, 0) / skills.length
    }
    const startingMastery = startingTotal / 100
    const endingMastery = endingTotal / 100
    return {
      policy,
      startingMastery,
      endingMastery,
      gain: endingMastery - startingMastery,
    }
  })
}

function parseFairnessRecords(value: unknown): FairnessAuditRecord[] {
  const candidates = Array.isArray(value) ? value : [value]
  return candidates.map((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      throw new TypeError("Fairness audit records must be objects.")
    }
    const item = candidate as Record<string, unknown>
    const record = {
      group: typeof item.group === "string" ? item.group.trim() : "",
      questionSelectionRate: Number(item.questionSelectionRate),
      predictionError: Number(item.predictionError),
      stoppingQuestions: Number(item.stoppingQuestions),
    }
    if (
      !record.group ||
      !Number.isFinite(record.questionSelectionRate) ||
      record.questionSelectionRate < 0 ||
      record.questionSelectionRate > 1 ||
      !Number.isFinite(record.predictionError) ||
      record.predictionError < 0 ||
      !Number.isFinite(record.stoppingQuestions) ||
      record.stoppingQuestions < 1
    ) {
      throw new TypeError("A fairness audit record is malformed.")
    }
    return record
  })
}

function LearnerModelView({
  learning,
  busy,
  onCorrectModel,
  onStartChallenge,
  onStartRecovery,
}: Pick<
  ScoutOperationsLabProps,
  | "learning"
  | "busy"
  | "onCorrectModel"
  | "onStartChallenge"
  | "onStartRecovery"
>) {
  const [correctionKind, setCorrectionKind] = useState<
    "too-high" | "too-low" | "wrong-misconception"
  >("wrong-misconception")
  const [note, setNote] = useState("")
  const [reflection, setReflection] = useState("")
  const report = learning.learnerModel
  const canSwitchMission = learning.status === "complete"
  const averageMastery =
    learning.learningTwin.skills.reduce(
      (sum, skill) => sum + skill.learnedProbability,
      0
    ) / learning.learningTwin.skills.length

  useEffect(() => {
    const timeout = window.setTimeout(
      () =>
        setReflection(
          window.localStorage.getItem("scout-weekly-reflection-v1") ?? ""
        ),
      0
    )
    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <div className="space-y-12">
      <section className="grid border-y-2 border-foreground lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:divide-x-2 lg:divide-foreground">
        <div className="py-7 lg:pr-8">
          <p className="ink-label text-primary">Readiness confidence</p>
          <div className="mt-4 grid grid-cols-2 gap-5">
            <div>
              <p className="font-heading text-5xl font-black">
                {Math.round(report.readiness.mastery * 100)}%
              </p>
              <p className="mt-1 text-sm text-muted-foreground">skill estimate</p>
            </div>
            <div>
              <p className="font-heading text-5xl font-black text-primary">
                {Math.round(report.readiness.certainty * 100)}%
              </p>
              <p className="mt-1 text-sm text-muted-foreground">certainty</p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 font-semibold">
            {report.readiness.label}. These are different: Scout can estimate a
            strong skill while still admitting the estimate needs more proof.
          </p>
        </div>
        <div className="py-7 lg:pl-8">
          <p className="ink-label text-muted-foreground">What Scout notices</p>
          <dl className="mt-4 divide-y border-y text-sm leading-6">
            <div className="py-3">
              <dt className="font-bold">Pacing signal</dt>
              <dd className="text-muted-foreground">{report.responseTime.interpretation}</dd>
            </div>
            <div className="py-3">
              <dt className="font-bold">Transfer</dt>
              <dd className="text-muted-foreground">{report.transferSignal}</dd>
            </div>
            <div className="py-3">
              <dt className="font-bold">Forgetting protection</dt>
              <dd className="text-muted-foreground">{report.decaySignal}</dd>
            </div>
            <div className="py-3">
              <dt className="font-bold">Explore next</dt>
              <dd className="text-muted-foreground">{report.explorationQuestion}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section>
        <p className="ink-label text-primary">Misconception fingerprint</p>
        <h2 className="mt-2 font-heading text-4xl font-black">
          Name the exact mistake—not just the weak section.
        </h2>
        {report.misconceptions.length ? (
          <div className="mt-6 overflow-x-auto border-y-2 border-foreground">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="bg-foreground text-background">
                <tr>
                  <th className="px-4 py-3">Misconception</th>
                  <th className="px-4 py-3">Skill</th>
                  <th className="px-4 py-3">Seen</th>
                  <th className="px-4 py-3">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.misconceptions.map((item) => (
                  <tr key={`${item.skill}:${item.label}`}>
                    <td className="px-4 py-3 font-semibold">{item.label}</td>
                    <td className="px-4 py-3">{item.skillLabel}</td>
                    <td className="px-4 py-3">{item.count}×</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.latestQuestionId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 border-y py-5 text-sm text-muted-foreground">
            Scout abstains until a missed choice points to a specific error.
          </p>
        )}
        {report.prerequisiteConfusion ? (
          <div className="mt-5 border-l-4 border-[var(--scout-sun)] bg-[var(--coach-surface)] p-5">
            <p className="font-bold">Prerequisite repair</p>
            <p className="mt-2 text-sm leading-6">{report.prerequisiteConfusion}</p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-7 border-y-2 border-foreground py-7 lg:grid-cols-2">
        <div>
          <p className="ink-label text-primary">Scout got this wrong about me</p>
          <h2 className="mt-2 font-heading text-3xl font-black">Correct the model.</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your correction is saved in the audit trail. It adjusts the estimate
            carefully; it never deletes the original evidence.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ["wrong-misconception", "Wrong mistake label"],
                ["too-high", "Estimate is too high"],
                ["too-low", "Estimate is too low"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={correctionKind === value ? "secondary" : "outline"}
                onClick={() => setCorrectionKind(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={300}
            className="mt-4 w-full border-2 border-foreground bg-background p-3 text-sm"
            placeholder="What did Scout misunderstand?"
          />
          <Button
            type="button"
            className="mt-3"
            disabled={busy}
            onClick={() =>
              onCorrectModel({
                skill: learning.todaySkill,
                kind: correctionKind,
                note,
              })
            }
          >
            Save correction and rerun plan
          </Button>
        </div>
        <div>
          <p className="ink-label text-muted-foreground">Correction history</p>
          {report.corrections.length ? (
            <ol className="mt-4 divide-y border-y text-sm">
              {report.corrections.slice(0, 5).map((item) => (
                <li key={item.id} className="py-3">
                  <p className="font-bold">{item.skillLabel} · {item.kind.replaceAll("-", " ")}</p>
                  <p className="mt-1 text-muted-foreground">{item.note}</p>
                  <p className="mt-1 font-mono text-xs">
                    {Math.round(item.before * 100)}% → {Math.round(item.after * 100)}%
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 border-y py-5 text-sm text-muted-foreground">
              No learner corrections yet.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-7 lg:grid-cols-2">
        <div>
          <p className="ink-label text-primary">Effort versus progress</p>
          <h2 className="mt-2 font-heading text-3xl font-black">
            {learning.mission.progress.totalAnswered} answers · {Math.round(averageMastery * 100)}% average readiness
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Scout rewards learning that holds up later. The mastery streak is
            {" "}{learning.learningTwin.skills.filter((skill) => skill.confidence === "stable").length} stable skills—not a login counter.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy || !canSwitchMission} onClick={() => onStartChallenge()}>
              Try a mastery challenge
            </Button>
            <Button type="button" variant="outline" disabled={busy || !canSwitchMission} onClick={onStartRecovery}>
              Start a recovery session
            </Button>
          </div>
          {!canSwitchMission ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Finish today’s open mission before replacing it. Scout protects unfinished work.
            </p>
          ) : null}
        </div>
        <div>
          <p className="ink-label text-muted-foreground">Weekly reflection</p>
          <textarea
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            rows={4}
            className="mt-3 w-full border-2 border-foreground bg-background p-3 text-sm"
            placeholder="What felt easier? What still slows you down?"
          />
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() =>
              window.localStorage.setItem(
                "scout-weekly-reflection-v1",
                reflection
              )
            }
          >
            Save reflection on this device
          </Button>
        </div>
      </section>
    </div>
  )
}

function ActStrategyView({ plan, learning }: Pick<ScoutOperationsLabProps, "plan" | "learning">) {
  const [goal, setGoal] = useState<"accuracy" | "speed" | "both">("both")
  const baseline = plan.evidence.planningBaseline ?? {
    english: plan.currentComposite,
    math: plan.currentComposite,
    reading: plan.currentComposite,
  }
  const [sectionScores, setSectionScores] = useState({
    english: baseline.english,
    math: baseline.math,
    reading: baseline.reading,
  })
  const [actualTimed, setActualTimed] = useState(plan.currentComposite)
  const [strategyChoice, setStrategyChoice] = useState<"answer" | "skip" | "flag" | "return">("flag")
  const predicted = Math.round(
    learning.learningTwin.skills.reduce(
      (sum, skill) => sum + skill.predictedCorrectProbability,
      0
    ) / learning.learningTwin.skills.length * 35 + 1
  )
  const simulatedComposite = Math.round(
    (sectionScores.english + sectionScores.math + sectionScores.reading) / 3
  )
  const averageCertainty =
    learning.learningTwin.skills.reduce(
      (sum, skill) => sum + (1 - skill.uncertainty),
      0
    ) / learning.learningTwin.skills.length
  const readinessGate =
    simulatedComposite >= plan.draft.goal && averageCertainty >= 0.45

  return (
    <div className="space-y-12">
      <section>
        <p className="ink-label text-primary">Current enhanced ACT format</p>
        <h2 className="mt-2 font-heading text-4xl font-black">Train to the real clock.</h2>
        <div className="mt-6 overflow-x-auto border-y-2 border-foreground">
          <table className="w-full min-w-[38rem] text-left">
            <thead className="bg-foreground text-background">
              <tr><th className="px-4 py-3">Section</th><th className="px-4 py-3">Questions</th><th className="px-4 py-3">Minutes</th><th className="px-4 py-3">Average pace</th></tr>
            </thead>
            <tbody className="divide-y">
              {ACT_SECTIONS.map((section) => (
                <tr key={section.id}>
                  <td className="px-4 py-3 font-bold">{section.label}</td>
                  <td className="px-4 py-3">{section.questions}</td>
                  <td className="px-4 py-3">{section.minutes}</td>
                  <td className="px-4 py-3">{Math.round((section.minutes * 60) / section.questions)} sec/question</td>
                </tr>
              ))}
              <tr>
                <td className="px-4 py-3 font-bold">Science <span className="text-xs text-muted-foreground">optional</span></td>
                <td className="px-4 py-3">40</td>
                <td className="px-4 py-3">40</td>
                <td className="px-4 py-3">60 sec/question</td>
              </tr>
            </tbody>
          </table>
        </div>
        <a className="mt-3 inline-block text-sm font-semibold text-primary underline" href="https://www.act.org/content/act/en/products-and-services/the-act/test-preparation/act-exam-sections-and-structure.html" target="_blank" rel="noreferrer">
          Official ACT section structure
        </a>
        <details className="mt-5 border-y-2 border-foreground py-4">
          <summary className="cursor-pointer font-bold">Show the official content blueprint</summary>
          <div className="mt-4 grid gap-5 text-sm leading-6 md:grid-cols-3">
            <div><p className="font-bold">English</p><p>Production of Writing 38–43% · Knowledge of Language 18–23% · Standard English conventions 38–43%.</p></div>
            <div><p className="font-bold">Math</p><p>Preparing for Higher Math 80% · Integrating Essential Skills 20% · Modeling appears throughout.</p></div>
            <div><p className="font-bold">Reading</p><p>Key Ideas and Details 44–52% · Craft and Structure 26–33% · Integration of Knowledge and Ideas 19–26%.</p></div>
          </div>
        </details>
      </section>

      <section className="grid border-y-2 border-foreground lg:grid-cols-2 lg:divide-x-2 lg:divide-foreground">
        <div className="py-7 lg:pr-8">
          <p className="ink-label text-primary">Pacing coach</p>
          <h2 className="mt-2 font-heading text-3xl font-black">What are we training?</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["accuracy", "speed", "both"] as const).map((value) => (
              <Button key={value} type="button" size="sm" variant={goal === value ? "secondary" : "outline"} onClick={() => setGoal(value)} className="capitalize">{value}</Button>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {goal === "accuracy"
              ? "Work untimed until the rule is reliable. Scout will not rush an unlearned skill."
              : goal === "speed"
                ? "Use short sets at standard pace. A slow correct answer stays correct; speed never lowers mastery."
                : "Keep accuracy first, then shorten the clock in small steps."}
          </p>
        </div>
        <div className="py-7 lg:pl-8">
          <p className="ink-label text-muted-foreground">Time-pressure ramp</p>
          <ol className="mt-4 divide-y border-y text-sm">
            <li className="py-3"><strong>1. Learn:</strong> untimed, explain the rule.</li>
            <li className="py-3"><strong>2. Controlled:</strong> standard time + 25%.</li>
            <li className="py-3"><strong>3. Test pace:</strong> official section timing.</li>
            <li className="py-3"><strong>4. Pressure finish:</strong> last five questions at target pace.</li>
          </ol>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <p className="ink-label text-primary">Section strategy trainer</p>
          <h2 className="mt-2 font-heading text-3xl font-black">A question has taken too long. What now?</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["answer", "skip", "flag", "return"] as const).map((value) => (
              <Button key={value} type="button" size="sm" variant={strategyChoice === value ? "secondary" : "outline"} onClick={() => setStrategyChoice(value)} className="capitalize">{value}</Button>
            ))}
          </div>
          <div className="mt-5 border-l-4 border-primary bg-[var(--info-surface)] p-5 text-sm leading-6">
            {strategyChoice === "flag"
              ? "Good first move: choose your best answer, flag it, and protect time for questions you can still earn. Return only after the section is complete."
              : strategyChoice === "skip"
                ? "Do not leave it blank. The ACT has no wrong-answer penalty; make a best guess before moving."
                : strategyChoice === "return"
                  ? "Return is useful only after every question has an answer. Otherwise you may trade several reachable points for one hard item."
                  : "Answer now only if you have a clear method. If you are stuck, guess, flag, and keep the section moving."}
          </div>
        </div>
        <div>
          <p className="ink-label text-muted-foreground">Predicted versus timed</p>
          <p className="mt-2 font-heading text-5xl font-black">{predicted}</p>
          <p className="text-sm text-muted-foreground">model prediction from current skill evidence</p>
          <label className="mt-5 grid gap-2 text-sm font-bold">
            Latest timed composite
            <input type="number" min={1} max={36} value={actualTimed} onChange={(event) => setActualTimed(Number(event.target.value))} className="h-11 w-28 border-2 border-foreground bg-background px-3" />
          </label>
          <p className="mt-3 text-sm leading-6">
            {Math.abs(predicted - actualTimed) <= 2
              ? "The prediction is calibrated closely enough to plan from."
              : actualTimed < predicted
                ? "Timed performance is lower than skill work. Scout should prioritize pacing and full-section practice."
                : "Timed performance beat the model. Scout needs more hard questions before claiming a ceiling."}
          </p>
        </div>
      </section>

      <section>
        <p className="ink-label text-primary">Target-score simulator</p>
        <h2 className="mt-2 font-heading text-4xl font-black">See the composite tradeoff.</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          {ACT_SECTIONS.map((section) => (
            <label key={section.id} className="border-t-2 border-foreground pt-4 text-sm font-bold">
              {section.label}
              <input
                type="number"
                min={1}
                max={36}
                value={sectionScores[section.id]}
                onChange={(event) => setSectionScores((current) => ({ ...current, [section.id]: Math.max(1, Math.min(36, Number(event.target.value))) }))}
                className="mt-2 block h-12 w-full border-2 border-foreground bg-background px-3 font-heading text-2xl font-black"
              />
            </label>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-5 border-y-2 border-foreground py-5">
          <div>
            <p className="ink-label text-muted-foreground">Simulated composite</p>
            <p className="mt-1 font-heading text-6xl font-black text-primary">{simulatedComposite}</p>
          </div>
          <div className="max-w-xl">
            <p className="font-bold">Readiness gate: {readinessGate ? "Ready for a full timed form" : "Keep building evidence"}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Scout opens the gate only when the score scenario reaches {plan.draft.goal} and the skill estimates are certain enough. It does not confuse one lucky set with readiness.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y-2 border-foreground py-6">
        <p className="ink-label text-primary">Parallel forms and exposure protection</p>
        <p className="mt-3 text-sm leading-6">
          Scout chooses the least-exposed reviewed item for repair, retention,
          challenge, and recovery sets. {learning.trustReport.exposure.filter((item) => item.protected).length} question(s) are currently marked high-exposure and are held back when an alternative exists.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Current bank: reviewed alternate forms. Scout does not claim a fresh form when every available item has already been seen.
        </p>
      </section>
    </div>
  )
}

function CoachView({ learning, busy, onTutorOverride, onContentDecision }: Pick<ScoutOperationsLabProps, "learning" | "busy" | "onTutorOverride" | "onContentDecision">) {
  const [selectedSkill, setSelectedSkill] = useState(learning.nextSkill)
  const [reason, setReason] = useState("")
  const [assignmentSkills, setAssignmentSkills] = useState<string[]>([learning.nextSkill])
  const [assignmentBuilt, setAssignmentBuilt] = useState(false)
  const [approvalStatus, setApprovalStatus] = useState<
    "pending" | "approved" | "rejected"
  >("pending")
  const [editedExplanation, setEditedExplanation] = useState(
    learning.lesson.sections[0]?.explanation ?? learning.lesson.concept
  )
  const [cohort, setCohort] = useState<
    Array<{ label: string; count: number; learners: number }>
  >([])
  const [cohortItemFlags, setCohortItemFlags] = useState<
    Array<{ questionId: string; misconception: string; learners: number }>
  >([])
  const [cohortError, setCohortError] = useState("")
  const priority = [...learning.learningTwin.skills].sort((a, b) => a.learnedProbability - b.learnedProbability)
  const parentDigest = `Scout update: ${learning.coachBrief.strongestSkill}. Highest priority: ${learning.coachBrief.priorityMisconception}. Current mission: ${learning.coachBrief.currentMission}. Next: ${learning.coachBrief.nextMission}. Still unknown: ${learning.coachBrief.unknowns}`

  async function importCohort(files: FileList | null) {
    if (!files?.length) return
    setCohortError("")
    try {
      const grouped = new Map<string, { count: number; learners: Set<number> }>()
      const suspiciousItems = new Map<
        string,
        { questionId: string; misconception: string; learners: Set<number> }
      >()
      const imported = await Promise.all(
        [...files].map(async (file) => JSON.parse(await file.text()) as {
          learning?: LearningSessionPayload
        })
      )
      imported.forEach((item, learnerIndex) => {
        const skills = item.learning?.learningTwin.skills ?? []
        const averageMastery = skills.length
          ? skills.reduce((sum, skill) => sum + skill.learnedProbability, 0) /
            skills.length
          : 0
        for (const misconception of
          item.learning?.learnerModel.misconceptions ?? []) {
          const previous = grouped.get(misconception.label) ?? {
            count: 0,
            learners: new Set<number>(),
          }
          previous.count += misconception.count
          previous.learners.add(learnerIndex)
          grouped.set(misconception.label, previous)
          if (averageMastery >= 0.72) {
            const key = `${misconception.latestQuestionId}:${misconception.label}`
            const itemFlag = suspiciousItems.get(key) ?? {
              questionId: misconception.latestQuestionId,
              misconception: misconception.label,
              learners: new Set<number>(),
            }
            itemFlag.learners.add(learnerIndex)
            suspiciousItems.set(key, itemFlag)
          }
        }
      })
      setCohort(
        [...grouped.entries()]
          .map(([label, value]) => ({
            label,
            count: value.count,
            learners: value.learners.size,
          }))
          .sort((left, right) => right.learners - left.learners)
      )
      setCohortItemFlags(
        [...suspiciousItems.values()]
          .filter((item) => item.learners.size >= 3)
          .map((item) => ({
            questionId: item.questionId,
            misconception: item.misconception,
            learners: item.learners.size,
          }))
          .sort((left, right) => right.learners - left.learners)
      )
    } catch {
      setCohort([])
      setCohortItemFlags([])
      setCohortError("Scout could not read one of those files. Import only Scout JSON exports.")
    }
  }

  return (
    <div className="space-y-12">
      <section>
        <p className="ink-label text-primary">Intervention queue</p>
        <h2 className="mt-2 font-heading text-4xl font-black">Who or what needs attention first?</h2>
        <ol className="mt-6 border-y-2 border-foreground">
          {priority.slice(0, 4).map((skill, index) => (
            <li key={skill.skill} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b py-4 last:border-0">
              <span className="font-mono text-sm font-black text-primary">0{index + 1}</span>
              <span><span className="block font-bold">{skill.label}</span><span className="text-sm text-muted-foreground">{skill.confidence} confidence · {skill.evidenceCount} answers</span></span>
              <span className="font-heading text-2xl font-black">{Math.round(skill.learnedProbability * 100)}%</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-8 border-y-2 border-foreground py-7 lg:grid-cols-2">
        <div>
          <p className="ink-label text-primary">Tutor override</p>
          <h2 className="mt-2 font-heading text-3xl font-black">Change the next mission—with a reason.</h2>
          <select value={selectedSkill} onChange={(event) => setSelectedSkill(event.target.value)} className="mt-4 h-11 w-full border-2 border-foreground bg-background px-3">
            {learning.learningTwin.skills.map((skill) => <option key={skill.skill} value={skill.skill}>{skill.label}</option>)}
          </select>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={300} className="mt-3 w-full border-2 border-foreground bg-background p-3 text-sm" placeholder="Why should human judgment override the model here?" />
          <Button type="button" className="mt-3" disabled={busy || reason.trim().length < 8} onClick={() => onTutorOverride({ skill: selectedSkill, reason })}>Save audited override</Button>
          {learning.tutorOverrides[0] ? (
            <p className="mt-4 text-xs leading-5 text-muted-foreground">Last override: {learning.tutorOverrides[0].selectedSkillLabel} · {learning.tutorOverrides[0].reason}</p>
          ) : null}
        </div>
        <div>
          <p className="ink-label text-muted-foreground">Student conference mode</p>
          <ol className="mt-4 divide-y border-y text-sm leading-6">
            <li className="py-3"><strong>Ask:</strong> What decision do you make first in {learning.coachBrief.nextMission}?</li>
            <li className="py-3"><strong>Listen for:</strong> {learning.coachBrief.priorityMisconception}</li>
            <li className="py-3"><strong>Try offline:</strong> {learning.coachBrief.offlineIntervention}</li>
            <li className="py-3"><strong>Do not assume:</strong> {learning.coachBrief.unknowns}</li>
          </ol>
        </div>
      </section>

      <section>
        <p className="ink-label text-primary">Assignment builder</p>
        <h2 className="mt-2 font-heading text-3xl font-black">Assign by skill and confidence.</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {learning.learningTwin.skills.map((skill) => {
            const selected = assignmentSkills.includes(skill.skill)
            return (
              <Button key={skill.skill} type="button" size="sm" variant={selected ? "secondary" : "outline"} onClick={() => setAssignmentSkills((current) => selected ? current.filter((item) => item !== skill.skill) : [...current, skill.skill])}>{skill.label}</Button>
            )
          })}
        </div>
        <Button type="button" className="mt-4" disabled={!assignmentSkills.length} onClick={() => setAssignmentBuilt(true)}>Build evidence-based assignment</Button>
        {assignmentBuilt ? (
          <div className="mt-5 border-l-4 border-primary bg-[var(--info-surface)] p-5 text-sm leading-6">
            <p className="font-bold">Assignment ready</p>
            <p className="mt-1">For each selected skill: one reviewed micro-lesson, two guided questions, one independent exit ticket, and a two-question retention check after the predicted forgetting window.</p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <p className="ink-label text-primary">AI lesson approval</p>
          <div className="mt-4 border-y-2 border-foreground py-5">
            <p className="font-bold">{learning.lesson.title}</p>
            <p className="mt-2 text-sm">Validation: {learning.lessonReceipt.validationResult} · Delivered: {learning.lessonReceipt.deliveredAs}</p>
            <p className="mt-2 text-sm text-muted-foreground">Approve only after the objective, rule, answer-leakage check, and evidence IDs match the assignment.</p>
            <label className="mt-4 block text-sm font-bold">
              Edit the main explanation before approval
              <textarea
                value={editedExplanation}
                onChange={(event) => setEditedExplanation(event.target.value)}
                rows={5}
                maxLength={1200}
                className="mt-2 w-full border-2 border-foreground bg-background p-3 font-normal leading-6"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant={approvalStatus === "approved" ? "secondary" : "outline"} onClick={() => { setApprovalStatus("approved"); onContentDecision({ approved: true, editedExplanation }) }}>Save edit and approve</Button>
              <Button type="button" variant={approvalStatus === "rejected" ? "destructive" : "ghost"} onClick={() => { setApprovalStatus("rejected"); onContentDecision({ approved: false }) }}>Reject and use fallback</Button>
              <Button type="button" variant="outline" onClick={() => void copyText(`${approvalStatus.toUpperCase()} lesson: ${learning.lesson.title}\nObjective: ${learning.lessonReceipt.objective}\nRule: ${learning.lessonReceipt.approvedRule}`)}>Copy approval receipt</Button>
            </div>
            <p className="mt-3 font-mono text-xs font-bold uppercase">Status: {approvalStatus}</p>
          </div>
        </div>
        <div>
          <p className="ink-label text-muted-foreground">Cohort misconception heatmap</p>
          <div className="mt-4 border-y-2 border-foreground py-5">
            <p className="font-bold">Import consented Scout exports</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">The browser aggregates exported learner files without uploading them. No files means no fake cohort claim.</p>
            <input
              type="file"
              accept="application/json,.json"
              multiple
              className="mt-4 block w-full text-sm"
              onChange={(event) => void importCohort(event.target.files)}
            />
            {cohortError ? (
              <p role="alert" className="mt-3 text-sm font-bold text-destructive">
                {cohortError}
              </p>
            ) : null}
            {cohort.length ? (
              <ol className="mt-5 divide-y border-y text-sm">
                {cohort.map((item) => (
                  <li key={item.label} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold">{item.label}</span>
                      <span>{item.learners} learner(s) · {item.count} misses</span>
                    </div>
                    <div className="mt-2 h-2 bg-muted">
                      <div className="h-full bg-[var(--scout-coral)]" style={{ width: `${Math.min(100, item.learners * 20)}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm font-semibold">No cohort files loaded.</p>
            )}
            <div className="mt-5 border-t pt-4 text-sm">
              <p className="font-bold">Automatic bad-question check</p>
              {cohortItemFlags.length ? (
                <ul className="mt-2 space-y-2">
                  {cohortItemFlags.map((item) => (
                    <li key={`${item.questionId}:${item.misconception}`}>
                      Flag {item.questionId}: {item.learners} high-readiness learners chose the same misconception, “{item.misconception}.” Send it for human review.
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-muted-foreground">
                  Scout flags an item only when at least three high-readiness learners independently choose the same wrong idea.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 border-y-2 border-foreground py-6 md:grid-cols-2">
        <div>
          <p className="ink-label text-primary">Parent digest</p>
          <p className="mt-3 text-sm leading-6">{parentDigest}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => void copyText(parentDigest)}>Copy parent digest</Button>
        </div>
        <div>
          <p className="ink-label text-muted-foreground">Human-help handoff</p>
          <p className="mt-3 text-sm leading-6">Package the misconception, evidence IDs, lesson tried, teach-back rubric, and remaining unknowns so a tutor can continue without making the learner repeat everything.</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => void copyText(JSON.stringify({ coachBrief: learning.coachBrief, misconceptions: learning.learnerModel.misconceptions, teachBack: learning.teachBack }, null, 2))}>Copy tutor handoff</Button>
        </div>
      </section>
    </div>
  )
}

function TrustView({ plan, learning, onDeleteData }: Pick<ScoutOperationsLabProps, "plan" | "learning" | "onDeleteData">) {
  const [online, setOnline] = useState(true)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [queued, setQueued] = useState(0)
  const [simulation, setSimulation] = useState<PolicySimulationResult[]>([])
  const [fairnessRows, setFairnessRows] = useState<FairnessAuditRow[]>([])
  const [fairnessError, setFairnessError] = useState("")

  useEffect(() => {
    function update() {
      setOnline(navigator.onLine)
      try {
        const pending = JSON.parse(
          window.localStorage.getItem("scout-offline-answer-queue-v1") ?? "[]"
        ) as unknown[]
        setQueued(Array.isArray(pending) ? pending.length : 0)
      } catch {
        setQueued(0)
      }
    }
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])

  function exportData() {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), plan, learning }, null, 2)],
      { type: "application/json" }
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "scout-learning-data.json"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function importFairnessAudit(files: FileList | null) {
    if (!files?.length) return
    setFairnessError("")
    try {
      const records = (
        await Promise.all(
          [...files].map(async (file) =>
            parseFairnessRecords(JSON.parse(await file.text()) as unknown)
          )
        )
      ).flat()
      const grouped = new Map<
        string,
        {
          questionSelectionRate: number
          predictionError: number
          stoppingQuestions: number
          records: number
        }
      >()
      for (const record of records) {
        const current = grouped.get(record.group) ?? {
          questionSelectionRate: 0,
          predictionError: 0,
          stoppingQuestions: 0,
          records: 0,
        }
        current.questionSelectionRate += record.questionSelectionRate
        current.predictionError += record.predictionError
        current.stoppingQuestions += record.stoppingQuestions
        current.records += 1
        grouped.set(record.group, current)
      }
      const rows = [...grouped.entries()].map(([group, values]) => ({
        group,
        questionSelectionRate:
          values.questionSelectionRate / values.records,
        predictionError: values.predictionError / values.records,
        stoppingQuestions: values.stoppingQuestions / values.records,
        records: values.records,
      }))
      if (rows.length < 2 || rows.some((row) => row.records < 2)) {
        throw new TypeError(
          "Use at least two consented groups with two records per group."
        )
      }
      setFairnessRows(rows.sort((left, right) => left.group.localeCompare(right.group)))
    } catch (error) {
      setFairnessRows([])
      setFairnessError(
        error instanceof Error
          ? error.message
          : "Scout could not read the fairness audit file."
      )
    }
  }

  return (
    <div className="space-y-12">
      <section className="grid border-y-2 border-foreground lg:grid-cols-2 lg:divide-x-2 lg:divide-foreground">
        <div className="py-7 lg:pr-8">
          <p className="ink-label text-primary">Model-version comparison</p>
          <h2 className="mt-2 font-heading text-3xl font-black">
            {learning.trustReport.modelComparison.agrees ? "Two policies agree." : "The policies disagree—and Scout shows why."}
          </h2>
          <dl className="mt-5 grid grid-cols-2 gap-5 border-t-2 border-foreground pt-4">
            <div><dt className="ink-label text-muted-foreground">BKT 1.0</dt><dd className="mt-1 font-bold">{learning.trustReport.modelComparison.current}</dd></div>
            <div><dt className="ink-label text-muted-foreground">Accuracy model</dt><dd className="mt-1 font-bold">{learning.trustReport.modelComparison.comparison}</dd></div>
          </dl>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{learning.trustReport.modelComparison.explanation}</p>
        </div>
        <div className="py-7 lg:pl-8">
          <p className="ink-label text-muted-foreground">Policy benchmark simulator</p>
          <ol className="mt-4 divide-y border-y text-sm">
            {learning.trustReport.policyBenchmarks.map((policy) => (
              <li key={policy.policy} className="py-3"><p className="font-bold">{policy.policy}: {policy.nextSkill}</p><p className="mt-1 text-muted-foreground">{policy.tradeoff}</p></li>
            ))}
          </ol>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => setSimulation(simulatePolicies(learning))}
          >
            Run 100 virtual learners
          </Button>
          {simulation.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[30rem] text-left text-xs">
                <thead><tr><th className="py-2 pr-3">Policy</th><th className="py-2 pr-3">Start</th><th className="py-2 pr-3">Finish</th><th className="py-2">Gain</th></tr></thead>
                <tbody className="divide-y">
                  {simulation.map((result) => (
                    <tr key={result.policy}>
                      <td className="py-2 pr-3 font-bold">{result.policy}</td>
                      <td className="py-2 pr-3">{Math.round(result.startingMastery * 100)}%</td>
                      <td className="py-2 pr-3">{Math.round(result.endingMastery * 100)}%</td>
                      <td className="py-2">+{Math.round(result.gain * 100)} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">
                Synthetic comparison: 100 seeded learners, 20 sessions each, starting from this learner’s skill profile. This is a policy test—not a score guarantee.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <p className="ink-label text-primary">Previous-decision replay</p>
        <h2 className="mt-2 font-heading text-3xl font-black">
          See where another model would have chosen differently.
        </h2>
        {learning.decisionHistory.length ? (
          <div className="mt-5 overflow-x-auto border-y-2 border-foreground">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-foreground text-background"><tr><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">BKT decision</th><th className="px-4 py-3">Accuracy-only replay</th><th className="px-4 py-3">Result</th></tr></thead>
              <tbody className="divide-y">
                {learning.decisionHistory.slice(0, 8).map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3"><span className="block font-bold">{event.answerSummary}</span><span className="font-mono text-xs text-muted-foreground">{event.questionId}</span></td>
                    <td className="px-4 py-3">{event.planAfter}<span className="block text-xs text-muted-foreground">{event.modelVersion}</span></td>
                    <td className="px-4 py-3">{event.comparisonPlanLabel ?? "Not stored for this older event"}<span className="block text-xs text-muted-foreground">{event.comparisonModelVersion ?? "—"}</span></td>
                    <td className="px-4 py-3 font-bold">{event.comparisonPlan ? (event.comparisonPlan === event.planAfter ? "Same" : "Different") : "Abstained"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 border-y py-5 text-sm text-muted-foreground">
            No scored decision exists yet. Scout will store both policy choices with the next answer instead of inventing a historical replay.
          </p>
        )}
      </section>

      <section>
        <p className="ink-label text-primary">Item-health dashboard</p>
        <h2 className="mt-2 font-heading text-4xl font-black">Bad questions get questioned too.</h2>
        {learning.trustReport.itemHealth.length ? (
          <div className="mt-6 overflow-x-auto border-y-2 border-foreground">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="bg-foreground text-background"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Why</th></tr></thead>
              <tbody className="divide-y">
                {learning.trustReport.itemHealth.map((item) => (
                  <tr key={item.questionId}><td className="px-4 py-3 font-mono text-xs">{item.questionId}</td><td className="px-4 py-3 font-bold capitalize">{item.status.replaceAll("-", " ")}</td><td className="max-w-2xl px-4 py-3 text-muted-foreground">{item.reason}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 border-y py-5 text-sm text-muted-foreground">No question has enough exposure for an item-health judgment. Scout abstains.</p>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <p className="ink-label text-primary">Fairness audit</p>
          <div className="mt-4 border-y-2 border-foreground py-5">
            <p className="font-bold">Import consented audit records</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              JSON fields: group, questionSelectionRate (0–1), predictionError, and stoppingQuestions. Files stay in this browser.
            </p>
            <input type="file" accept="application/json,.json" multiple className="mt-4 block w-full text-sm" onChange={(event) => void importFairnessAudit(event.target.files)} />
            {fairnessError ? <p role="alert" className="mt-3 text-sm font-bold text-destructive">{fairnessError}</p> : null}
            {fairnessRows.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-xs">
                  <thead><tr><th className="py-2 pr-3">Group</th><th className="py-2 pr-3">Selection</th><th className="py-2 pr-3">Error</th><th className="py-2">Stop</th></tr></thead>
                  <tbody className="divide-y">
                    {fairnessRows.map((row) => <tr key={row.group}><td className="py-2 pr-3 font-bold">{row.group} ({row.records})</td><td className="py-2 pr-3">{Math.round(row.questionSelectionRate * 100)}%</td><td className="py-2 pr-3">{row.predictionError.toFixed(1)}</td><td className="py-2">{row.stoppingQuestions.toFixed(1)} Q</td></tr>)}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-muted-foreground">
                  Review any material group gap with a qualified human; this table reports differences and does not infer their cause.
                </p>
              </div>
            ) : (
              <div className="mt-4 border-l-4 border-[var(--scout-sun)] bg-[var(--coach-surface)] p-4">
                <p className="font-bold">No unsupported fairness claim</p>
                <p className="mt-2 text-sm leading-6">{learning.trustReport.abstentions[0]}</p>
              </div>
            )}
          </div>
        </div>
        <div>
          <p className="ink-label text-muted-foreground">Model abstention</p>
          <div className="mt-4 border-l-4 border-primary bg-[var(--info-surface)] p-5">
            <p className="font-bold">Scout says “not enough evidence” on purpose.</p>
            <p className="mt-2 text-sm leading-6">{learning.trustReport.abstentions[1]}</p>
          </div>
        </div>
      </section>

      <section className="border-y-2 border-foreground py-7">
        <p className="ink-label text-primary">Generation safety evaluation</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {learning.lessonReceipt.validationChecks.map((check) => (
            <div key={check} className="border-t-2 border-foreground pt-3"><ShieldCheckIcon className="text-primary" /><p className="mt-2 text-sm font-semibold">{check}</p></div>
          ))}
        </div>
        <p className="mt-5 text-sm leading-6 text-muted-foreground">Provider: {learning.lessonReceipt.generatorStatus}. Content-validation result: {learning.lessonReceipt.validationResult}. Delivery: {learning.lessonReceipt.deliveredAs}. Contradiction, difficulty, unsupported-claim, and answer-leakage checks must pass; otherwise the reviewed fallback is served.</p>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <p className="ink-label text-primary">Private guest mode</p>
          <h2 className="mt-2 font-heading text-3xl font-black">No account required.</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">This device uses private session cookies and local preferences. Export a readable copy or delete the session whenever you want.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={exportData}><DownloadIcon /> Export my data</Button>
            {!deleteArmed ? (
              <Button type="button" variant="ghost" onClick={() => setDeleteArmed(true)}><Trash2Icon /> Delete my data</Button>
            ) : (
              <Button type="button" variant="destructive" onClick={onDeleteData}>Confirm permanent deletion</Button>
            )}
          </div>
        </div>
        <div>
          <p className="ink-label text-muted-foreground">Weak-connection sync</p>
          <div className="mt-4 flex items-start gap-4 border-y-2 border-foreground py-5">
            {online ? <ShieldCheckIcon className="text-primary" /> : <CloudOffIcon className="text-[var(--scout-coral)]" />}
            <div><p className="font-bold">{online ? "Online" : "Offline"} · {queued} answer(s) waiting</p><p className="mt-1 text-sm leading-6 text-muted-foreground">The latest lesson stays readable on this device. Scored answers are queued if the connection drops and replayed in order when it returns. Scout does not pretend the full app works offline: new AI explanations and server grading still need a connection.</p></div>
          </div>
        </div>
      </section>
    </div>
  )
}

export function ScoutOperationsLab(props: ScoutOperationsLabProps) {
  const [view, setView] = useState<LabView>("learner")
  const { openScout } = useScoutContext()
  const tabs = useMemo(
    () => [
      { id: "learner" as const, label: "Learner model", icon: BrainCircuitIcon },
      { id: "act" as const, label: "ACT strategy", icon: GaugeIcon },
      { id: "coach" as const, label: "Coach tools", icon: GraduationCapIcon },
      { id: "trust" as const, label: "Trust & data", icon: ShieldCheckIcon },
    ],
    []
  )
  return (
    <main className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-7 lg:py-10">
      <header className="grid gap-7 border-b-2 border-foreground pb-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
        <div>
          <p className="ink-label text-primary">Scout control room</p>
          <h1 className="mt-3 max-w-5xl font-heading text-6xl leading-[0.92] font-black tracking-[-0.04em] sm:text-8xl">The model has to explain itself.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">Inspect what Scout thinks, train real ACT decisions, hand useful evidence to a human, and control every piece of saved data.</p>
        </div>
        <ScoutCoach mood="thinking" message="I’ll show what I know, what I’m guessing, and what would change my mind." detail="Use the tabs below. Nothing here silently changes today’s unfinished lesson." />
      </header>

      <nav className="sticky top-20 z-10 -mx-4 flex gap-2 overflow-x-auto border-b-2 border-foreground bg-background px-4 py-4 sm:-mx-7 sm:px-7" aria-label="Scout control room sections">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button key={id} type="button" variant={view === id ? "default" : "outline"} onClick={() => setView(id)}><Icon /> {label}</Button>
        ))}
        <Button type="button" variant="ghost" className="ml-auto" onClick={() => openScout("Explain this control room and tell me where to start.")}>Ask Scout about this</Button>
      </nav>

      <div className="pt-9">
        {view === "learner" ? <LearnerModelView {...props} /> : null}
        {view === "act" ? <ActStrategyView {...props} /> : null}
        {view === "coach" ? <CoachView {...props} /> : null}
        {view === "trust" ? <TrustView {...props} /> : null}
      </div>
    </main>
  )
}
