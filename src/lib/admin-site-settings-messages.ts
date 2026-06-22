import { updateSiteSettingsRecord } from "@/db/site-settings-write-queries"
import { readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { finalizeSiteSettingsUpdate, type SiteSettingsRecord } from "@/lib/admin-site-settings-shared"
import { DEFAULT_MESSAGE_PROMPT_AUDIO_PATH } from "@/lib/message-prompt-audio"
import {
  DEFAULT_MESSAGE_REALTIME_HEARTBEAT_SECONDS,
  normalizeMessageRealtimeHeartbeatSeconds,
} from "@/lib/message-realtime-settings"
import { mergeMessageMediaSettings, resolveMessageMediaSettings } from "@/lib/site-settings-app-state"

export async function updateMessageSiteSettingsSection(existing: SiteSettingsRecord, body: JsonObject, section: string) {
  if (section !== "site-messages") {
    return null
  }

  const existingMessageMediaSettings = resolveMessageMediaSettings({
    appStateJson: existing.appStateJson,
    enabledFallback: true,
    imageUploadEnabledFallback: false,
    fileUploadEnabledFallback: false,
    promptAudioPathFallback: DEFAULT_MESSAGE_PROMPT_AUDIO_PATH,
    realtimeEnabledFallback: true,
    realtimeHeartbeatSecondsFallback: DEFAULT_MESSAGE_REALTIME_HEARTBEAT_SECONDS,
  })
  const messageEnabled = body.messageEnabled === undefined
    ? existingMessageMediaSettings.enabled
    : Boolean(body.messageEnabled)
  const messageImageUploadEnabled = body.messageImageUploadEnabled === undefined
    ? existingMessageMediaSettings.imageUploadEnabled
    : Boolean(body.messageImageUploadEnabled)
  const messageFileUploadEnabled = body.messageFileUploadEnabled === undefined
    ? existingMessageMediaSettings.fileUploadEnabled
    : Boolean(body.messageFileUploadEnabled)
  const messagePromptAudioPath = body.messagePromptAudioPath === undefined
    ? existingMessageMediaSettings.promptAudioPath
    : readOptionalStringField(body, "messagePromptAudioPath")
  const messageRealtimeEnabled = body.messageRealtimeEnabled === undefined
    ? existingMessageMediaSettings.realtimeEnabled
    : Boolean(body.messageRealtimeEnabled)
  const messageRealtimeHeartbeatSeconds = body.messageRealtimeHeartbeatSeconds === undefined
    ? existingMessageMediaSettings.realtimeHeartbeatSeconds
    : normalizeMessageRealtimeHeartbeatSeconds(body.messageRealtimeHeartbeatSeconds)

  const appStateJson = mergeMessageMediaSettings(existing.appStateJson, {
    enabled: messageEnabled,
    imageUploadEnabled: messageImageUploadEnabled,
    fileUploadEnabled: messageFileUploadEnabled,
    promptAudioPath: messagePromptAudioPath,
    realtimeEnabled: messageRealtimeEnabled,
    realtimeHeartbeatSeconds: messageRealtimeHeartbeatSeconds,
  })
  const settings = await updateSiteSettingsRecord(existing.id, {
    appStateJson,
  })

  return finalizeSiteSettingsUpdate({
    settings,
    message: "私信设置已保存",
  })
}
