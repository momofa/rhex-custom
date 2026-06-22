const CONTENT_MUTATION_MARKER_KEY = "rhex:content-mutated-at"
const CONTENT_MUTATION_REFRESHED_KEY_PREFIX = "rhex:content-mutated-refreshed:"

function getSessionStorage() {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function readNumber(value: string | null) {
  const parsed = value ? Number(value) : 0
  return Number.isFinite(parsed) ? parsed : 0
}

function getContentMutationRefreshKey(pathname: string) {
  return `${CONTENT_MUTATION_REFRESHED_KEY_PREFIX}${pathname}`
}

export function readContentMutationMarker() {
  return readNumber(getSessionStorage()?.getItem(CONTENT_MUTATION_MARKER_KEY) ?? null)
}

export function markContentMutated() {
  const marker = Date.now()
  getSessionStorage()?.setItem(CONTENT_MUTATION_MARKER_KEY, String(marker))
  return marker
}

export function readContentMutationRefreshMarker(pathname: string) {
  return readNumber(getSessionStorage()?.getItem(getContentMutationRefreshKey(pathname)) ?? null)
}

export function markContentMutationRefreshHandled(pathname: string, marker: number) {
  if (!marker) {
    return
  }

  getSessionStorage()?.setItem(getContentMutationRefreshKey(pathname), String(marker))
}

export function consumeContentMutationRefresh(pathname: string, options?: { force?: boolean }) {
  const marker = readContentMutationMarker()
  if (!marker) {
    return 0
  }

  const handledMarker = readContentMutationRefreshMarker(pathname)
  if (!options?.force && marker === handledMarker) {
    return 0
  }

  markContentMutationRefreshHandled(pathname, marker)
  return marker
}
