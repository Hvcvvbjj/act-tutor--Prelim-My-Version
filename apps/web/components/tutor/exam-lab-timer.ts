export function examLabTimerControls(
  timeLeft: number,
  sectionDeadlineAt: string,
  now = Date.now()
) {
  const deadline = Date.parse(sectionDeadlineAt)
  const locked = timeLeft <= 0 && Number.isFinite(deadline) && deadline <= now

  return {
    locked,
    endSectionLabel: locked ? "End section to continue" : "End section",
    statusMessage: locked
      ? "Time is up. Answers and flags are locked. End this section to continue."
      : null,
  }
}
