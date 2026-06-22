export function normalizeSiteOrigin(value: string) {
  return value.trim().replace(/\/$/, "")
}

function readConfiguredOrigin(name: string) {
  const value = process.env[name]?.trim()
  return value ? normalizeSiteOrigin(value) : null
}

export function getConfiguredSiteOrigin() {
  return (
    readConfiguredOrigin("SITE_URL") ??
    readConfiguredOrigin("APP_URL") ??
    // Keep a runtime fallback for older installs, but prefer runtime-only vars for reusable images.
    readConfiguredOrigin("NEXT_PUBLIC_SITE_URL")
  )
}
