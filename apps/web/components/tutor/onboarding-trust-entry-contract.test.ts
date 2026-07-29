import { readFile } from "node:fs/promises"
import path from "node:path"

import { describe, expect, it } from "vitest"

async function onboardingSource() {
  return readFile(path.join(process.cwd(), "components/tutor/onboarding.tsx"), {
    encoding: "utf8",
  })
}

describe("onboarding trust entry contract", () => {
  it("offers product and privacy context before collecting learner data", async () => {
    const onboarding = await onboardingSource()
    const welcomeStart = onboarding.indexOf("if (showWelcome)")
    const setupStart = onboarding.indexOf(
      'data-hide-global-footer\n      className="min-h-svh bg',
      welcomeStart
    )
    const welcome = onboarding.slice(welcomeStart, setupStart)

    expect(welcome).toContain('aria-label="Welcome"')
    expect(welcome).toContain('aria-label="Learn about Scout"')
    expect(welcome).toContain('href="/how-scout-works"')
    expect(welcome).toContain('href="/trust"')
    expect(welcome).toContain("Data, privacy, and limits")
    expect(welcome).toContain("min-h-11")
    expect(welcome.indexOf('aria-label="Learn about Scout"')).toBeGreaterThan(
      welcome.indexOf("Build my starting plan")
    )
  })

  it("puts the protected demo on the welcome screen for verified judges only", async () => {
    const onboarding = await onboardingSource()
    const welcomeStart = onboarding.indexOf("if (showWelcome)")
    const setupStart = onboarding.indexOf(
      'data-hide-global-footer\n      className="min-h-svh bg',
      welcomeStart
    )
    const welcome = onboarding.slice(welcomeStart, setupStart)
    const judgeCondition = welcome.indexOf("{viewer.technicalDetails ?")
    const judgeConditionEnd = welcome.indexOf(": null}", judgeCondition)
    const protectedJudgeAction = welcome.slice(
      judgeCondition,
      judgeConditionEnd
    )

    expect(judgeCondition).toBeGreaterThan(-1)
    expect(protectedJudgeAction).toContain("Open the judge demo")
    expect(protectedJudgeAction).toContain("onClick={onJudgeDemo}")
    expect(protectedJudgeAction).toContain("disabled={judgeDemoBusy}")
    expect(welcome).toContain("Opening judge demo…")
    expect(welcome).toContain('role="alert"')
    expect(welcome).toContain("{judgeDemoError}")
    expect(welcome.indexOf("Open the judge demo")).toBeGreaterThan(
      welcome.indexOf("Build my starting plan")
    )
  })
})
