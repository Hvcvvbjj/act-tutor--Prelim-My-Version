export function examLabTimerControls(
  timeLeft: number,
  sectionDeadlineAt: string,
  now = Date.now()
) {
  const deadline = Date.parse(sectionDeadlineAt)
  const locked = timeLeft <= 0 && Number.isFinite(deadline) && deadline <= now
  const warningLabel =
    !locked && timeLeft > 0 && timeLeft <= 60 ? "One minute or less" : null

  return {
    locked,
    endSectionLabel: locked
      ? "End section to continue"
      : "Review and finish section",
    warningLabel,
    statusMessage: locked
      ? "Time is up. Answers and flags are locked. End this section to continue."
      : null,
  }
}
