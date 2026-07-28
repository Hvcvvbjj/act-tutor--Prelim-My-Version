import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

const root = new URL("../../", import.meta.url)

async function source(path: string) {
  return readFile(new URL(path, root), "utf8")
}

describe("mobile navigation contract", () => {
  it("keeps four primary mobile tabs, puts Scout in the header, and moves secondary tools to More", async () => {
    const dashboard = await source("components/tutor/dashboard.tsx")
    const mobileNav = dashboard.slice(
      dashboard.indexOf('aria-label="Primary study navigation"'),
      dashboard.indexOf(
        "<MobileOverflow",
        dashboard.indexOf('aria-label="Primary study navigation"')
      )
    )
    expect(mobileNav.match(/<DashboardTab/g)).toHaveLength(4)
    expect(mobileNav).toContain('value="today"')
    expect(mobileNav).toContain('value="plan"')
    expect(mobileNav).toContain('value="calibrate"')
    expect(mobileNav).toContain('value="progress"')
    expect(mobileNav).not.toContain("<ScoutHeaderButton")
    expect(dashboard).toContain(
      "<ScoutHeaderButton onOpen={() => setMoreOpen(false)} />"
    )
    expect(dashboard).toContain("grid-cols-5")
    expect(dashboard).toContain("MessageCircleIcon")
    expect(dashboard).toContain(
      'aria-current={moreActive ? "page" : undefined}'
    )
    expect(mobileNav).toContain("More")
    expect(dashboard).toContain("Timed Practice")
    expect(dashboard).toContain("Learning data")
    expect(dashboard).toContain("Learning settings")
    expect(dashboard).toContain('aria-label="Scout ACT, go to Today"')
    expect(dashboard).toContain("More from Scout")
    expect(dashboard).toContain("Practice, settings, and your learning data.")
    expect(dashboard).toContain("sticky top-0 z-50")
  })

  it("protects mobile width and 44px interaction targets", async () => {
    const styles = await source("app/globals.css")
    expect(styles).toContain("overflow-x: clip")
    expect(styles).toContain("min-height: 44px")
  })

  it("keeps the desktop study loop primary and puts timed practice in More", async () => {
    const dashboard = await source("components/tutor/dashboard.tsx")
    const desktopNav = dashboard.slice(
      dashboard.indexOf('aria-label="Study navigation"'),
      dashboard.indexOf(
        "</TabsList>",
        dashboard.indexOf('aria-label="Study navigation"')
      )
    )
    const desktopOverflow = dashboard.slice(
      dashboard.indexOf("function DesktopOverflow"),
      dashboard.indexOf("export function Dashboard")
    )

    expect(desktopNav.match(/<DashboardTab/g)).toHaveLength(4)
    expect(desktopNav).not.toContain('value="lab"')
    expect(desktopNav).not.toContain("Timed Practice")
    expect(desktopOverflow).toContain('preloadDashboardSurface("lab")')
    expect(desktopOverflow).toContain('onNavigate("lab")')
    expect(desktopOverflow).toContain("Timed Practice")
    expect(dashboard).toContain(
      "target.closest('[data-more-surface=\"true\"]')"
    )
    expect(dashboard).toContain(
      'window.addEventListener("pointerdown", closeMoreOnPointerDown)'
    )
  })
})

describe("learner-facing terminology contract", () => {
  it("uses Quick Check and Timed Practice consistently across UI and API feedback", async () => {
    const copy = (
      await Promise.all([
        source("components/tutor/dashboard.tsx"),
        source("components/tutor/scout-assistant.tsx"),
        source("components/tutor/exam-lab-setup.tsx"),
        source("app/api/exam-lab/route.ts"),
        source("app/api/scout/ask/route.ts"),
      ])
    ).join("\n")

    expect(copy).toContain("Quick Check")
    expect(copy).toContain("Timed Practice")
    expect(copy).not.toMatch(/\bTest (?:Day )?Lab\b/)
  })
})

