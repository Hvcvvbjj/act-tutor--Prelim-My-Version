import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

const root = new URL("../../", import.meta.url)

async function source(path: string) {
  return readFile(new URL(path, root), "utf8")
}

describe("mobile navigation contract", () => {
  it("keeps the compact mobile study loop visible without a More menu", async () => {
    const dashboard = await source("components/tutor/dashboard.tsx")
    const mobileNav = dashboard.slice(
      dashboard.indexOf('aria-label="Primary study navigation"'),
      dashboard.indexOf(
        "</nav>",
        dashboard.indexOf('aria-label="Primary study navigation"')
      )
    )
    expect(mobileNav.match(/<DashboardTab/g)).toHaveLength(6)
    expect(mobileNav).toContain('value="today"')
    expect(mobileNav).toContain('value="needs-work"')
    expect(mobileNav).toContain('value="plan"')
    expect(mobileNav).toContain('value="progress"')
    expect(mobileNav).toContain('value="history"')
    expect(mobileNav).toContain('value="badges"')
    expect(dashboard).toContain("grid-cols-7")
    expect(mobileNav).toContain("Lessons")
    expect(mobileNav).toContain("Needs")
    expect(mobileNav).toContain("Schedule")
    expect(mobileNav).toContain("Practice")
    expect(mobileNav).toContain("Progress")
    expect(mobileNav).toContain("History")
    expect(mobileNav).toContain("Badges")
    expect(mobileNav).not.toContain("More")
    expect(dashboard).toContain('learning.cycle.status === "assessment-choice"')
    expect(dashboard).toContain(
      'needsWorkUnlocked ? "grid-cols-7" : "grid-cols-6"'
    )
    expect(dashboard).toContain("function MrKimHeaderButton")
    expect(dashboard).toContain("function SettingsHeaderButton")
    expect(dashboard).toContain('aria-label="AlexACT, go to Lessons"')
    expect(dashboard).toContain("sticky top-0 z-50")
  })

  it("protects mobile width and 44px interaction targets", async () => {
    const styles = await source("app/globals.css")
    expect(styles).toContain("overflow-x: clip")
    expect(styles).toContain("min-height: 44px")
  })

  it("shows every requested desktop destination in one top navigation row", async () => {
    const dashboard = await source("components/tutor/dashboard.tsx")
    const assistant = await source("components/tutor/scout-assistant.tsx")
    const desktopNav = dashboard.slice(
      dashboard.indexOf('aria-label="Study navigation"'),
      dashboard.indexOf(
        "</TabsList>",
        dashboard.indexOf('aria-label="Study navigation"')
      )
    )
    expect(desktopNav.match(/<DashboardTab/g)).toHaveLength(6)
    const labels = [
      "Lessons",
      "Needs Work",
      "My Schedule",
      "Timed Practice",
      "Progress",
      "History",
      "Badges",
    ]
    for (const label of labels) expect(desktopNav).toContain(label)
    expect(desktopNav).not.toContain("Full Diagnostic")
    expect(desktopNav).not.toContain('data-tour-id="nav-diagnostic"')
    expect(desktopNav).toContain("{needsWorkUnlocked ? (")
    for (let index = 1; index < labels.length; index += 1) {
      expect(desktopNav.indexOf(labels[index - 1]!)).toBeLessThan(
        desktopNav.indexOf(labels[index]!)
      )
    }
    expect(dashboard).not.toContain("function DesktopOverflow")
    expect(dashboard).not.toContain("function MobileOverflow")
    expect(dashboard).not.toContain("More from AlexACT")
    expect(assistant).toContain("Data &amp; privacy")
    expect(assistant).toContain('aria-label="Settings"')
  })

  it("feeds badges from measured skill readiness and the latest score change", async () => {
    const dashboard = await source("components/tutor/dashboard.tsx")

    expect(dashboard).toContain(
      "skillProgress={learning.learningTwin.skills.map("
    )
    expect(dashboard).toContain("readiness: learnedProbability")
    expect(dashboard).toContain(
      "learning.roundReward?.estimatedActScoreDelta ?? 0"
    )
  })
})

