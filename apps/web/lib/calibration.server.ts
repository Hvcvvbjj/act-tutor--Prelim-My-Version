import { join } from "node:path"

import { RAPID_DIAGNOSTIC_FORM } from "@act-tutor/content"
import {
  FileAdaptiveCalibrationRepository,
  type CalibrationBankInput,
} from "@act-tutor/server"

const storePath =
  process.env.CALIBRATION_SESSION_STORE_PATH ??
  join(process.cwd(), ".data", "calibration-sessions.json")

export const CALIBRATION_BANK: CalibrationBankInput = {
  id: RAPID_DIAGNOSTIC_FORM.id,
  version: RAPID_DIAGNOSTIC_FORM.version,
  questions: RAPID_DIAGNOSTIC_FORM.questions,
}

export const calibrationSessions = new FileAdaptiveCalibrationRepository(
  storePath
)
