export interface HttpUrlOptions {
  allowCredentials?: boolean
  clearHash?: boolean
}

export function parseHttpUrl(rawValue: unknown, options: HttpUrlOptions = {}) {
  const value = typeof rawValue === "string" ? rawValue.trim() : String(rawValue ?? "").trim()
  if (!value) {
    return null
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return null
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null
  }

  if (options.allowCredentials === false && (parsed.username || parsed.password)) {
    return null
  }

  if (options.clearHash) {
    parsed.hash = ""
  }

  return parsed
}

export function normalizeHttpUrl(rawValue: unknown, options: HttpUrlOptions = {}) {
  return parseHttpUrl(rawValue, options)?.toString() ?? null
}

export function isHttpUrl(rawValue: unknown, options: HttpUrlOptions = {}) {
  return Boolean(parseHttpUrl(rawValue, options))
}