describe("dashboard tour interaction contract", () => {
  it("centers the spotlight on the real action and brings targets into view", async () => {
    const tour = await source("components/tutor/dashboard-tour.tsx")
    const lessons = await source("components/tutor/lessons-command-center.tsx")
    const tutorApp = await source("components/tutor/tutor-app.tsx")

    expect(lessons).not.toMatch(/<div\s+data-tour-id="lesson-action"/)
    expect(lessons).toMatch(/<Button[\s\S]{0,240}data-tour-id="lesson-action"/)
    expect(lessons).not.toContain('data-tour-id="lesson-path"')
    expect(tour).toContain("target.scrollIntoView")
    expect(tour).toContain("tourDialogPlacement")
    expect(tour).toContain("document.documentElement.clientWidth")
    expect(tour).toContain("data-tour-spotlight={step.target}")
    expect(tour).toContain("visibleRect")
    expect(tour).toContain('step.target !== "nav-needs-work"')
    expect(await source("components/tutor/dashboard.tsx")).toContain(
      "includeNeedsWork={includeNeedsWork}"
    )
    expect(tour).not.toMatch(
      /data-tour-spotlight=\{step\.target\}[\s\S]{0,240}scout-coral/
    )
    expect(tour).not.toContain('className="h-full bg-[var(--scout-coral)]')
    expect(tour).toContain("(min-width: 1024px)")
    expect(tutorApp).toContain("(min-width: 1024px)")
  })

  it("shows the reviewed Mr. Kim answer before optional free AI enhancement finishes", async () => {
    const assistant = await source("components/tutor/scout-assistant.tsx")
    const provider = await source("lib/mr-kim-client-provider.ts")
    const immediateAnswer = assistant.indexOf(
      "if (serverMessage) {\n        setVisibleMessages"
    )
    const backgroundEnhancement = assistant.indexOf("void (async () =>")

    expect(immediateAnswer).toBeGreaterThan(-1)
    expect(backgroundEnhancement).toBeGreaterThan(immediateAnswer)
    expect(assistant).toContain("NEEDS_WORK_MR_KIM_EVENT")
    expect(assistant).toContain('>("loading")')
    expect(assistant).toContain("disabled={askUnavailable}")
    expect(assistant).toContain("const askUnavailable = busy")
    expect(provider).not.toContain("askBlocked: true")
    expect(provider.indexOf('freeCloudStatus === "ready"')).toBeLessThan(
      provider.indexOf('onDeviceStatus === "downloadable"')
    )
  })

  it("keeps the welcome header focused and routes every first plan to the diagnostic", async () => {
    const onboarding = await source("components/tutor/onboarding.tsx")
    const tutorApp = await source("components/tutor/tutor-app.tsx")
    const diagnosticIntro = await source(
      "components/tutor/diagnostic-intro.tsx"
    )
    const welcomeNav =
      onboarding.match(
        /<nav[\s\S]*?aria-label="Welcome"[\s\S]*?<\/nav>/
      )?.[0] ?? ""

    expect(welcomeNav).toBe("")
    expect(welcomeNav).not.toContain("Full diagnostic")
    expect(welcomeNav).not.toContain("Meet Mr. Kim")
    expect(onboarding).toContain('step === 1 && "text-center"')
    expect(onboarding).toContain('"mx-auto mt-7 grid w-full max-w-lg')
    expect(onboarding).toContain("Continue to full diagnostic")
    expect(tutorApp).toContain(
      'draft.priorScoreChoice === "never" || !editingPlan'
    )
    expect(diagnosticIntro).toContain(
      "Your score is set. The skill map starts empty."
    )
    expect(diagnosticIntro).toContain("<ScoutMark")
    expect(diagnosticIntro).toContain("Mr. Kim")
  })
})

