export interface TourTargetRect {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface TourViewport {
  width: number
  height: number
}

export interface TourSpotlightRect {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface TourDialogSize {
  width: number
  height: number
}

export interface TourDialogPlacement {
  top: number
  left: number
  width: number
  side: "above" | "below" | "left" | "right"
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

export function tourDialogPlacement(
  target: TourSpotlightRect,
  viewport: TourViewport,
  dialog: TourDialogSize,
  gap = 18,
  margin = 16
): TourDialogPlacement {
  const width = Math.min(dialog.width, Math.max(1, viewport.width - margin * 2))
  const height = Math.min(
    dialog.height,
    Math.max(1, viewport.height - margin * 2)
  )
  const centeredLeft = clamp(
    target.left + target.width / 2 - width / 2,
    margin,
    Math.max(margin, viewport.width - width - margin)
  )
  const centeredTop = clamp(
    target.top + target.height / 2 - height / 2,
    margin,
    Math.max(margin, viewport.height - height - margin)
  )
  const candidates = {
    below: {
      top: target.bottom + gap,
      left: centeredLeft,
      width,
      side: "below" as const,
      fits: target.bottom + gap + height <= viewport.height - margin,
    },
    above: {
      top: target.top - gap - height,
      left: centeredLeft,
      width,
      side: "above" as const,
      fits: target.top - gap - height >= margin,
    },
    left: {
      top: centeredTop,
      left: target.left - gap - width,
      width,
      side: "left" as const,
      fits: target.left - gap - width >= margin,
    },
    right: {
      top: centeredTop,
      left: target.right + gap,
      width,
      side: "right" as const,
      fits: target.right + gap + width <= viewport.width - margin,
    },
  }

  const centerX = target.left + target.width / 2
  const nearTop = target.top < 112
  const preferredSides: Array<keyof typeof candidates> = nearTop
    ? ["below", centerX > viewport.width / 2 ? "left" : "right", "above"]
    : centerX > viewport.width * 0.68
      ? ["left", "below", "above", "right"]
      : centerX < viewport.width * 0.32
        ? ["right", "below", "above", "left"]
        : ["below", "above", "right", "left"]
  const fitting = preferredSides.find((side) => candidates[side].fits)
  if (fitting) {
    const candidate = candidates[fitting]
    return {
      top: candidate.top,
      left: candidate.left,
      width: candidate.width,
      side: candidate.side,
    }
  }

  const fallbackSide =
    viewport.height - target.bottom >= target.top ? "below" : "above"
  return {
    top: clamp(
      fallbackSide === "below" ? target.bottom + gap : target.top - gap - height,
      margin,
      Math.max(margin, viewport.height - height - margin)
    ),
    left: centeredLeft,
    width,
    side: fallbackSide,
  }
}

export function spotlightRect(
  target: TourTargetRect,
  viewport: TourViewport,
  padding = 4,
  margin = 4
): TourSpotlightRect | null {
  if (
    target.width <= 0 ||
    target.height <= 0 ||
    target.right <= margin ||
    target.bottom <= margin ||
    target.left >= viewport.width - margin ||
    target.top >= viewport.height - margin
  ) {
    return null
  }

  const visibleLeft = Math.max(margin, target.left)
  const visibleRight = Math.min(viewport.width - margin, target.right)
  const visibleTop = Math.max(margin, target.top)
  const visibleBottom = Math.min(viewport.height - margin, target.bottom)
  const horizontalPadding = Math.max(
    0,
    Math.min(
      padding,
      visibleLeft - margin,
      viewport.width - margin - visibleRight
    )
  )
  const verticalPadding = Math.max(
    0,
    Math.min(
      padding,
      visibleTop - margin,
      viewport.height - margin - visibleBottom
    )
  )
  const left = visibleLeft - horizontalPadding
  const right = visibleRight + horizontalPadding
  const top = visibleTop - verticalPadding
  const bottom = visibleBottom + verticalPadding

  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  }
}