describe("shared visual system contract", () => {
  it("uses readable display type and consistent control sizing", async () => {
    const layout = await source("app/layout.tsx")
    const styles = await source("app/globals.css")
    const buttons = await source("components/ui/button.tsx")
    const tabs = await source("components/ui/tabs.tsx")
    const mission = await source("components/tutor/daily-mission-hub.tsx")
    const onboarding = await source("components/tutor/onboarding.tsx")
    const quickCheck = await source(
      "components/tutor/adaptive-calibration-lab.tsx"
    )

    expect(layout).toContain("Archivo")
    expect(layout).not.toContain("Barlow_Condensed")
    expect(styles).toContain("--font-brand: var(--font-archivo)")
    expect(styles).toContain("--font-heading: var(--font-geist)")
    expect(styles).toContain("--canvas: #f6f8fb")
    expect(buttons).toContain('"h-9 gap-2 px-3.5')
    expect(tabs).toContain("group-data-horizontal/tabs:h-9")
    expect(tabs).toContain("data-active:text-primary")
    expect(mission).toContain('data-testid="today-focus"')
    expect(mission).toContain(
      "min-h-[calc(100svh-12rem)] max-w-3xl items-center justify-center"
    )
    expect(mission).not.toContain("lg:grid-cols-[minmax(0,1fr)_19rem]")
    expect(onboarding).toContain("grid grid-cols-3 gap-2")
    expect(onboarding).toContain(
      "w-full border-y-2 border-foreground py-8 sm:py-12"
    )
    expect(quickCheck).toContain('aria-labelledby="quick-check-heading"')
    expect(quickCheck).toContain('data-testid="quick-check-question-card"')
    expect(quickCheck).not.toContain(">Your next question<")
  })
})

describe("Scout drawer accessibility contract", () => {
  it("traps focus, closes on Escape, returns focus, and keeps the launcher in the app header", async () => {
    const assistant = await source("components/tutor/scout-assistant.tsx")
    const dashboard = await source("components/tutor/dashboard.tsx")
    expect(assistant).toContain('event.key === "Escape"')
    expect(assistant).toContain('event.key !== "Tab"')
    expect(assistant).toContain("lastFocusRef.current?.focus()")
    expect(assistant).toContain('aria-modal="true"')
    expect(assistant).not.toContain("<MessageCircleIcon /> Ask Scout")
    expect(dashboard).toContain("function ScoutHeaderButton")
    expect(dashboard).toContain('aria-label="Ask Scout"')
    expect(dashboard).toContain("min-h-11 min-w-11")
  })

  it("uses one clear accessible name for learning settings controls", async () => {
    const assistant = await source("components/tutor/scout-assistant.tsx")
    expect(assistant).toContain('aria-label="Learning settings"')
    expect(assistant).toContain('aria-label="Close learning settings"')
    expect(assistant).not.toContain("aria-label={label}")
    expect(assistant).not.toContain('aria-label="Use fewer technical terms"')
  })
})

