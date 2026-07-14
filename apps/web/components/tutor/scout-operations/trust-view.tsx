"use client"

import { useEffect, useState } from "react"
import {
  CloudOffIcon,
  DownloadIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react"

import type { ScoutOperationsLabProps } from "@/components/tutor/scout-operations/types"
import { Button } from "@/components/ui/button"

interface GroupMetricRecord {
  group: string
  questionSelectionRate: number
  predictionError: number
  stoppingQuestions: number
}

interface GroupMetricRow extends GroupMetricRecord {
  records: number
}

function parseGroupMetricRecords(value: unknown): GroupMetricRecord[] {
  const candidates = Array.isArray(value) ? value : [value]
  return candidates.map((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      throw new TypeError("Imported group-metric records must be objects.")
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
      throw new TypeError("An imported group-metric record is malformed.")
    }
    return record
  })
}

export function TrustView({
  plan,
  learning,
  busy,
  onDeleteData,
}: Pick<
  ScoutOperationsLabProps,
  "plan" | "learning" | "busy" | "onDeleteData"
>) {
  const [online, setOnline] = useState(true)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [queued, setQueued] = useState(0)
  const [quarantined, setQuarantined] = useState(0)
  const [groupMetricRows, setGroupMetricRows] = useState<GroupMetricRow[]>([])
  const [groupMetricError, setGroupMetricError] = useState("")

  useEffect(() => {
    function update() {
      setOnline(navigator.onLine)
      try {
        const pending = JSON.parse(
          window.localStorage.getItem("scout-offline-answer-queue-v2") ?? "[]"
        ) as unknown[]
        const held = JSON.parse(
          window.localStorage.getItem("scout-offline-answer-quarantine-v2") ??
            "[]"
        ) as unknown[]
        setQueued(Array.isArray(pending) ? pending.length : 0)
        setQuarantined(Array.isArray(held) ? held.length : 0)
      } catch {
        setQueued(0)
        setQuarantined(0)
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

  async function importGroupMetrics(files: FileList | null) {
    if (!files?.length) return
    setGroupMetricError("")
    try {
      const records = (
        await Promise.all(
          [...files].map(async (file) =>
            parseGroupMetricRecords(JSON.parse(await file.text()) as unknown)
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
        questionSelectionRate: values.questionSelectionRate / values.records,
        predictionError: values.predictionError / values.records,
        stoppingQuestions: values.stoppingQuestions / values.records,
        records: values.records,
      }))
      if (rows.length < 2 || rows.some((row) => row.records < 2)) {
        throw new TypeError(
          "Use at least two consented groups with two records per group."
        )
      }
      setGroupMetricRows(
        rows.sort((left, right) => left.group.localeCompare(right.group))
      )
    } catch (error) {
      setGroupMetricRows([])
      setGroupMetricError(
        error instanceof Error
          ? error.message
          : "Scout could not read the group-metric file."
      )
    }
  }

  return (
    <div className="space-y-12">
      <section className="grid border-y-2 border-foreground lg:grid-cols-2 lg:divide-x-2 lg:divide-foreground">
        <div className="py-7 lg:pr-8">
          <p className="ink-label text-primary">Model-version comparison</p>
          <h2 className="mt-2 font-heading text-3xl font-black">
            {learning.trustReport.modelComparison.agrees
              ? "Two policies agree."
              : "The policies disagree—and Scout shows why."}
          </h2>
          <dl className="mt-5 grid grid-cols-2 gap-5 border-t-2 border-foreground pt-4">
            <div>
              <dt className="ink-label text-muted-foreground">BKT 1.0</dt>
              <dd className="mt-1 font-bold">
                {learning.trustReport.modelComparison.current}
              </dd>
            </div>
            <div>
              <dt className="ink-label text-muted-foreground">
                Accuracy model
              </dt>
              <dd className="mt-1 font-bold">
                {learning.trustReport.modelComparison.comparison}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {learning.trustReport.modelComparison.explanation}
          </p>
        </div>
        <div className="py-7 lg:pl-8">
          <p className="ink-label text-muted-foreground">
            One-state decision comparison
          </p>
          <ol className="mt-4 divide-y border-y text-sm">
            {learning.trustReport.policyBenchmarks.map((policy) => (
              <li key={policy.policy} className="py-3">
                <p className="font-bold">
                  {policy.policy}: {policy.nextSkill}
                </p>
                <p className="mt-1 text-muted-foreground">{policy.tradeoff}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            This compares what each simple selection rule would choose right
            now. It is not an experiment, learning-gain benchmark, or claim
            about which policy performs best.
          </p>
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
              <thead className="bg-foreground text-background">
                <tr>
                  <th className="px-4 py-3">Evidence</th>
                  <th className="px-4 py-3">BKT decision</th>
                  <th className="px-4 py-3">Accuracy-only replay</th>
                  <th className="px-4 py-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {learning.decisionHistory.slice(0, 8).map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3">
                      <span className="block font-bold">
                        {event.answerSummary}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {event.questionId}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {event.planAfter}
                      <span className="block text-xs text-muted-foreground">
                        {event.modelVersion}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {event.comparisonPlanLabel ??
                        "Not stored for this older event"}
                      <span className="block text-xs text-muted-foreground">
                        {event.comparisonModelVersion ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {event.comparisonPlan
                        ? event.comparisonPlan === event.planAfter
                          ? "Same"
                          : "Different"
                        : "Abstained"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 border-y py-5 text-sm text-muted-foreground">
            No scored decision exists yet. Scout will store both policy choices
            with the next answer instead of inventing a historical replay.
          </p>
        )}
      </section>

      <section>
        <p className="ink-label text-primary">Your question history</p>
        <h2 className="mt-2 font-heading text-4xl font-black">
          Patterns, not item verdicts.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          This is one learner&apos;s exposure and miss history. It can suggest a
          question for human review, but it cannot prove that a question is
          good, bad, fair, or unfair.
        </p>
        {learning.trustReport.itemHealth.length ? (
          <div className="mt-6 overflow-x-auto border-y-2 border-foreground">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="bg-foreground text-background">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {learning.trustReport.itemHealth.map((item) => (
                  <tr key={item.questionId}>
                    <td className="px-4 py-3 font-mono text-xs">
                      {item.questionId}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {item.status === "watch"
                        ? "Review this learner pattern"
                        : item.status === "healthy"
                          ? "No repeat-miss warning"
                          : "Not enough history"}
                    </td>
                    <td className="max-w-2xl px-4 py-3 text-muted-foreground">
                      {item.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 border-y py-5 text-sm text-muted-foreground">
            No question has enough learner history to show a pattern yet.
          </p>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <p className="ink-label text-primary">Imported group-metric viewer</p>
          <div className="mt-4 border-y-2 border-foreground py-5">
            <p className="font-bold">
              Compare consented, precomputed group records
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              JSON fields: group, questionSelectionRate (0–1), predictionError,
              and stoppingQuestions. Scout averages the supplied rows for
              display; it does not derive or verify those metrics from raw
              assessment events. Files stay in this browser.
            </p>
            <input
              type="file"
              accept="application/json,.json"
              multiple
              className="mt-4 block w-full text-sm"
              onChange={(event) => void importGroupMetrics(event.target.files)}
            />
            {groupMetricError ? (
              <p
                role="alert"
                className="mt-3 text-sm font-bold text-destructive"
              >
                {groupMetricError}
              </p>
            ) : null}
            {groupMetricRows.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-xs">
                  <thead>
                    <tr>
                      <th className="py-2 pr-3">Group</th>
                      <th className="py-2 pr-3">Selection</th>
                      <th className="py-2 pr-3">Error</th>
                      <th className="py-2">Stop</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {groupMetricRows.map((row) => (
                      <tr key={row.group}>
                        <td className="py-2 pr-3 font-bold">
                          {row.group} ({row.records})
                        </td>
                        <td className="py-2 pr-3">
                          {Math.round(row.questionSelectionRate * 100)}%
                        </td>
                        <td className="py-2 pr-3">
                          {row.predictionError.toFixed(1)}
                        </td>
                        <td className="py-2">
                          {row.stoppingQuestions.toFixed(1)} Q
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-muted-foreground">
                  These are imported summary values, not a Scout-run fairness
                  audit. Review any material group gap with a qualified human;
                  this table does not infer a cause.
                </p>
              </div>
            ) : (
              <div className="mt-4 border-l-4 border-[var(--scout-sun)] bg-[var(--coach-surface)] p-4">
                <p className="font-bold">No unsupported fairness claim</p>
                <p className="mt-2 text-sm leading-6">
                  {learning.trustReport.abstentions[0]}
                </p>
              </div>
            )}
          </div>
        </div>
        <div>
          <p className="ink-label text-muted-foreground">Model abstention</p>
          <div className="mt-4 border-l-4 border-primary bg-[var(--info-surface)] p-5">
            <p className="font-bold">
              Scout says “not enough evidence” on purpose.
            </p>
            <p className="mt-2 text-sm leading-6">
              {learning.trustReport.abstentions[1]}
            </p>
          </div>
        </div>
      </section>

      <section className="border-y-2 border-foreground py-7">
        <p className="ink-label text-primary">Generation safety evaluation</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {learning.lessonReceipt.validationChecks.map((check) => (
            <div key={check} className="border-t-2 border-foreground pt-3">
              <ShieldCheckIcon className="text-primary" />
              <p className="mt-2 text-sm font-semibold">{check}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          Provider: {learning.lessonReceipt.generatorStatus}. Automated result:{" "}
          {learning.lessonReceipt.validationResult}. Delivery:{" "}
          {learning.lessonReceipt.deliveredAs}. The listed checks are the only
          checks this receipt claims; a reviewed fallback is used when generated
          content fails them.
        </p>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <p className="ink-label text-primary">Private guest mode</p>
          <h2 className="mt-2 font-heading text-3xl font-black">
            No account required.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This device uses private session cookies and local preferences.
            Export a readable copy or delete the session whenever you want.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={exportData}>
              <DownloadIcon /> Export my data
            </Button>
            {!deleteArmed ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleteArmed(true)}
              >
                <Trash2Icon /> Delete my data
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={onDeleteData}
              >
                {busy
                  ? "Waiting for every service…"
                  : "Confirm permanent deletion"}
              </Button>
            )}
          </div>
        </div>
        <div>
          <p className="ink-label text-muted-foreground">
            Weak-connection sync
          </p>
          <div className="mt-4 flex items-start gap-4 border-y-2 border-foreground py-5">
            {online ? (
              <ShieldCheckIcon className="text-primary" />
            ) : (
              <CloudOffIcon className="text-[var(--scout-coral)]" />
            )}
            <div>
              <p className="font-bold">
                {online ? "Online" : "Offline"} · {queued} waiting ·{" "}
                {quarantined} held
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Each saved answer is tied to one learner session, content
                version, and question order. A stale or malformed command is
                held instead of being applied to different work. New
                explanations and server grading still need a connection.
              </p>
              {quarantined ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    window.localStorage.removeItem(
                      "scout-offline-answer-quarantine-v2"
                    )
                    setQuarantined(0)
                  }}
                >
                  Clear held commands
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
