export const DEFAULT_MESSAGE_PROMPT_AUDIO_PATH = "/apps/messages/prompt.mp3"

export function normalizeMessagePromptAudioPath(
  value: unknown,
  fallback = DEFAULT_MESSAGE_PROMPT_AUDIO_PATH,
) {
  const normalizedFallback = typeof fallback === "string"
    ? fallback.trim().slice(0, 1000) || DEFAULT_MESSAGE_PROMPT_AUDIO_PATH
    : DEFAULT_MESSAGE_PROMPT_AUDIO_PATH

  if (typeof value !== "string") {
    return normalizedFallback
  }

  const normalizedValue = value.trim().slice(0, 1000)
  return normalizedValue || normalizedFallback
}
