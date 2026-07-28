export const DEFAULT_OPENAI_TUTOR_MODEL = "gpt-5.6";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

export interface TutorModelConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export function tutorModelConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): TutorModelConfig | null {
  const openAIKey = env.OPENAI_API_KEY?.trim();
  const explicitBaseUrl = env.AI_TUTOR_BASE_URL?.trim();
  const explicitModel = env.AI_TUTOR_MODEL?.trim();
  const baseUrl = explicitBaseUrl || (openAIKey ? OPENAI_BASE_URL : "");
  const model =
    explicitModel ||
    env.OPENAI_MODEL?.trim() ||
    (openAIKey ? DEFAULT_OPENAI_TUTOR_MODEL : "");
  if (!baseUrl || !model) return null;
  return {
    baseUrl,
    model,
    apiKey: env.AI_TUTOR_API_KEY?.trim() || openAIKey || undefined,
  };
}
