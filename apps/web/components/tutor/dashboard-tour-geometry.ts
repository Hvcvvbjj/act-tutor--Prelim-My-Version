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

export function spotlightRect(
  target: TourTargetRect,
  viewport: TourViewport,
  padding = 8,
  margin = 6
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
