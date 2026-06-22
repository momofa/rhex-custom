export interface UsernameSensitiveWordSettings {
  usernameSensitiveWordsEnabled: boolean
  usernameSensitiveWords: string[]
}

export function normalizeUsernameSensitiveWords(input: unknown): string[] {
  const rawItems = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[\r\n,，、\s]+/)
      : []

  const normalizedWords = rawItems
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)

  const seen = new Set<string>()
  const uniqueWords: string[] = []

  for (const word of normalizedWords) {
    const key = word.toLocaleLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    uniqueWords.push(word)
  }

  return uniqueWords.slice(0, 500)
}

export function findUsernameSensitiveWord(
  username: string,
  settings: UsernameSensitiveWordSettings,
) {
  if (!settings.usernameSensitiveWordsEnabled) {
    return null
  }

  const normalizedUsername = username.trim().toLocaleLowerCase()
  if (!normalizedUsername) {
    return null
  }

  return normalizeUsernameSensitiveWords(settings.usernameSensitiveWords).find((word) => {
    return normalizedUsername.includes(word.toLocaleLowerCase())
  }) ?? null
}
