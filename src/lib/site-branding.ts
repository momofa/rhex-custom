export const DEFAULT_SITE_ICON_PATH = "/icon.svg"

function normalizeAssetPath(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : ""
}

export function resolveSiteIconPath(siteIconPath?: string | null) {
  return normalizeAssetPath(siteIconPath) || DEFAULT_SITE_ICON_PATH
}

export function resolveSiteMarkImagePath(siteLogoPath?: string | null, siteIconPath?: string | null) {
  return normalizeAssetPath(siteLogoPath) || resolveSiteIconPath(siteIconPath)
}
