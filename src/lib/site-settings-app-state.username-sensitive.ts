import { isRecord, readSiteSettingsState, writeSiteSettingsState } from "@/lib/site-settings-app-state.types"
import { normalizeUsernameSensitiveWords, type UsernameSensitiveWordSettings } from "@/lib/username-sensitive-words"

export function resolveUsernameSensitiveWordSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  wordsFallback?: string[]
} = {}): UsernameSensitiveWordSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const usernameSensitiveWords = isRecord(siteSettingsState.usernameSensitiveWords)
    ? siteSettingsState.usernameSensitiveWords
    : {}

  return {
    usernameSensitiveWordsEnabled:
      typeof usernameSensitiveWords.enabled === "boolean"
        ? usernameSensitiveWords.enabled
        : options.enabledFallback ?? false,
    usernameSensitiveWords: normalizeUsernameSensitiveWords(
      Array.isArray(usernameSensitiveWords.words)
        ? usernameSensitiveWords.words
        : options.wordsFallback ?? [],
    ),
  }
}

export function mergeUsernameSensitiveWordSettings(
  appStateJson: string | null | undefined,
  input: UsernameSensitiveWordSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    usernameSensitiveWords: {
      enabled: Boolean(input.usernameSensitiveWordsEnabled),
      words: normalizeUsernameSensitiveWords(input.usernameSensitiveWords),
    },
  })
}
