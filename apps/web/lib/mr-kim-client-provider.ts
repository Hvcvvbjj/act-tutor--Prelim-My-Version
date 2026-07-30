export type MrKimOnDeviceStatus =
  "checking" | "available" | "downloadable" | "downloading" | "unavailable"

export type MrKimFreeCloudStatus =
  "loading" | "ready" | "connecting" | "connected" | "unavailable"

export type MrKimClientProvider = "none" | "on-device" | "free-cloud"

export interface MrKimClientProviderDecision {
  askBlocked: boolean
  provider: MrKimClientProvider
}

/**
 * Choose the no-operator-cost enhancement before an Ask action starts.
 *
 * The free cloud SDK must be ready before the click so its optional sign-in
 * popup keeps the browser's user activation. A Chrome model that still needs a
 * download is not treated as ready while the cloud provider is available.
 */
export function chooseMrKimClientProvider(input: {
  serverAiAvailable: boolean
  onDeviceStatus: MrKimOnDeviceStatus
  freeCloudStatus: MrKimFreeCloudStatus
}): MrKimClientProviderDecision {
  if (input.serverAiAvailable) {
    return { askBlocked: false, provider: "none" }
  }
  if (input.onDeviceStatus === "available") {
    return { askBlocked: false, provider: "on-device" }
  }
  if (
    input.freeCloudStatus === "ready" ||
    input.freeCloudStatus === "connected"
  ) {
    return { askBlocked: false, provider: "free-cloud" }
  }
  if (
    input.freeCloudStatus === "loading" ||
    input.freeCloudStatus === "connecting" ||
    input.onDeviceStatus === "checking"
  ) {
    return { askBlocked: true, provider: "none" }
  }
  if (
    input.onDeviceStatus === "downloadable" ||
    input.onDeviceStatus === "downloading"
  ) {
    return { askBlocked: false, provider: "on-device" }
  }
  return { askBlocked: false, provider: "none" }
}
