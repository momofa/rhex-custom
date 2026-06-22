import { revalidatePath, revalidateTag } from "next/cache"

import { findSiteSettingsRecordForUpdate } from "@/db/site-settings-write-queries"

import { SITE_SETTINGS_CACHE_TAG } from "@/lib/site-settings"

export type SiteSettingsRecord = NonNullable<Awaited<ReturnType<typeof findSiteSettingsRecordForUpdate>>>

export interface SiteSettingsSectionUpdateResult {
  settings?: unknown
  message: string
  revalidatePaths?: string[]
}

export function revalidateSiteSettingsCache() {
  revalidateTag(SITE_SETTINGS_CACHE_TAG, "max")
}

export function expireSiteSettingsCacheImmediately() {
  revalidateTag(SITE_SETTINGS_CACHE_TAG, { expire: 0 })
}

export function finalizeSiteSettingsUpdate(result: SiteSettingsSectionUpdateResult) {
  revalidateSiteSettingsCache()
  revalidatePath("/", "layout")
  return result
}
