import { describe, expect, it } from "vitest";

import {
  DEFAULT_OPENAI_TUTOR_MODEL,
  tutorModelConfigFromEnv,
} from "./ai-tutor-env";

describe("tutor model environment", () => {
  it("uses the canonical OpenAI settings for hosted AI", () => {
    expect(
      tutorModelConfigFromEnv({
        OPENAI_API_KEY: "server-key",
      } as NodeJS.ProcessEnv),
    ).toEqual({
      baseUrl: "https://api.openai.com/v1",
      model: DEFAULT_OPENAI_TUTOR_MODEL,
      apiKey: "server-key",
    });
  });

  it("keeps explicit OpenAI-compatible settings for local providers", () => {
    expect(
      tutorModelConfigFromEnv({
        AI_TUTOR_BASE_URL: "http://127.0.0.1:11434/v1",
        AI_TUTOR_MODEL: "local-model",
        AI_TUTOR_API_KEY: "local-key",
        OPENAI_API_KEY: "hosted-key",
        OPENAI_MODEL: "hosted-model",
      } as NodeJS.ProcessEnv),
    ).toEqual({
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "local-model",
      apiKey: "local-key",
    });
  });

  it("uses reviewed fallbacks when no complete provider is configured", () => {
    expect(tutorModelConfigFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      tutorModelConfigFromEnv({
        AI_TUTOR_BASE_URL: "http://127.0.0.1:11434/v1",
      } as NodeJS.ProcessEnv),
    ).toBeNull();
  });
});