describe("Mr. Kim pace-check contract", () => {
  it("covers every scored question flow without counting choice changes", async () => {
    const coach = await source("components/tutor/rapid-answer-coach.tsx")
    const diagnostic = await source("components/tutor/diagnostic-runner.tsx")
    const quickCheck = await source(
      "components/tutor/adaptive-calibration-lab.tsx"
    )
    const timedPractice = await source("components/tutor/test-day-lab.tsx")
    const dashboard = await source("components/tutor/dashboard.tsx")

    expect(coach).toContain("You answered 10 questions in under 30 seconds.")
    expect(coach).toContain("Slow down for the next one.")
    expect(diagnostic).toContain("rapidAnswerCoach.recordAnswer(question.id)")
    expect(quickCheck).toContain("rapidAnswerCoach.recordAnswer(question.id)")
    expect(timedPractice).toContain("if (updated && !wasAnswered)")
    expect(timedPractice).toContain(
      "rapidAnswerCoach.recordAnswer(question.id)"
    )
    expect(dashboard).toContain("rapidAnswerCoach.recordAnswer(question.id)")
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

    expect(layout).toContain("archivo-latin.woff2")
    expect(layout).toContain('variable: "--font-archivo"')
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
      "lg:grid-cols-[minmax(0,1fr)_minmax(26rem,0.88fr)]"
    )
    expect(onboarding).toContain("Your ACT plan starts with a")
    expect(quickCheck).toContain('aria-labelledby="quick-check-heading"')
    expect(quickCheck).toContain('data-testid="quick-check-question-card"')
    expect(quickCheck).not.toContain(">Your next question<")
  })
})