describe("learner-facing model language", () => {
  it("keeps export and deletion controls available to every learner", async () => {
    const learnerModel = await source(
      "components/tutor/scout-operations/learner-model-view.tsx"
    )
    expect(learnerModel).toContain("Export my data")
    expect(learnerModel).toContain("Delete Scout study data")
    expect(learnerModel).toContain("Confirm study-data deletion")
  })

  it("uses plain planning labels and does not repeat the transfer caveat", async () => {
    const dashboard = await source("components/tutor/dashboard.tsx")
    const mission = await source("components/tutor/daily-mission-hub.tsx")
    const onboarding = await source("components/tutor/onboarding.tsx")
    const quickCheck = await source(
      "components/tutor/adaptive-calibration-lab.tsx"
    )
    const studyPlan = await source("components/tutor/adaptive-plan-studio.tsx")
    const learnerModel = await source(
      "components/tutor/scout-operations/learner-model-view.tsx"
    )
    const learningData = await source(
      "components/tutor/scout-operations-lab.tsx"
    )
    const lesson = await source("components/tutor/lesson-workspace.tsx")
    const progress = await source("components/tutor/mastery-profile.tsx")
    const timedPractice = await source("components/tutor/exam-lab-setup.tsx")
    const diagnosticIntro = await source(
      "components/tutor/diagnostic-intro.tsx"
    )
    const diagnosticRunner = await source(
      "components/tutor/diagnostic-runner.tsx"
    )
    expect(dashboard).not.toContain("function ScoreRoute")
    expect(dashboard).toContain("<PencilLineIcon /> Goal and schedule")
    expect(dashboard).toContain(
      'startMissionAction({ action: "start_next" }, true)'
    )
    expect(dashboard).toContain('!(workspaceOpen && activeTab === "today")')
    expect(mission).toContain("Next: {nextLabel}")
    expect(mission).toContain("Continue the practice questions for this skill.")
    expect(mission).not.toContain("Why Scout picked this")
    expect(mission).not.toContain("Later today")
    expect(mission).not.toContain("Planning baseline · not an ACT score")
    expect(mission).not.toContain("No streak yet")
    expect(onboarding).not.toContain(
      "This is a planning goal—not a score prediction"
    )
    expect(onboarding).toContain("See one answer change the plan")
    expect(onboarding).toContain("How Scout saves your work")
    expect(onboarding).toContain(
      "this browser keeps your setup, plan, and resume point"
    )
    expect(onboarding).toContain(
      "More → Learning data to export or delete saved study data"
    )
    expect(onboarding).toContain("Open the judge demo")
    expect(onboarding).toContain("viewer.technicalDetails")
    expect(onboarding).toContain("Skip for now")
    expect(onboarding).toContain("Create my starter plan")
    expect(onboarding).not.toContain("Preview Scout with sample answers")
    expect(quickCheck).toContain("Scout may")
    expect(quickCheck).toContain(
      'latestEvent.correct ? "Correct." : "Not quite."'
    )
    expect(quickCheck).toContain("Correct—Scout adjusted your next steps.")
    expect(quickCheck).toContain("1 · Question match")
    expect(quickCheck).toContain("Still next")
    expect(quickCheck).toContain(
      "Scout updated this check and the skill you just practiced."
    )
    expect(studyPlan).toContain('label: "Add study time"')
    expect(learnerModel).not.toContain("This records two adjacent answers")
    expect(learningData).toContain("See what Scout knows about your learning")
    expect(lesson).toContain('"Check answer"')
    expect(lesson).not.toContain("How sure are you?")
    expect(lesson).not.toContain("Review answer")
    expect(lesson).not.toContain("Why Scout picked this")
    expect(lesson).not.toContain("Change how Scout explains this")
    expect(lesson).not.toContain("section.coachPrompt")
    expect(lesson).not.toContain("practice-priority total")
    expect(lesson).toContain("lessonSegmentMinutes(")
    expect(progress).toContain("See skill map")
    expect(progress).toContain("How Scout chose this skill")
    expect(timedPractice).not.toContain("Sure, Unsure, or Guessing")
    expect(timedPractice).not.toContain("self-reported confidence")
    expect(diagnosticIntro).toContain("Find your starting point")
    expect(diagnosticIntro).not.toContain(
      "Create an internal planning baseline"
    )
    expect(diagnosticRunner).toContain("Your practice starting range")
    expect(diagnosticRunner).not.toContain("Your internal planning range")
    expect(mission).not.toContain("how uncertain the estimate is")
    expect(studyPlan).not.toContain("BKT estimate")
  })
})

describe("deadline performance contract", () => {
  it("defers secondary tutor modules and preloads them from user intent", async () => {
    const tutor = await source("components/tutor/tutor-app.tsx")
    const dashboard = await source("components/tutor/dashboard.tsx")

    expect(tutor).toContain("const Dashboard = dynamic(loadDashboard")
    expect(tutor).toContain("void loadDashboard()")
    expect(tutor).not.toContain(
      'import { Dashboard } from "@/components/tutor/dashboard"'
    )
    expect(dashboard).toContain("const TestDayLab = dynamic(loadTestDayLab")
    expect(dashboard).toContain('activeTab === "lab"')
    expect(dashboard).toContain('activeTab !== "plan"')
    expect(dashboard).toContain("onPointerEnter={preload}")
    expect(dashboard).not.toContain(
      'import { TestDayLab } from "@/components/tutor/test-day-lab"'
    )
  })
})

describe("account access contract", () => {
  it("keeps submission-only judge instructions out of the learner dialog", async () => {
    const account = await source("components/tutor/account-access.tsx")
    const normalizedAccount = account.replace(/\s+/g, " ")

    expect(account).not.toContain(
      "Judges can sign in with the credentials provided with the submission."
    )
    expect(normalizedAccount).toContain(
      "Signing in does not change how Scout chooses questions or lessons."
    )
  })
})

