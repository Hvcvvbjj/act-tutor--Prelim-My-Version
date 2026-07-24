import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

const root = new URL("../../", import.meta.url)

async function source(path: string) {
  return readFile(new URL(path, root), "utf8")
}

describe("mobile navigation contract", () => {
  it("keeps four primary mobile tabs, docks Scout, and moves secondary tools to More", async () => {
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
    expect(mobileNav).toContain("<MobileScoutDock")
    expect(mobileNav).toContain("More")
    expect(dashboard).toContain("Timed practice")
    expect(dashboard).toContain("Learning data")
    expect(dashboard).toContain("Learning settings")
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
    expect(desktopNav).not.toContain("Timed practice")
    expect(desktopOverflow).toContain('preloadDashboardSurface("lab")')
    expect(desktopOverflow).toContain('onNavigate("lab")')
    expect(desktopOverflow).toContain("Timed practice")
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
    expect(mission).toContain(
      "paper-panel min-w-0 rounded-2xl border border-border/80 bg-card"
    )
    expect(onboarding).toContain("grid grid-cols-3 gap-2")
    expect(onboarding).toContain(
      "paper-panel w-full rounded-2xl border border-border/80 bg-card"
    )
    expect(quickCheck).toContain('aria-labelledby="quick-check-heading"')
    expect(quickCheck).toContain('data-testid="quick-check-question-card"')
    expect(quickCheck).not.toContain(">Your next question<")
  })
})

describe("Scout drawer accessibility contract", () => {
  it("traps focus, closes on Escape, returns focus, and avoids a mobile floating launcher", async () => {
    const assistant = await source("components/tutor/scout-assistant.tsx")
    expect(assistant).toContain('event.key === "Escape"')
    expect(assistant).toContain('event.key !== "Tab"')
    expect(assistant).toContain("lastFocusRef.current?.focus()")
    expect(assistant).toContain('aria-modal="true"')
    expect(assistant).toContain("right-6 bottom-6")
    expect(assistant).toContain("hidden items-center gap-2 md:flex")
    expect(assistant).not.toContain("hidden items-center gap-2 sm:flex")
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
    expect(dashboard).toContain('"planning baseline"')
    expect(mission).toContain("Planning baseline · not an ACT score")
    expect(mission).toContain("No streak yet")
    expect(onboarding).toContain(
      "This is a planning goal—not a score prediction"
    )
    expect(onboarding).toContain("See one answer change the plan")
    expect(onboarding).toContain("Open the judge demo")
    expect(onboarding).toContain("viewer.technicalDetails")
    expect(onboarding).toContain("Skip for now")
    expect(onboarding).toContain("Create my starter plan")
    expect(onboarding).not.toContain("Preview Scout with sample answers")
    expect(quickCheck).toContain("Scout may")
    expect(quickCheck).toContain("gives Scout the clearest next")
    expect(quickCheck).toContain("Correct—Scout adjusted your next steps.")
    expect(quickCheck).toContain("1 · Question match")
    expect(quickCheck).toContain("Still next")
    expect(quickCheck).toContain(
      "Scout updated this check and the skill you just practiced."
    )
    expect(studyPlan).toContain('label: "Add study time"')
    expect(learnerModel).not.toContain("This records two adjacent answers")
    expect(learningData).toContain("See what Scout knows about your learning")
    expect(lesson).toContain("Current skill estimate")
    expect(lesson).not.toContain("practice-priority total")
    expect(progress).toContain("Your skill practice picture")
    expect(progress).toContain("How Scout chose this skill")
    expect(timedPractice).toContain("Sure, Unsure, or Guessing")
    expect(diagnosticIntro).toContain("Find your starting point")
    expect(diagnosticIntro).not.toContain(
      "Create an internal planning baseline"
    )
    expect(diagnosticRunner).toContain("Your practice starting range")
    expect(diagnosticRunner).not.toContain("Your internal planning range")
    expect(mission).toContain("how uncertain the estimate is")
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
    expect(quickCheck).toContain("What happens after I answer?")
    expect(studyPlan).toContain("navigator.clipboard.writeText")
    expect(studyPlan).toContain("Copy week")
    expect(studyPlan).toContain("Week copied")
    expect(studyPlan.indexOf("<WeekPlanner")).toBeLessThan(
      studyPlan.indexOf("Study-time check ·")
    )
  })
})

describe("practice timing contract", () => {
  it("starts the solving clock when a new question renders", async () => {
    const workspace = await source("components/tutor/lesson-workspace.tsx")
    const timerEffect = workspace.indexOf(
      "startedAt.current = window.performance.now()"
    )
    const choiceHandler = workspace.indexOf("onChoiceChange(choice)")
    expect(timerEffect).toBeGreaterThan(-1)
    expect(timerEffect).toBeLessThan(choiceHandler)
    expect(workspace).toContain("}, [currentQuestion?.id])")
  })

  it("withholds score interpretation until a timed-practice run is usable", async () => {
    const report = await source("components/tutor/exam-lab-report.tsx")
    expect(report).toContain("examLabInterpretationReadiness")
    expect(report).toContain("Practice score range")
    expect(report).toContain("Not shown")
    expect(report).toContain("Finish more before using this result")
    expect(report).toContain("Completed answers correct")
    expect(report).toContain("not included above")
  })
})