describe("Mr. Kim drawer accessibility contract", () => {
  it("traps focus, closes on Escape, returns focus, and keeps the launcher in the app header", async () => {
    const assistant = await source("components/tutor/scout-assistant.tsx")
    const dashboard = await source("components/tutor/dashboard.tsx")
    expect(assistant).toContain('event.key === "Escape"')
    expect(assistant).toContain('event.key !== "Tab"')
    expect(assistant).toContain("lastFocusRef.current?.focus()")
    expect(assistant).toContain('aria-modal="true"')
    expect(assistant).toContain('aria-label="Ask Mr. Kim"')
    expect(dashboard).toContain("function MrKimHeaderButton")
    expect(dashboard).toContain('aria-label="Ask Mr. Kim"')
    expect(dashboard).toContain("min-h-11 min-w-11")
  })

  it("uses one clear accessible name for settings controls", async () => {
    const assistant = await source("components/tutor/scout-assistant.tsx")
    expect(assistant).toContain('aria-label="Settings"')
    expect(assistant).toContain('aria-label="Close settings"')
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
    expect(learnerModel).toContain("Delete AlexACT study data")
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
    const actTiming = await source(
      "components/tutor/scout-operations/act-strategy-view.tsx"
    )
    const assistant = await source("components/tutor/scout-assistant.tsx")
    const lesson = await source("components/tutor/lesson-workspace.tsx")
    const progress = await source("components/tutor/mastery-profile.tsx")
    const timedPractice = await source("components/tutor/exam-lab-setup.tsx")
    const diagnosticIntro = await source(
      "components/tutor/diagnostic-intro.tsx"
    )
    const diagnosticRunner = await source(
      "components/tutor/diagnostic-runner.tsx"
    )
    const tutorApp = await source("components/tutor/tutor-app.tsx")
    expect(dashboard).not.toContain("function ScoreRoute")
    expect(assistant).toContain("Goal and schedule")
    expect(assistant).toContain("Data &amp; privacy")
    expect(dashboard).toContain(
      'startMissionAction({ action: "start_next" }, true)'
    )
    expect(dashboard).not.toContain("temporary 18")
    expect(mission).not.toContain("Next: {nextLabel}")
    expect(mission).toContain("Continue the practice questions for this skill.")
    expect(mission).not.toContain("Why AlexACT picked this")
    expect(mission).not.toContain("Later today")
    expect(mission).not.toContain("Planning baseline · not an ACT score")
    expect(mission).not.toContain("No streak yet")
    expect(onboarding).not.toContain(
      "This is a planning goal—not a score prediction"
    )
    expect(onboarding).not.toContain("See one answer change the plan")
    expect(onboarding).not.toContain("Type or use the buttons")
    expect(onboarding).toContain("Your week")
    expect(onboarding).toContain("Change the days later in My Schedule")
    expect(onboarding).toContain("full 66-question")
    expect(onboarding).not.toContain(
      "No invented score. No shortened baseline."
    )
    expect(onboarding).not.toContain("More → Data &amp; privacy")
    expect(onboarding).toContain("Open the developer demo")
    expect(onboarding).toContain("viewer.technicalDetails")
    expect(onboarding).not.toContain("Skip for now")
    expect(onboarding).toContain("Continue to full diagnostic")
    expect(onboarding).toContain("Your full diagnostic will set the baseline.")
    expect(tutorApp).toContain('return "diagnostic"')
    expect(tutorApp).not.toContain("temporary 18")
    expect(onboarding).toContain(
      "Add the scores AlexACT should use as your starting point."
    )
    expect(onboarding).not.toContain("choose your first lessons")
    expect(onboarding).not.toContain(
      "After Round 1, what should AlexACT emphasize?"
    )
    expect(onboarding).not.toContain("What should AlexACT prioritize?")
    expect(onboarding).not.toContain("Preview AlexACT with sample answers")
    expect(quickCheck).toContain("AlexACT may")
    expect(quickCheck).toContain(
      'latestEvent.correct ? "Correct." : "Not quite."'
    )
    expect(quickCheck).toContain("AlexACT updated your skill estimates.")
    expect(quickCheck).toMatch(
      /Round 1 still teaches all 12\s+question types\./
    )
    expect(quickCheck).not.toContain("lesson order")
    expect(quickCheck).not.toContain("Take the full 66-question diagnostic")
    expect(quickCheck).toContain("1 · Question match")
    expect(quickCheck).toContain("Priority unchanged")
    expect(quickCheck).toContain("later-round priority")
    expect(quickCheck).not.toContain("next lesson")
    expect(quickCheck).not.toContain("order AlexACT recommends practice")
    expect(quickCheck).toContain(
      "AlexACT updated this check and the skill you just practiced."
    )
    expect(studyPlan).toContain('label: "Add study time"')
    expect(studyPlan).toContain("Study schedule")
    expect(studyPlan).not.toContain("Calendar capacity")
    expect(learnerModel).not.toContain("This records two adjacent answers")
    expect(learningData).toContain("Data &amp; privacy")
    expect(learningData).toContain("See and control what AlexACT saves")
    expect(learnerModel).toContain("What AlexACT saves")
    expect(learnerModel).toContain("Correct a skill estimate")
    expect(learnerModel).not.toContain("Practice options")
    expect(actTiming).toContain("ACT timing reference")
    expect(actTiming).not.toContain("Target-score simulator")
    expect(actTiming).not.toContain("Parallel forms and exposure protection")
    expect(assistant).toContain("screenMessages.length === 0")
    expect(assistant).toContain("Earlier answers")
    expect(assistant).toContain("Simplify this answer")
    expect(assistant).not.toContain("Another example")
    expect(lesson).toContain('"Check answer"')
    expect(lesson).not.toContain("How sure are you?")
    expect(lesson).not.toContain("Review answer")
    expect(lesson).not.toContain("Why AlexACT picked this")
    expect(lesson).not.toContain("Change how AlexACT explains this")
    expect(lesson).not.toContain("section.coachPrompt")
    expect(lesson).not.toContain("practice-priority total")
    expect(lesson).toContain('confidence: "unreported"')
    expect(lesson).not.toContain('"Finish practice"')
    expect(lesson).toContain("lessonSegmentMinutes(")
    expect(progress).toContain("Skill map")
    expect(progress).not.toContain("See skill map")
    expect(progress).toContain("How AlexACT chose this skill")
    expect(timedPractice).not.toContain("Sure, Unsure, or Guessing")
    expect(timedPractice).not.toContain("self-reported confidence")
    expect(diagnosticIntro).toContain("Find your starting point")
    expect(diagnosticIntro).not.toContain(
      "Create an internal planning baseline"
    )
    expect(diagnosticRunner).toContain("Your practice range")
    expect(diagnosticRunner).toContain("Answer first blank")
    expect(diagnosticRunner).toContain("Finish unanswered questions")
    expect(diagnosticRunner).not.toContain("open={unanswered.length > 0}")
    expect(diagnosticRunner).toContain("reviewReturnIndex === currentIndex")
    expect(diagnosticRunner).toContain("returnToReview(nextAnswers)")
    expect(diagnosticRunner).toContain("Start with every ACT question type")
    expect(diagnosticRunner).toContain("Keep a balanced mix")
    expect(diagnosticRunner).toContain("purpose ===")
    expect(tutorApp).toContain("purpose={diagnosticPurpose}")
    expect(diagnosticRunner).not.toContain("First lesson focus")
    expect(diagnosticRunner).not.toContain("Your practice starting range")
    expect(diagnosticRunner).not.toContain("Your internal planning range")
    expect(mission).not.toContain("how uncertain the estimate is")
    expect(studyPlan).not.toContain("BKT estimate")
  })
})

