"use client"

import { useEffect, useRef, useState } from "react"
import type { AnswerConfidence, LearningSessionPayload } from "@act-tutor/core"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  Clock3Icon,
  LightbulbIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react"

import { ScoutCoach, type ScoutMood } from "@/components/tutor/scout"
import { useScoutContext } from "@/components/tutor/scout-assistant"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import {
  RadioGroup,
  VisuallyHiddenRadioGroupItem,
} from "@/components/ui/radio-group"
import { formatCalendarDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

interface LessonWorkspaceProps {
  learning: LearningSessionPayload
  activeSection: number
  selectedChoice: string
  submitting: boolean
  onSectionChange: (index: number) => void
  onChoiceChange: (choice: string) => void
  onCompleteLesson: () => void
  onTeachBack: (response: string) => void
  onLessonFeedback: (helpful: boolean, style: string) => Promise<boolean>
  onSubmitAnswer: (metadata: {
    confidence: AnswerConfidence
    selfCorrected: boolean
    responseSeconds: number
  }) => void
  onClose: () => void
  canViewTechnicalDetails: boolean
}

const SECTION_SHORT_LABELS = ["Learn", "Example", "Rule", "Try it"] as const

function GenerationStamp({ learning }: { learning: LearningSessionPayload }) {
  const ai = learning.lesson.generation.mode === "ai"
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
        {ai ? (
          <SparklesIcon aria-hidden="true" />
        ) : (
          <CheckCircle2Icon aria-hidden="true" />
        )}
        {ai ? "Personalized with AI" : "Reviewed lesson"}
      </span>
      <span>
        {ai
          ? `${learning.lesson.generation.provider} · ${learning.lesson.generation.model}`
          : "Works without an AI connection"}
      </span>
    </div>
  )
}

