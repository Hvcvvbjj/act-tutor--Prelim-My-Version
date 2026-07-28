"use client"

import { useState } from "react"
import { DownloadIcon, Trash2Icon } from "lucide-react"

import type { ScoutOperationsLabProps } from "@/components/tutor/scout-operations/types"
import { Button } from "@/components/ui/button"

export function LearnerModelView({
  plan,
  learning,
  busy,
  onCorrectModel,
  onDeleteData,
  canViewTechnicalDetails,
}: Pick<
  ScoutOperationsLabProps,
  | "plan"
  | "learning"
  | "busy"
  | "onCorrectModel"
  | "onDeleteData"
  | "canViewTechnicalDetails"
>) {
  const [correctionKind, setCorrectionKind] = useState<
    "too-high" | "too-low" | "wrong-misconception"
  >("wrong-misconception")
  const [note, setNote] = useState("")
  const [deleteArmed, setDeleteArmed] = useState(false)
  const report = learning.learnerModel
  const alreadyCorrected = report.corrections.some(
    (correction) =>
      correction.skill === learning.todaySkill &&
      correction.modelVersion === learning.learningTwin.model.version
  )
  const currentSkill =
    learning.learningTwin.skills.find(
      (skill) => skill.skill === learning.todaySkill
    ) ?? learning.learningTwin.skills[0]

  function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          { exportedAt: new Date().toISOString(), plan, learning },
          null,
          2
        ),
      ],
      { type: "application/json" }
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "scout-learning-data.json"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-7">
      <section className="border-y-2 border-foreground py-7">
        <p className="ink-label text-primary">What Scout saves</p>
        <h2 className="mt-2 max-w-3xl font-heading text-3xl font-black">
          Your study plan, scored answers, and learning progress.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Export a readable copy whenever you want, or remove Scout&apos;s study
          sessions and saved plan. Deleting study data does not delete an
          account&apos;s sign-in.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={exportData}>
            <DownloadIcon /> Export my data
          </Button>
          {!deleteArmed ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteArmed(true)}
            >
              <Trash2Icon /> Delete Scout study data
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={onDeleteData}
            >
              {busy
                ? "Deleting Scout study data…"
                : "Confirm study-data deletion"}
            </Button>
          )}
        </div>
      </section>

      <details className="group border-y-2 border-foreground">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span>
            <span className="ink-label text-primary">
              Current skill estimate
            </span>
            <span className="mt-1 block font-heading text-2xl font-black">
              {currentSkill?.label ?? learning.mastery.label}
            </span>
          </span>
          <span className="text-right">
            <span className="block font-heading text-3xl font-black text-primary">
              {currentSkill
                ? Math.round(currentSkill.learnedProbability * 100)
                : 0}
              %
            </span>
            <span className="text-xs text-muted-foreground">
              {currentSkill?.evidenceCount ?? 0} scored answers
            </span>
          </span>
        </summary>
        <div className="grid gap-7 border-t-2 border-foreground py-7 lg:grid-cols-2">
          <p className="text-sm leading-6 font-semibold">
            This percentage is Scout&apos;s practice estimate for one skill. It
            is not an ACT score or percent correct.
          </p>
          <dl className="divide-y border-y text-sm leading-6">
            <div className="py-3">
              <dt className="font-bold">Pacing</dt>
              <dd className="text-muted-foreground">
                {report.responseTime.interpretation}
              </dd>
            </div>
            <div className="py-3">
              <dt className="font-bold">Recent answers</dt>
              <dd className="text-muted-foreground">{report.transferSignal}</dd>
            </div>
            <div className="py-3">
              <dt className="font-bold">Next review</dt>
              <dd className="text-muted-foreground">{report.decaySignal}</dd>
            </div>
          </dl>
        </div>
      </details>

      <details className="group border-y-2 border-foreground">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-3 font-bold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span>Missed-answer notes</span>
          <span className="text-sm text-muted-foreground">
            {report.misconceptions.length} saved
          </span>
        </summary>
        <div className="border-t-2 border-foreground py-7">
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Scout saves the label attached to a missed choice. It does not guess
            why you chose that answer.
          </p>
          {report.misconceptions.length ? (
            <div className="mt-5 overflow-x-auto border-y-2 border-foreground">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="bg-foreground text-background">
                  <tr>
                    <th className="px-4 py-3">Missed-choice label</th>
                    <th className="px-4 py-3">Skill</th>
                    <th className="px-4 py-3">Seen</th>
                    {canViewTechnicalDetails ? (
                      <th className="px-4 py-3">Question ID</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.misconceptions.map((item) => (
                    <tr key={`${item.skill}:${item.label}`}>
                      <td className="px-4 py-3 font-semibold">{item.label}</td>
                      <td className="px-4 py-3">{item.skillLabel}</td>
                      <td className="px-4 py-3">{item.count}×</td>
                      {canViewTechnicalDetails ? (
                        <td className="px-4 py-3 font-mono text-xs">
                          {item.latestQuestionId}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-5 border-y py-5 text-sm text-muted-foreground">
              No unresolved missed-answer note is saved yet.
            </p>
          )}
          {report.prerequisiteConfusion ? (
            <div className="mt-5 border-l-4 border-[var(--scout-sun)] bg-[var(--coach-surface)] p-5">
              <p className="font-bold">Review first</p>
              <p className="mt-2 text-sm leading-6">
                {report.prerequisiteConfusion}
              </p>
            </div>
          ) : null}
        </div>
      </details>

      <details className="group border-y-2 border-foreground">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-3 font-bold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span>Correct a skill estimate</span>
          <span className="text-sm text-muted-foreground">
            {report.corrections.length
              ? `${report.corrections.length} saved`
              : "Optional"}
          </span>
        </summary>
        <div className="grid gap-7 border-t-2 border-foreground py-7 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-2xl font-black">
              Tell Scout what it got wrong.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Your note is saved separately from scored answers. New practice
              answers still update the estimate normally.
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
                  aria-pressed={correctionKind === value}
                  onClick={() => setCorrectionKind(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <label
              htmlFor="learner-model-correction"
              className="mt-4 block text-sm font-semibold"
            >
              What should Scout correct?
            </label>
            <textarea
              id="learner-model-correction"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={300}
              className="mt-2 w-full border-2 border-foreground bg-background p-3 text-sm"
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
                  ? "Correction already saved for this skill"
                  : "Save correction"}
            </Button>
          </div>
          <div>
            <p className="ink-label text-muted-foreground">
              Previous corrections
            </p>
            {report.corrections.length ? (
              <ol className="mt-4 divide-y border-y text-sm">
                {report.corrections.slice(0, 5).map((item) => (
                  <li key={item.id} className="py-3">
                    <p className="font-bold">
                      {item.skillLabel} · {item.kind.replaceAll("-", " ")}
                    </p>
                    <p className="mt-1 text-muted-foreground">{item.note}</p>
                    <p className="mt-1 font-mono text-xs">
                      {Math.round(item.before * 100)}% →{" "}
                      {Math.round(item.after * 100)}%
                      {canViewTechnicalDetails ? ` · ${item.modelVersion}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 border-y py-5 text-sm text-muted-foreground">
                No corrections saved yet.
              </p>
            )}
          </div>
        </div>
      </details>
    </div>
  )
}
