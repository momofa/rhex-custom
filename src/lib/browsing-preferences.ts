export interface BrowsingPreferencesSnapshot {
  dimReadPostTitles: boolean
  openPostLinksInNewTab: boolean
  commentThreadDisplayMode: "tree" | "flat"
  commentThreadSort: "oldest" | "newest"
  rewardPoolIntroAnimationMode: "always" | "once-per-tab" | "never"
}

export const BROWSING_PREFERENCES_STORAGE_KEY = "rhex:browsing-preferences:v1"
export const BROWSING_PREFERENCES_COOKIE_NAME = "rhex-browsing-preferences"
export const BROWSING_PREFERENCES_CHANGE_EVENT = "rhex:browsing-preferences-change"
const BROWSING_PREFERENCES_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
export const DEFAULT_BROWSING_PREFERENCES: BrowsingPreferencesSnapshot = {
  dimReadPostTitles: false,
  openPostLinksInNewTab: false,
  commentThreadDisplayMode: "tree",
  commentThreadSort: "oldest",
  rewardPoolIntroAnimationMode: "once-per-tab",
}

let cachedSnapshot: BrowsingPreferencesSnapshot = DEFAULT_BROWSING_PREFERENCES
let cacheHydrated = false

function isBrowser() {
  return typeof window !== "undefined"
}

function normalizeBrowsingPreferences(value: unknown): BrowsingPreferencesSnapshot {
  if (!value || typeof value !== "object") {
    return DEFAULT_BROWSING_PREFERENCES
  }

  const candidate = value as Record<string, unknown>

  return {
    dimReadPostTitles: Boolean(candidate.dimReadPostTitles),
    openPostLinksInNewTab: Boolean(candidate.openPostLinksInNewTab),
    commentThreadDisplayMode: candidate.commentThreadDisplayMode === "flat" ? "flat" : "tree",
    commentThreadSort: candidate.commentThreadSort === "newest" ? "newest" : "oldest",
    rewardPoolIntroAnimationMode: candidate.rewardPoolIntroAnimationMode === "never"
      ? "never"
      : candidate.rewardPoolIntroAnimationMode === "once-per-tab"
        ? "once-per-tab"
        : "always",
  }
}

function areBrowsingPreferencesEqual(left: BrowsingPreferencesSnapshot | null, right: BrowsingPreferencesSnapshot | null) {
  if (!left || !right) {
    return left === right
  }

  return left.dimReadPostTitles === right.dimReadPostTitles
    && left.openPostLinksInNewTab === right.openPostLinksInNewTab
    && left.commentThreadDisplayMode === right.commentThreadDisplayMode
    && left.commentThreadSort === right.commentThreadSort
    && left.rewardPoolIntroAnimationMode === right.rewardPoolIntroAnimationMode
}

function parseStoredBrowsingPreferences(raw: string | null | undefined) {
  if (!raw) {
    return null
  }

  try {
    return normalizeBrowsingPreferences(JSON.parse(raw))
  } catch {
    return null
  }
}

export function resolveBrowsingPreferencesSnapshot(raw: string | null | undefined) {
  if (!raw) {
    return DEFAULT_BROWSING_PREFERENCES
  }

  const decodedRaw = (() => {
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  })()

  return parseStoredBrowsingPreferences(decodedRaw) ?? DEFAULT_BROWSING_PREFERENCES
}

function readSnapshotFromCookieValue(cookieValue: string | null | undefined) {
  if (!cookieValue) {
    return null
  }

  return resolveBrowsingPreferencesSnapshot(cookieValue)
}

function readSnapshotFromCookieString(cookieString: string) {
  if (!cookieString.trim()) {
    return null
  }

  const cookiePrefix = `${BROWSING_PREFERENCES_COOKIE_NAME}=`
  const entry = cookieString
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(cookiePrefix))

  if (!entry) {
    return null
  }

  return readSnapshotFromCookieValue(entry.slice(cookiePrefix.length))
}

function writeSnapshotToStorage(snapshot: BrowsingPreferencesSnapshot) {
  if (!isBrowser()) {
    return
  }

  try {
    window.localStorage.setItem(BROWSING_PREFERENCES_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Ignore storage failures and still keep the in-memory snapshot available.
  }
}

function writeSnapshotToCookie(snapshot: BrowsingPreferencesSnapshot) {
  if (!isBrowser()) {
    return
  }

  try {
    document.cookie = `${BROWSING_PREFERENCES_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(snapshot))}; path=/; max-age=${BROWSING_PREFERENCES_COOKIE_MAX_AGE}; samesite=lax`
  } catch {
    // Ignore cookie failures and still keep the in-memory snapshot available.
  }
}

function readSnapshotFromStorage() {
  if (!isBrowser()) {
    return DEFAULT_BROWSING_PREFERENCES
  }

  const storageSnapshot = (() => {
    try {
      return parseStoredBrowsingPreferences(window.localStorage.getItem(BROWSING_PREFERENCES_STORAGE_KEY))
    } catch {
      return null
    }
  })()
  const cookieSnapshot = readSnapshotFromCookieString(document.cookie)

  if (storageSnapshot) {
    if (!areBrowsingPreferencesEqual(storageSnapshot, cookieSnapshot)) {
      writeSnapshotToCookie(storageSnapshot)
    }

    return storageSnapshot
  }

  if (cookieSnapshot) {
    writeSnapshotToStorage(cookieSnapshot)
    return cookieSnapshot
  }

  return DEFAULT_BROWSING_PREFERENCES
}

function updateSnapshot(nextSnapshot: BrowsingPreferencesSnapshot, syncStorage = true) {
  cachedSnapshot = nextSnapshot
  cacheHydrated = true

  if (!isBrowser()) {
    return
  }

  if (syncStorage) {
    writeSnapshotToStorage(nextSnapshot)
  }

  writeSnapshotToCookie(nextSnapshot)
  window.dispatchEvent(new Event(BROWSING_PREFERENCES_CHANGE_EVENT))
}

export function readBrowsingPreferencesSnapshot() {
  if (!isBrowser()) {
    return DEFAULT_BROWSING_PREFERENCES
  }

  if (!cacheHydrated) {
    cachedSnapshot = readSnapshotFromStorage()
    cacheHydrated = true
  }

  return cachedSnapshot
}

export function subscribeBrowsingPreferences(onStoreChange: () => void) {
  if (!isBrowser()) {
    return () => undefined
  }

  const handleChange = () => {
    cachedSnapshot = readSnapshotFromStorage()
    cacheHydrated = true
    onStoreChange()
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === BROWSING_PREFERENCES_STORAGE_KEY) {
      handleChange()
    }
  }

  window.addEventListener(BROWSING_PREFERENCES_CHANGE_EVENT, handleChange)
  window.addEventListener("storage", handleStorage)

  return () => {
    window.removeEventListener(BROWSING_PREFERENCES_CHANGE_EVENT, handleChange)
    window.removeEventListener("storage", handleStorage)
  }
}

export function updateBrowsingPreferences(patch: Partial<BrowsingPreferencesSnapshot>) {
  const currentSnapshot = readBrowsingPreferencesSnapshot()

  updateSnapshot({
    ...currentSnapshot,
    ...patch,
  })
}