function LessonStage({
  learning,
  activeSection,
  submitting,
  onSectionChange,
  onCompleteLesson,
  onTeachBack,
  onLessonFeedback,
  canViewTechnicalDetails,
}: Pick<
  LessonWorkspaceProps,
  | "learning"
  | "activeSection"
  | "submitting"
  | "onSectionChange"
  | "onCompleteLesson"
  | "onTeachBack"
  | "onLessonFeedback"
  | "canViewTechnicalDetails"
>) {
  const section = learning.lesson.sections[activeSection]
  const isLast = activeSection === learning.lesson.sections.length - 1
  const sectionHeadingRef = useRef<HTMLHeadingElement>(null)
  const { accommodations, explanationPreferences } = useScoutContext()
  const [explanationMode, setExplanationMode] = useState<"standard" | "short">(
    explanationPreferences.depth === "quick" ? "short" : "standard"
  )
  const [teachBack, setTeachBack] = useState(learning.teachBack?.response ?? "")
  const [feedbackState, setFeedbackState] = useState<
    "idle" | "pending" | "saved" | "failed"
  >("idle")
  const currentSkill =
    learning.learningTwin.skills.find(
      (skill) => skill.skill === learning.todaySkill
    ) ?? learning.learningTwin.skills[0]
  const currentRecommendation = learning.learningTwin.recommendation
  const assignmentIsCurrentRecommendation =
    currentRecommendation.skill === learning.todaySkill

  useEffect(() => {
    sectionHeadingRef.current?.focus()
  }, [activeSection])
  async function saveFeedback(helpful: boolean) {
    setFeedbackState("pending")
    setFeedbackState(
      (await onLessonFeedback(helpful, explanationMode)) ? "saved" : "failed"
    )
  }
  const displayExplanation =
    explanationMode === "short"
      ? (section.explanation.split(/(?<=[.!?])\s+/)[0] ?? section.explanation)
      : section.explanation

  return (
    <div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <section className="min-w-0 px-5 py-7 sm:px-8 sm:py-9">
        <div className="flex flex-wrap items-center gap-3">
          <span className="ink-label text-primary">
            Part {activeSection + 1} of {learning.lesson.sections.length}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock3Icon aria-hidden="true" />
            {Math.max(2, Math.round(learning.lesson.minutes / 4))} min
          </span>
        </div>
        <h2
          ref={sectionHeadingRef}
          tabIndex={-1}
          className="mt-4 max-w-2xl font-heading text-3xl leading-tight font-black tracking-[-0.02em] outline-none sm:text-4xl"
        >
          {section.title}
        </h2>
        <p className="mt-5 max-w-3xl text-base leading-8 sm:text-lg">
          {displayExplanation}
        </p>
        <details className="group mt-4 max-w-xl">
          <summary className="cursor-pointer text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            Change how Scout explains this
          </summary>
          <div
            className="mt-3 flex flex-wrap gap-2"
            aria-label="Explanation style"
          >
            {(
              [
                ["standard", "Normal"],
                ["short", "Concise"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={explanationMode === value ? "secondary" : "outline"}
                aria-pressed={explanationMode === value}
                onClick={() => setExplanationMode(value)}
              >
                {label}
              </Button>
            ))}
            {accommodations.readAloud ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  window.speechSynthesis.cancel()
                  window.speechSynthesis.speak(
                    new SpeechSynthesisUtterance(displayExplanation)
                  )
                }}
              >
                Read this part aloud
              </Button>
            ) : null}
          </div>
        </details>

        {section.id === "guided-example" ? (
          <div className="paper-panel mt-7 border-2 border-foreground px-5 py-5 sm:px-6">
            <p className="ink-label text-muted-foreground">Worked example</p>
            <p className="mt-3 text-lg leading-7 font-semibold">
              {learning.lesson.workedExample.prompt}
            </p>
            <p className="mt-4 border-l-4 border-[var(--scout-sun)] pl-4 text-sm leading-7 text-muted-foreground">
              {learning.lesson.workedExample.explanation.join(" ")}
            </p>
            <p className="mt-4 font-semibold">
              Answer: {learning.lesson.workedExample.answer}
            </p>
          </div>
        ) : null}

        {section.id === "guided-example" ? (
          <div className="mt-5 grid border-y-2 border-foreground sm:grid-cols-2 sm:divide-x-2 sm:divide-foreground">
            <div className="py-4 sm:pr-5">
              <p className="ink-label text-primary">Solution that works</p>
              <p className="mt-2 text-sm leading-6">
                {learning.lesson.workedExample.answer}. It follows this rule:{" "}
                {learning.lesson.concept}
              </p>
            </div>
            <div className="py-4 sm:pl-5">
              <p className="ink-label text-[var(--scout-coral-text)]">
                Tempting wrong path
              </p>
              <p className="mt-2 text-sm leading-6">
                {learning.lesson.trap} Compare the exact decision, not just how
                the answer sounds.
              </p>
            </div>
          </div>
        ) : null}
        {section.id === "decision-rule" ? (
          <ol className="mt-7 border-y-2 border-foreground">
            {learning.lesson.strategyChecklist.map((step, index) => (
              <li
                key={step}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start border-b border-border py-4 last:border-0"
              >
                <span className="font-mono text-sm font-bold text-primary">
                  0{index + 1}
                </span>
                <span className="text-sm leading-6 sm:text-base">{step}</span>
              </li>
            ))}
          </ol>
        ) : null}

        {section.id === "transfer" ? (
          <>
            <div className="mt-7 border-2 border-dashed border-foreground p-5">
              <p className="ink-label">Try it yourself</p>
              <p className="mt-3 text-lg leading-7 font-semibold">
                {learning.lesson.transferPrompt}
              </p>
            </div>
            <div className="mt-5 border-2 border-foreground bg-[var(--info-surface)] p-5">
              <label
                htmlFor="lesson-teach-back"
                className="ink-label text-primary"
              >
                Explain it in your own words
              </label>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Write the rule, why it works, and one example.
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                This quick check looks for the rule, a reason, and an example.
                It checks structure, not whether the explanation itself is
                correct.
              </p>
              <textarea
                id="lesson-teach-back"
                value={teachBack}
                onChange={(event) => setTeachBack(event.target.value)}
                rows={4}
                maxLength={1000}
                className="mt-4 w-full border-2 border-foreground bg-background p-3 text-sm"
                placeholder="The rule is… It works because… For example…"
              />
              <Button
                type="button"
                className="mt-3"
                disabled={teachBack.trim().length < 20 || submitting}
                onClick={() => onTeachBack(teachBack)}
              >
                Check for three required parts
              </Button>
              {learning.teachBack ? (
                <div className="mt-4 border-t pt-4">
                  <p className="font-bold">
                    Pattern check: {learning.teachBack.score}/
                    {learning.teachBack.maxScore} parts
                  </p>
                  <ul className="mt-2 grid gap-1 text-sm">
                    {learning.teachBack.rubric.map((item, index) => (
                      <li key={item.label}>
                        {item.met ? "✓" : "○"}{" "}
                        {[
                          "Includes a keyword from the lesson rule",
                          "Includes a why/because phrase",
                          "Includes an example cue",
                        ][index] ?? item.label}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm">
                    {learning.teachBack.score === 3
                      ? "All three text patterns were found."
                      : learning.teachBack.score === 2
                        ? "Two text patterns were found. Add the missing part shown above."
                        : "One or none of the text patterns were found. Use the prompt above to add the missing parts."}{" "}
                    This checks structure only; it does not grade whether the
                    explanation is correct.
                  </p>
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        <ScoutCoach
          className="mt-8"
          mood={activeSection === 1 ? "thinking" : "ready"}
          message={section.coachPrompt}
          detail={learning.lesson.evidenceSummary}
        />

        <div className="mt-8 flex flex-wrap gap-3 border-t pt-6">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={activeSection === 0}
            onClick={() => onSectionChange(activeSection - 1)}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Previous
          </Button>
          {isLast ? (
            <Button
              type="button"
              size="lg"
              onClick={onCompleteLesson}
              disabled={submitting}
            >
              <CheckCircle2Icon data-icon="inline-start" />
              {submitting
                ? "Saving lesson…"
                : learning.mode === "micro"
                  ? "Start one-question practice"
                  : "Start focused practice"}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={() => onSectionChange(activeSection + 1)}
            >
              Next
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          )}
        </div>
      </section>

      <aside className="border-t bg-[var(--rail)] px-5 py-7 lg:border-t-0 lg:border-l lg:px-6">
        <p className="ink-label text-muted-foreground">Why Scout picked this</p>
        <p className="mt-3 text-sm leading-6">
          {currentSkill && assignmentIsCurrentRecommendation
            ? `Scout chose ${currentSkill.label} because your recent answers and amount of practice show it needs attention next. Your ACT goal does not affect this choice.`
            : `This assignment was already in progress, so Scout kept it open. Finish it before moving to ${currentRecommendation.label}.`}
        </p>
        <div className="mt-6 border-y py-5">
          <p className="ink-label text-muted-foreground">Lesson depth</p>
          <p className="mt-2 font-heading text-2xl font-bold capitalize">
            {learning.lesson.depth}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {learning.lesson.depth === "foundation"
              ? "Starts with the core rule and a clear worked example."
              : learning.lesson.depth === "standard"
                ? "Uses the core rule with moderate ACT-style variation."
                : "Uses harder wording with less step-by-step support."}
          </p>
          {canViewTechnicalDetails ? (
            <details className="mt-3 text-xs leading-5 text-muted-foreground">
              <summary className="cursor-pointer font-semibold text-foreground">
                How Scout chose this level
              </summary>
              <p className="mt-2">
                Foundation means no matching check evidence or under 45%
                correct. Standard means 45–79%. Stretch means at least 80% with
                a goal of 30 or higher. Regular practice does not change this
                label.
              </p>
            </details>
          ) : null}
        </div>
        <p className="ink-label mt-6 text-muted-foreground">Common trap</p>
        <p className="mt-3 text-sm leading-6">{learning.lesson.trap}</p>
        {canViewTechnicalDetails ? (
          <details className="mt-6 border-t pt-5">
            <summary className="cursor-pointer font-bold">
              How this lesson was checked
            </summary>
            <div className="mt-4">
              <GenerationStamp learning={learning} />
            </div>
            <dl className="mt-4 grid gap-4 text-sm leading-6">
              <div>
                <dt className="ink-label text-muted-foreground">Skill goal</dt>
                <dd className="mt-1">{learning.lessonReceipt.objective}</dd>
              </div>
              <div>
                <dt className="ink-label text-muted-foreground">
                  Evidence questions
                </dt>
                <dd className="mt-1 break-words">
                  {learning.lessonReceipt.evidenceQuestionIds.length
                    ? learning.lessonReceipt.evidenceQuestionIds.join(", ")
                    : "No prior scored question; baseline evidence used"}
                </dd>
              </div>
              <div>
                <dt className="ink-label text-muted-foreground">
                  Generator status
                </dt>
                <dd className="mt-1">
                  {learning.lessonReceipt.generatorStatus}
                </dd>
              </div>
              <div>
                <dt className="ink-label text-muted-foreground">
                  Delivered as
                </dt>
                <dd className="mt-1 font-semibold">
                  {learning.lessonReceipt.deliveredAs === "generated"
                    ? "Generated lesson"
                    : learning.lessonReceipt.deliveredAs === "human-reviewed"
                      ? "Teacher-reviewed lesson"
                      : "Reviewed fallback lesson"}
                </dd>
              </div>
              <div>
                <dt className="ink-label text-muted-foreground">
                  Reviewed rule
                </dt>
                <dd className="mt-1">{learning.lessonReceipt.approvedRule}</dd>
              </div>
              <div>
                <dt className="ink-label text-muted-foreground">
                  Content check
                </dt>
                <dd className="mt-1 font-semibold">
                  {learning.lessonReceipt.validationResult ===
                  "automated-checks-passed"
                    ? "Automated checks passed"
                    : learning.lessonReceipt.validationResult ===
                        "human-reviewed"
                      ? "Teacher review saved"
                      : "Reviewed fallback used"}
                </dd>
              </div>
            </dl>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {learning.lessonReceipt.validationChecks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {learning.lessonReceipt.validationResult ===
              "automated-checks-passed"
                ? "These automated checks verify required fields, the approved rule token, and blocked phrases. They do not verify every instructional claim."
                : learning.lessonReceipt.validationResult === "human-reviewed"
                  ? "This receipt records a saved teacher review; it does not show when or how thoroughly each claim was checked."
                  : "The generated draft did not pass the automated gate, so Scout used the reviewed fallback lesson."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={feedbackState === "pending"}
                onClick={() => void saveFeedback(true)}
              >
                This explanation helped
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={feedbackState === "pending"}
                onClick={() => void saveFeedback(false)}
              >
                Still confusing
              </Button>
            </div>
            {feedbackState !== "idle" ? (
              <p
                className="mt-2 text-xs font-semibold"
                role={feedbackState === "failed" ? "alert" : "status"}
              >
                {feedbackState === "pending"
                  ? "Saving feedback…"
                  : feedbackState === "saved"
                    ? "Feedback saved."
                    : "Feedback was not saved. Try again."}
              </p>
            ) : null}
          </details>
        ) : (
          <div className="mt-6 border-t pt-5">
            <p className="text-sm font-bold">Was this explanation helpful?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={feedbackState === "pending"}
                onClick={() => void saveFeedback(true)}
              >
                This explanation helped
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={feedbackState === "pending"}
                onClick={() => void saveFeedback(false)}
              >
                Still confusing
              </Button>
            </div>
            {feedbackState !== "idle" ? (
              <p
                className="mt-2 text-xs font-semibold"
                role={feedbackState === "failed" ? "alert" : "status"}
              >
                {feedbackState === "pending"
                  ? "Saving feedback…"
                  : feedbackState === "saved"
                    ? "Feedback saved."
                    : "Feedback was not saved. Try again."}
              </p>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  )
}

function PracticeStage({
  learning,
  selectedChoice,
  submitting,
  onChoiceChange,
  onSubmitAnswer,
  canViewTechnicalDetails,
}: Pick<
  LessonWorkspaceProps,
  | "learning"
  | "selectedChoice"
  | "submitting"
  | "onChoiceChange"
  | "onSubmitAnswer"
  | "canViewTechnicalDetails"
>) {
  const answered = learning.answeredQuestionIds.length
  const currentQuestion = learning.questions[learning.currentQuestionIndex]
  const currentSkill =
    learning.learningTwin.skills.find(
      (skill) => skill.skill === (currentQuestion?.skill ?? learning.todaySkill)
    ) ??
    learning.learningTwin.skills.find(
      (skill) => skill.skill === learning.todaySkill
    ) ??
    learning.learningTwin.skills[0]
  const currentRecommendation = learning.learningTwin.recommendation
  const currentEstimate = currentSkill
    ? Math.round(currentSkill.learnedProbability * 100)
    : null
  const progress = Math.round((answered / learning.questions.length) * 100)
  const feedback = learning.lastFeedback
  const feedbackQuestion = feedback
    ? learning.questions.find((question) => question.id === feedback.questionId)
    : null
  const practiceLabel =
    learning.mode === "repair"
      ? "Retry"
      : learning.mode === "checkpoint"
        ? "Mixed quiz"
        : learning.mode === "retention"
          ? "Retention check"
          : learning.mode === "challenge"
            ? "Mastery challenge"
            : learning.mode === "recovery"
              ? "Recovery session"
              : learning.mode === "micro"
                ? "Three-minute study"
                : "Practice"
  const mood: ScoutMood = feedback
    ? feedback.correct
      ? "correct"
      : "repair"
    : "thinking"
  const isExitTicket =
    learning.mode === "focus" &&
    learning.currentQuestionIndex === learning.questions.length - 1
  const [confidence, setConfidence] = useState<AnswerConfidence>("sure")
  const [reviewing, setReviewing] = useState(false)
  const [initialChoice, setInitialChoice] = useState("")
  const [hintLevel, setHintLevel] = useState(0)
  const [explanationStyle, setExplanationStyle] = useState<
    "step-by-step" | "compare" | "simple"
  >("step-by-step")
  const startedAt = useRef<number | null>(null)

  useEffect(() => {
    startedAt.current = window.performance.now()
  }, [currentQuestion?.id])

  if (learning.status === "complete") {
    const completionSkill =
      learning.learningTwin.skills.find(
        (skill) => skill.skill === feedbackQuestion?.skill
      ) ?? currentSkill
    const testedSkills = learning.learningTwin.skills.filter((skill) =>
      learning.questions.some((question) => question.skill === skill.skill)
    )
    const latestDelta = completionSkill?.lastUpdate
      ? Math.round(completionSkill.lastUpdate.delta * 100)
      : null
    const nextReview = learning.lastFeedback?.review
    return (
      <section className="px-5 py-10 sm:px-8 sm:py-12">
        <ScoutCoach
          mood="correct"
          message={
            testedSkills.length > 1
              ? `Practice complete. Scout updated the ${testedSkills.length} skills you practiced and chose what to study next.`
              : `Practice complete. Scout updated its estimate for ${completionSkill?.label ?? "the skill you practiced"} and chose what to study next.`
          }
          detail="Your dated My week calendar stays the same."
        />
        <h2 className="mt-8 font-heading text-4xl leading-tight font-black tracking-[-0.03em]">
          {learning.mode === "repair"
            ? "Mistake fixed."
            : learning.mode === "checkpoint"
              ? "Quiz complete."
              : learning.mode === "retention"
                ? "Review complete."
                : learning.mode === "challenge"
                  ? "Challenge complete."
                  : learning.mode === "recovery"
                    ? "Recovery complete."
                    : "Practice complete."}
        </h2>
        <p className="mt-5 max-w-2xl text-lg leading-8">
          {completionSkill ? (
            <>
              {testedSkills.length > 1 ? "The last answered skill was " : ""}
              {completionSkill.label}. Scout&apos;s practice estimate is now{" "}
              <strong>
                {Math.round(completionSkill.learnedProbability * 100)}%
              </strong>
              , based on {completionSkill.evidenceCount} scored{" "}
              {completionSkill.evidenceCount === 1 ? "answer" : "answers"}. This
              is not percent correct or an ACT score.
            </>
          ) : (
            "Scout saved the practice answers, but no matching skill estimate was available to display."
          )}
        </p>
        <dl className="mt-8 grid max-w-3xl border-y-2 border-foreground sm:grid-cols-3 sm:divide-x-2 sm:divide-foreground">
          <div className="px-4 py-5 first:pl-0">
            <dt className="ink-label text-muted-foreground">
              Last skill change
            </dt>
            <dd className="mt-2 font-heading text-3xl font-bold">
              {latestDelta === null
                ? "No update"
                : `${latestDelta > 0 ? "+" : ""}${latestDelta} points`}
            </dd>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              How much the latest answer changed this skill estimate.
            </p>
          </div>
          <div className="px-4 py-5">
            <dt className="ink-label text-muted-foreground">Next review</dt>
            <dd className="mt-2 font-heading text-2xl font-bold">
              {nextReview?.nextReviewAt
                ? formatCalendarDate(nextReview.nextReviewAt.slice(0, 10))
                : "Pending"}
            </dd>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {nextReview
                ? `Scheduled from the latest answer using Scout’s ${nextReview.intervalDays}-day review rule.`
                : "Scout has not scheduled the next review yet."}
            </p>
          </div>
          <div className="px-4 py-5 last:pr-0">
            <dt className="ink-label text-muted-foreground">Study next</dt>
            <dd className="mt-2 text-sm leading-6 font-semibold">
              {currentRecommendation.label}
            </dd>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Scout chose this from your recent answers and amount of practice.
              It does not alter My week automatically.
            </p>
          </div>
        </dl>
      </section>
    )
  }

  return (
    <section
      data-practice-workspace
      className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <div className="min-w-0 px-5 py-7 sm:px-8 sm:py-9">
        <div className="flex items-center justify-between gap-4">
          <p className="ink-label text-primary">
            {isExitTicket
              ? "Independent exit ticket"
              : `${practiceLabel} · Guided practice`}{" "}
            · Question {learning.currentQuestionIndex + 1} of{" "}
            {learning.questions.length}
          </p>
          <span className="font-mono text-sm font-bold">{progress}%</span>
        </div>
        <Progress value={progress} className="mt-3">
          <ProgressLabel className="sr-only">
            Focused practice progress
          </ProgressLabel>
        </Progress>

        {currentQuestion?.stimulus ? (
          <div className="mt-7 border-y-2 border-foreground bg-background px-1 py-5 text-base leading-8">
            {currentQuestion.stimulus}
          </div>
        ) : null}
        <h2 className="mt-7 max-w-3xl font-heading text-2xl leading-tight font-bold tracking-[-0.01em] sm:text-3xl">
          {currentQuestion?.prompt}
        </h2>
        {currentQuestion ? (
          <RadioGroup
            value={selectedChoice}
            onValueChange={(choice) => {
              onChoiceChange(choice)
            }}
            className="mt-7 grid gap-3"
            aria-label="Practice answer choices"
          >
            {currentQuestion.choices.map((choice, index) => (
              <label
                key={choice.id}
                className={cn(
                  "grid cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)] items-start rounded-lg border border-border bg-background px-4 py-4 text-sm leading-6 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 hover:border-primary sm:text-base",
                  selectedChoice === choice.id && "border-primary bg-secondary"
                )}
              >
                <VisuallyHiddenRadioGroupItem value={choice.id} />
                <span className="col-start-1 row-start-1 font-mono font-bold text-primary">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="col-start-2 row-start-1 min-w-0">
                  {choice.text}
                </span>
              </label>
            ))}
          </RadioGroup>
        ) : null}
        {!isExitTicket && hintLevel > 0 ? (
          <div className="mt-5 border-l-4 border-[var(--scout-sun)] bg-[var(--coach-surface)] p-4">
            <p className="ink-label">Hint {hintLevel} of 2</p>
            <p className="mt-2 text-sm leading-6">
              {hintLevel === 1
                ? learning.lesson.strategyChecklist[0]
                : learning.lesson.transferPrompt}
            </p>
          </div>
        ) : null}
        <div className="mt-6 border-y py-5">
          <p className="ink-label text-muted-foreground">How sure are you?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["sure", "Sure"],
                ["unsure", "Unsure"],
                ["guessing", "Guessing"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={confidence === value ? "secondary" : "outline"}
                aria-pressed={confidence === value}
                size="sm"
                onClick={() => setConfidence(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Confidence never changes whether your answer is right. It only
            changes how strongly Scout adjusts this skill estimate.
          </p>
        </div>
        {reviewing ? (
          <div className="mt-5 border-l-4 border-primary bg-[var(--info-surface)] p-4">
            <p className="font-bold">One last look before scoring</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep your choice or change it before Scout checks the answer.
              Changing it is okay; Scout will make a smaller adjustment to this
              skill estimate.
            </p>
          </div>
        ) : null}
        {!isExitTicket ? (
          <Button
            type="button"
            variant="ghost"
            className="mt-5"
            disabled={hintLevel >= 2 || reviewing}
            onClick={() => setHintLevel((level) => Math.min(2, level + 1))}
          >
            <LightbulbIcon />
            {hintLevel === 0 ? "Give me a hint" : "Give me another hint"}
          </Button>
        ) : (
          <p className="mt-5 text-sm font-semibold">
            No hints here—this answer checks whether the lesson stuck.
          </p>
        )}
        <Button
          type="button"
          size="xl"
          className="mt-6"
          onClick={() => {
            if (!reviewing) {
              setInitialChoice(selectedChoice)
              setReviewing(true)
              return
            }
            onSubmitAnswer({
              confidence,
              selfCorrected: initialChoice !== selectedChoice,
              responseSeconds: Math.max(
                1,
                Math.round(
                  (window.performance.now() -
                    (startedAt.current ?? window.performance.now())) /
                    1000
                )
              ),
            })
          }}
          disabled={!selectedChoice || submitting}
        >
          <BrainCircuitIcon data-icon="inline-start" />
          {submitting
            ? "Checking your answer…"
            : reviewing
              ? "Check answer"
              : "Review answer"}
        </Button>
      </div>

      <aside className="border-t bg-[var(--rail)] px-5 py-7 lg:border-t-0 lg:border-l lg:px-6">
        <ScoutCoach
          mood={mood}
          message={
            feedback
              ? feedback.correct
                ? "Correct. Say the rule in your own words before moving on."
                : "Not quite. Read the explanation, then try the next one."
              : undefined
          }
          detail={feedback?.rationale ?? learning.lesson.transferPrompt}
        />
        {feedback && canViewTechnicalDetails ? (
          <Alert className="mt-7 bg-background">
            {feedback.correct ? <CheckCircle2Icon /> : <CircleAlertIcon />}
            <AlertTitle>
              {feedback.correct ? "Correct" : "Here&apos;s what went wrong"}
            </AlertTitle>
            <AlertDescription>
              {feedback.correct
                ? feedback.rationale
                : explanationStyle === "step-by-step"
                  ? `First, name the rule: ${learning.lesson.strategyChecklist[0]} Then compare that rule with your choice. ${feedback.rationale}`
                  : explanationStyle === "compare"
                    ? `You chose ${feedbackQuestion?.choices.find((choice) => choice.id === feedback.selectedChoiceId)?.text ?? feedback.selectedChoiceId}. The correct choice is ${feedbackQuestion?.choices.find((choice) => choice.id === feedback.correctChoiceId)?.text ?? feedback.correctChoiceId}. The deciding rule is: ${learning.lesson.concept} ${feedback.rationale}`
                    : `${feedback.rationale} Rule to use: ${learning.lesson.concept}`}
            </AlertDescription>
          </Alert>
        ) : null}
        {feedback && !feedback.correct ? (
          <div className="mt-4">
            <p className="ink-label text-muted-foreground">
              Explain it another way
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["step-by-step", "Step by step"],
                  ["compare", "Compare choices"],
                  ["simple", "Simpler"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={explanationStyle === value ? "secondary" : "outline"}
                  onClick={() => setExplanationStyle(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {feedback ? (
          <details className="mt-4 text-xs leading-5 text-muted-foreground">
            <summary className="cursor-pointer font-semibold text-foreground">
              How Scout used this answer
            </summary>
            <p className="mt-2">
              Update multiplier: {Math.round(feedback.evidenceWeight * 100)}%.
              This is the confidence multiplier (Sure 100%, Unsure 78%, or
              Guessing 48%) multiplied by 82% when you changed your choice
              before checking, or by 100% when you kept it. Correctness selects
              the model&apos;s correct-answer or wrong-answer calculation; the
              multiplier controls how strongly that calculation changes the
              prior estimate.
            </p>
          </details>
        ) : null}
        <div className="mt-7 border-t pt-5">
          <p className="ink-label text-muted-foreground">
            Current skill estimate
          </p>
          <p className="mt-2 font-heading text-3xl font-black">
            {currentEstimate === null ? "Unavailable" : `${currentEstimate}%`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentSkill?.label ?? "No matching skill"}
          </p>
          <details className="mt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-semibold text-foreground">
              What this number means
            </summary>
            <p className="mt-2">
              {currentSkill
                ? `Scout built this from ${currentSkill.evidenceCount} scored ${currentSkill.evidenceCount === 1 ? "answer" : "answers"}. It is not percent correct or an ACT score.`
                : "Scout could not find a matching skill estimate for this question."}
            </p>
          </details>
        </div>
      </aside>
    </section>
  )
}

export function LessonWorkspace(props: LessonWorkspaceProps) {
  return (
    <div className="paper-panel overflow-hidden rounded-xl border bg-background">
      <header className="flex min-h-16 flex-wrap items-center gap-x-5 gap-y-3 border-b bg-background px-4 py-3 text-foreground sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
            {props.learning.mode === "repair"
              ? "Retry a missed question"
              : props.learning.mode === "checkpoint"
                ? "Mixed quiz"
                : props.learning.mode === "retention"
                  ? "Forgetting protection"
                  : props.learning.mode === "challenge"
                    ? "Mastery challenge"
                    : props.learning.mode === "recovery"
                      ? "Recovery session"
                      : props.learning.mode === "micro"
                        ? "Three-minute study"
                        : "Today’s lesson"}
          </p>
          <h1 className="mt-1 text-base leading-snug font-bold break-words sm:text-lg">
            {props.learning.mode === "repair"
              ? `Try again: ${props.learning.mastery.label}`
              : props.learning.mode === "checkpoint"
                ? "Three-skill check"
                : props.learning.mode === "retention"
                  ? `Two-question review: ${props.learning.mastery.label}`
                  : props.learning.mode === "challenge"
                    ? `Prove it: ${props.learning.mastery.label}`
                    : props.learning.mode === "recovery"
                      ? "Two-skill reset"
                      : props.learning.lesson.title}
          </h1>
        </div>
        {!props.learning.lessonComplete ? (
          <nav
            className="order-3 grid w-full grid-cols-4 gap-1 sm:order-none sm:flex sm:w-auto"
            aria-label="Lesson stages"
          >
            {SECTION_SHORT_LABELS.slice(
              0,
              props.learning.lesson.sections.length
            ).map((label, index) => (
              <Button
                key={label}
                type="button"
                variant={props.activeSection === index ? "secondary" : "ghost"}
                aria-current={
                  props.activeSection === index ? "step" : undefined
                }
                size="sm"
                className={cn(
                  "min-w-0 px-1.5 text-xs text-foreground sm:px-3 sm:text-[0.8rem]",
                  props.activeSection === index && "text-secondary-foreground"
                )}
                onClick={() => props.onSectionChange(index)}
              >
                {index + 1}. {label}
              </Button>
            ))}
          </nav>
        ) : (
          <span className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
            {props.learning.mode === "repair"
              ? "1 replay"
              : props.learning.mode === "checkpoint"
                ? "3 mixed questions"
                : props.learning.mode === "retention"
                  ? "2 review questions"
                  : props.learning.mode === "challenge"
                    ? "3 hard questions"
                    : props.learning.mode === "recovery"
                      ? "2 recovery questions"
                      : props.learning.mode === "micro"
                        ? "1 quick question"
                        : "Focused practice"}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={props.onClose}
          aria-label="Close lesson workspace"
        >
          <XIcon />
        </Button>
      </header>

      {props.learning.lessonComplete ? (
        <PracticeStage
          key={
            props.learning.questions[props.learning.currentQuestionIndex]?.id
          }
          {...props}
        />
      ) : (
        <LessonStage {...props} />
      )}
    </div>
  )
}