describe("motivation and score evidence contract", () => {
  it("keeps study points separate from ACT score estimates", async () => {
    const badges = await source("components/tutor/badges-surface.tsx")
    const progress = await source("components/tutor/mastery-profile.tsx")
    const orientation = await source("components/tutor/learner-orientation.tsx")
    const tour = await source("components/tutor/dashboard-tour.tsx")
    const assistant = await source("app/api/scout/ask/route.ts")
    const learnerCopy = [badges, progress, orientation, tour, assistant].join(
      "\n"
    )
    const normalizedBadges = badges.replace(/\s+/g, " ")
    const normalizedProgress = progress.replace(/\s+/g, " ")

    expect(learnerCopy).toContain("momentum level")
    expect(normalizedBadges).toContain(
      "Points track completed study. Scored answers update ACT estimates."
    )
    expect(normalizedProgress).toContain(
      "Points reward study momentum; only scored answers shape"
    )
    expect(learnerCopy).not.toContain("Points-based score estimate")
    expect(learnerCopy).not.toContain("points = +1 ACT")
    expect(learnerCopy).not.toContain("matching ACT-scale marker")
    expect(learnerCopy).not.toContain("one ACT point")
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
      "Accounts are optional. Create one to save this plan across devices."
    )
  })
})

describe("deadline learner UX contract", () => {
  it("adds keyboard answers, progressive disclosure, and an adjustable week", async () => {
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
    expect(studyPlan).not.toContain("navigator.clipboard.writeText")
    expect(studyPlan).not.toContain("Copy week")
    expect(studyPlan).toContain("Choose the days and minutes")
    expect(studyPlan).toContain("Save schedule")
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
    expect(questionTransition).toContain("setShowLatestAnswer(false)")
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
    expect(testDayLab).toContain(
      'confidence: previous?.confidence ?? "unreported"'
    )
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
    expect(report).toContain("practice range.")
    expect(report).not.toContain("Practice score range")
    expect(report).toContain("Finish more questions before using this result")
    expect(report).toContain("Completed answers correct")
    expect(report).toContain("Incomplete timed practice")
    expect(report).toContain("No score range or")
    expect(report).toContain(
      "recommendation was created from this incomplete run"
    )
    expect(report).toContain("!readiness.sufficient")
    expect(report).toContain("readiness.sufficient && onUseForNextRound")
  })
})