describe("deadline learner UX contract", () => {
  it("adds keyboard answers, progressive disclosure, and a copyable week", async () => {
    const quickCheck = await source(
      "components/tutor/adaptive-calibration-lab.tsx"
    )
    const studyPlan = await source("components/tutor/adaptive-plan-studio.tsx")

    expect(quickCheck).toContain("Keyboard: 1–4 or A–D chooses an answer")
    expect(quickCheck).toContain(
      'window.addEventListener("keydown", chooseWithKeyboard)'
    )
    expect(quickCheck).not.toContain("What happens after I answer?")
    expect(quickCheck).not.toContain("Why this question?")
    expect(studyPlan).toContain("navigator.clipboard.writeText")
    expect(studyPlan).toContain("Copy week")
    expect(studyPlan).toContain("Week copied")
    expect(studyPlan.indexOf("<WeekPlanner")).toBeLessThan(
      studyPlan.indexOf("Plan details")
    )
  })

  it("moves focus to each new Quick Check prompt without silencing answer feedback or shortcuts", async () => {
    const quickCheck = await source(
      "components/tutor/adaptive-calibration-lab.tsx"
    )
    const examRunner = await source("components/tutor/exam-lab-runner.tsx")
    const testDayLab = await source("components/tutor/test-day-lab.tsx")
    const questionTransition = quickCheck.slice(
      quickCheck.indexOf("const currentQuestionId"),
      quickCheck.indexOf("async function submitAnswer")
    )
    const promptHeading = quickCheck.slice(
      quickCheck.indexOf("ref={questionHeadingRef}"),
      quickCheck.indexOf(
        "</h2>",
        quickCheck.indexOf("ref={questionHeadingRef}")
      )
    )

    expect(questionTransition).toContain(
      "previousQuestionId === currentQuestionId"
    )
    expect(questionTransition).toContain('setSelectedChoice("")')
    expect(questionTransition).toContain(
      "questionHeadingRef.current?.focus({ preventScroll: true })"
    )
    expect(questionTransition).toContain(
      "questionHeadingRef.current?.scrollIntoView({"
    )
    expect(questionTransition).toContain('block: "start"')
    expect(questionTransition).toContain('behavior: "auto"')
    expect(promptHeading).toContain("ref={questionHeadingRef}")
    expect(promptHeading).toContain("tabIndex={-1}")
    expect(promptHeading).toContain("scroll-mt-20")
    expect(questionTransition).not.toContain("showLatestAnswer")
    expect(quickCheck).toContain('role="status"')
    expect(quickCheck).toContain("setShowLatestAnswer(true)")
    expect(quickCheck).toContain(
      'const DEFAULT_ANSWER_CONFIDENCE = "unreported" as const'
    )
    expect(quickCheck).toContain("confidence: DEFAULT_ANSWER_CONFIDENCE")
    expect(quickCheck).toContain("disabled={!selectedChoice || busy}")
    expect(quickCheck).not.toContain("How sure are you?")
    expect(quickCheck).not.toContain("Choose one before checking")
    expect(examRunner).not.toContain("How sure are you?")
    expect(examRunner).not.toContain('"Guessing"')
    expect(testDayLab).toContain('confidence: previous?.confidence ?? "sure"')
    expect(quickCheck).not.toContain("(optional)")
  })
})

describe("practice timing contract", () => {
  it("starts the solving clock when the displayed question changes", async () => {
    const workspace = await source("components/tutor/lesson-workspace.tsx")
    const timerEffect = workspace.indexOf(
      "startedAt.current = window.performance.now()"
    )
    const choiceHandler = workspace.indexOf("onChoiceChange(choice)")
    expect(timerEffect).toBeGreaterThan(-1)
    expect(timerEffect).toBeLessThan(choiceHandler)
    expect(workspace).toContain("}, [displayedQuestion?.id])")
  })

  it("withholds score interpretation until a timed-practice run is usable", async () => {
    const report = await source("components/tutor/exam-lab-report.tsx")
    expect(report).toContain("examLabInterpretationReadiness")
    expect(report).toContain("Practice score range")
    expect(report).toContain("Not shown")
    expect(report).toContain("Finish more before using this result")
    expect(report).toContain("Completed answers correct")
    expect(report).toContain("not included above")
    expect(report).toContain("Incomplete timed practice")
    expect(report).toContain(
      "it will not infer a score, strength, pacing pattern, or next lesson"
    )
  })
})
