export function resolveAddonClientImportUrl(moduleUrl: string, baseUrl?: string) {
  const trimmedModuleUrl = moduleUrl.trim()
  if (!trimmedModuleUrl) {
    return ""
  }

  const resolvedBaseUrl = baseUrl ?? (typeof window === "undefined" ? undefined : window.location.href)
  if (!resolvedBaseUrl) {
    return trimmedModuleUrl
  }

  try {
    return new URL(trimmedModuleUrl, resolvedBaseUrl).toString()
  } catch {
    return trimmedModuleUrl
  }
}
