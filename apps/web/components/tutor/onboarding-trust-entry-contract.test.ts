import { readFile } from "node:fs/promises"
import path from "node:path"

import { describe, expect, it } from "vitest"

async function onboardingSource() {
  return readFile(path.join(process.cwd(), "components/tutor/onboarding.tsx"), {
    encoding: "utf8",
  })
}

async function layoutSource() {
  return readFile(path.join(process.cwd(), "app/layout.tsx"), {
    encoding: "utf8",
  })
}

describe("onboarding trust entry contract", () => {
  it("offers product and privacy context before collecting learner data", async () => {
    const onboarding = await onboardingSource()
    const layout = await layoutSource()
    const welcomeStart = onboarding.indexOf("if (showWelcome)")
    const setupStart = onboarding.indexOf(
      'data-hide-global-footer\n      className="min-h-svh bg',
      welcomeStart
    )
    const welcome = onboarding.slice(welcomeStart, setupStart)
    const aboutNavStart = welcome.indexOf('aria-label="Learn about AlexACT"')
    const aboutNav = welcome.slice(
      aboutNavStart,
      welcome.indexOf("</nav>", aboutNavStart)
    )

    expect(welcome).toContain('aria-label="Learn about AlexACT"')
    expect(welcome).toContain('href="/trust"')
    expect(aboutNav).not.toContain("lg:hidden")
    expect(welcome).not.toContain('href="/how-scout-works"')
    expect(welcome).not.toContain('href="/accessibility"')
    expect(layout).not.toContain('href="/how-scout-works"')
    expect(layout).not.toContain('href="/accessibility"')
    expect(welcome).toContain("Data, privacy, and limits")
    expect(welcome).toContain("min-h-11")
    expect(welcome).toContain("Everyone then takes")
    expect(welcome).toContain("full 66-question diagnostic")
    expect(welcome).toContain("One scored answer can change")
    expect(welcome).toContain('aria-label="What one scored answer can change"')
    expect(welcome).toContain("WELCOME_PROOF.map")
    expect(onboarding).toContain('copy: "Reviewed score"')
    expect(onboarding).toContain('copy: "Visible skill update"')
    expect(onboarding).toContain('copy: "Next lesson + week"')
    expect(welcome.indexOf("One scored answer can change")).toBeLessThan(
      welcome.indexOf("Build my starting plan")
    )
    expect(welcome.indexOf('aria-label="Learn about AlexACT"')).toBeGreaterThan(
      welcome.indexOf("Build my starting plan")
    )
  })

  it("puts the protected demo on the welcome screen for verified developers only", async () => {
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
    expect(protectedJudgeAction).toContain("Open the developer demo")
    expect(protectedJudgeAction).toContain("onClick={onJudgeDemo}")
    expect(protectedJudgeAction).toContain("disabled={judgeDemoBusy}")
    expect(welcome).toContain("Opening developer demo…")
    expect(welcome).toContain('role="alert"')
    expect(welcome).toContain("{judgeDemoError}")
    expect(welcome.indexOf("Open the developer demo")).toBeGreaterThan(
      welcome.indexOf("Build my starting plan")
    )
  })
})
