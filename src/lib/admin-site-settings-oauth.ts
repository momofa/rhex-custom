import { updateSiteSettingsRecord } from "@/db/site-settings-write-queries"
import { readOptionalNumberField, type JsonObject } from "@/lib/api-route"
import { finalizeSiteSettingsUpdate, type SiteSettingsRecord } from "@/lib/admin-site-settings-shared"
import {
  mergeSiteSecuritySettings,
  resolveSiteSecuritySettings,
} from "@/lib/site-settings-app-state"

export async function updateOAuthSiteSettingsSection(
  existing: SiteSettingsRecord,
  body: JsonObject,
  section: string,
) {
  if (section !== "site-oauth") {
    return null
  }

  const existingSiteSecuritySettings = resolveSiteSecuritySettings({
    appStateJson: existing.appStateJson,
  })
  const oauthServerEnabled = "oauthServerEnabled" in body
    ? Boolean(body.oauthServerEnabled)
    : existingSiteSecuritySettings.oauthServerEnabled
  const oauthClientApplicationEnabled = "oauthClientApplicationEnabled" in body
    ? Boolean(body.oauthClientApplicationEnabled)
    : existingSiteSecuritySettings.oauthClientApplicationEnabled
  const paymentApplicationEnabled = "paymentApplicationEnabled" in body
    ? Boolean(body.paymentApplicationEnabled)
    : existingSiteSecuritySettings.paymentApplicationEnabled
  const paymentPlatformFeePercent = Math.min(
    100,
    Math.max(
      0,
      Math.floor(readOptionalNumberField(body, "paymentPlatformFeePercent") ?? existingSiteSecuritySettings.paymentPlatformFeePercent),
    ),
  )
  const oauthAccessTokenTtlMinutes = Math.min(
    1440,
    Math.max(
      5,
      Math.floor(readOptionalNumberField(body, "oauthAccessTokenTtlMinutes") ?? existingSiteSecuritySettings.oauthAccessTokenTtlMinutes),
    ),
  )
  const oauthRefreshTokenTtlDays = Math.min(
    365,
    Math.max(
      1,
      Math.floor(readOptionalNumberField(body, "oauthRefreshTokenTtlDays") ?? existingSiteSecuritySettings.oauthRefreshTokenTtlDays),
    ),
  )

  const appStateJson = mergeSiteSecuritySettings(existing.appStateJson, {
    ...existingSiteSecuritySettings,
    oauthServerEnabled,
    oauthClientApplicationEnabled,
    paymentApplicationEnabled,
    paymentPlatformFeePercent,
    oauthAccessTokenTtlMinutes,
    oauthRefreshTokenTtlDays,
  })

  const settings = await updateSiteSettingsRecord(existing.id, {
    appStateJson,
  })

  return finalizeSiteSettingsUpdate({
    settings,
    message: "OAuth 设置已保存",
  })
}
