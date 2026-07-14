"use client"

import { useEffect, useState } from "react"

import type { ScoutOperationsLabProps } from "@/components/tutor/scout-operations/types"
import { Button } from "@/components/ui/button"

export function LearnerModelView({
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
  const alreadyCorrected = report.corrections.some(
    (correction) =>
      correction.skill === learning.todaySkill &&
      correction.modelVersion === learning.learningTwin.model.version
  )

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
          <p className="ink-label text-primary">Skill estimate and certainty</p>
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
              <dt className="font-bold">Cross-skill activity</dt>
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
            Your correction is saved separately from scored answers. Scout allows one bounded adjustment per skill and model version; another correction requires new scored evidence.
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
            disabled={busy || alreadyCorrected}
            onClick={() =>
              onCorrectModel({
                skill: learning.todaySkill,
                kind: correctionKind,
                note,
              })
            }
          >
            {busy
              ? "Saving correction…"
              : alreadyCorrected
                ? "Correction saved for this model"
                : "Save correction and rerun plan"}
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
                    {" · "}{item.modelVersion}
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
            {learning.mission.progress.totalAnswered} answers · {Math.round(averageMastery * 100)}% average skill estimate
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
