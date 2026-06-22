import {
  isRecord,
  normalizeFileExtensionList,
  normalizeHexColor,
  normalizeImageWatermarkPosition,
  normalizeNonNegativeInteger,
  readSiteSettingsState,
  writeSiteSettingsState,
} from "@/lib/site-settings-app-state.types"
import { normalizeMessagePromptAudioPath } from "@/lib/message-prompt-audio"
import {
  normalizeMessageRealtimeEnabled,
  normalizeMessageRealtimeHeartbeatSeconds,
} from "@/lib/message-realtime-settings"
import {
  normalizeWatermarkFontAssets,
  resolveKnownWatermarkFontFamily,
} from "@/lib/watermark-lib"
import type {
  AttachmentFeatureSettings,
  ImageWatermarkPosition,
  ImageWatermarkSettings,
  MessageMediaSettings,
  MarkdownImageUploadSettings,
  UploadObjectStorageSettings,
} from "@/lib/site-settings-app-state.types"

export function resolveMarkdownImageUploadSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
} = {}): MarkdownImageUploadSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const markdownImageUpload = isRecord(siteSettingsState.markdownImageUpload)
    ? siteSettingsState.markdownImageUpload
    : {}

  return {
    enabled:
      typeof markdownImageUpload.enabled === "boolean"
        ? markdownImageUpload.enabled
        : options.enabledFallback ?? true,
  }
}

export function mergeMarkdownImageUploadSettings(
  appStateJson: string | null | undefined,
  input: MarkdownImageUploadSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    markdownImageUpload: {
      enabled: input.enabled,
    },
  })
}

export function resolveImageWatermarkSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  textEnabledFallback?: boolean
  textFallback?: string
  positionFallback?: ImageWatermarkPosition
  tiledFallback?: boolean
  opacityFallback?: number
  fontSizeFallback?: number
  fontFamilyFallback?: string
  marginFallback?: number
  colorFallback?: string
  logoEnabledFallback?: boolean
  logoPathFallback?: string
  logoPositionFallback?: ImageWatermarkPosition
  logoTiledFallback?: boolean
  logoOpacityFallback?: number
  logoMarginFallback?: number
  logoScalePercentFallback?: number
} = {}): ImageWatermarkSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const imageWatermark = isRecord(siteSettingsState.imageWatermark)
    ? siteSettingsState.imageWatermark
    : {}
  const legacyEnabled = typeof imageWatermark.enabled === "boolean"
    ? imageWatermark.enabled
    : options.enabledFallback ?? false
  const legacyPosition = normalizeImageWatermarkPosition(
    imageWatermark.position,
    options.positionFallback ?? "BOTTOM_RIGHT",
  )
  const legacyTiled = typeof imageWatermark.tiled === "boolean"
    ? imageWatermark.tiled
    : options.tiledFallback ?? false
  const legacyOpacity = Math.min(
    100,
    Math.max(
      0,
      normalizeNonNegativeInteger(
        imageWatermark.opacity,
        normalizeNonNegativeInteger(options.opacityFallback, 22),
      ),
    ),
  )
  const legacyFontSize = Math.min(
    160,
    Math.max(
      8,
      normalizeNonNegativeInteger(
        imageWatermark.fontSize,
        normalizeNonNegativeInteger(options.fontSizeFallback, 24),
      ),
    ),
  )
  const legacyFontFamily =
    typeof imageWatermark.fontFamily === "string"
      ? imageWatermark.fontFamily.replace(/\s+/g, " ").trim().slice(0, 240)
      : (options.fontFamilyFallback ?? "").replace(/\s+/g, " ").trim().slice(0, 240)
  const fontAssets = normalizeWatermarkFontAssets(imageWatermark.fontAssets)
  const legacyMargin = Math.min(
    200,
    Math.max(
      0,
      normalizeNonNegativeInteger(
        imageWatermark.margin,
        normalizeNonNegativeInteger(options.marginFallback, 24),
      ),
    ),
  )
  const legacyColor = normalizeHexColor(
    imageWatermark.color,
    normalizeHexColor(options.colorFallback, "#FFFFFF"),
  )
  const logoPath =
    typeof imageWatermark.logoPath === "string"
      ? imageWatermark.logoPath.trim().slice(0, 1000)
      : (options.logoPathFallback ?? "").trim().slice(0, 1000)
  const text =
    typeof imageWatermark.text === "string"
      ? imageWatermark.text.trim().slice(0, 120)
      : (options.textFallback ?? "").trim().slice(0, 120)
  const logoScalePercent = Math.min(
    60,
    Math.max(
      1,
      normalizeNonNegativeInteger(
        imageWatermark.logoScalePercent,
        normalizeNonNegativeInteger(options.logoScalePercentFallback, 16),
      ),
    ),
  )
  const textEnabled = typeof imageWatermark.textEnabled === "boolean"
    ? imageWatermark.textEnabled
    : options.textEnabledFallback ?? (legacyEnabled && Boolean(text))
  const logoEnabled = typeof imageWatermark.logoEnabled === "boolean"
    ? imageWatermark.logoEnabled
    : options.logoEnabledFallback ?? (legacyEnabled && Boolean(logoPath))

  return {
    enabled: legacyEnabled,
    textEnabled,
    text,
    textPosition: normalizeImageWatermarkPosition(
      imageWatermark.textPosition,
      legacyPosition,
    ),
    textTiled:
      typeof imageWatermark.textTiled === "boolean"
        ? imageWatermark.textTiled
        : legacyTiled,
    textOpacity: Math.min(
      100,
      Math.max(
        0,
        normalizeNonNegativeInteger(
          imageWatermark.textOpacity,
          legacyOpacity,
        ),
      ),
    ),
    textFontSize: Math.min(
      160,
      Math.max(
        8,
        normalizeNonNegativeInteger(
          imageWatermark.textFontSize,
          legacyFontSize,
        ),
      ),
    ),
    fontAssets,
    textFontFamily: resolveKnownWatermarkFontFamily(
      typeof imageWatermark.textFontFamily === "string"
        ? imageWatermark.textFontFamily
        : legacyFontFamily,
      fontAssets,
    ),
    textMargin: Math.min(
      200,
      Math.max(
        0,
        normalizeNonNegativeInteger(
          imageWatermark.textMargin,
          legacyMargin,
        ),
      ),
    ),
    textColor: normalizeHexColor(
      imageWatermark.textColor,
      legacyColor,
    ),
    logoEnabled,
    logoPath,
    logoPosition: normalizeImageWatermarkPosition(
      imageWatermark.logoPosition,
      options.logoPositionFallback ?? legacyPosition,
    ),
    logoTiled:
      typeof imageWatermark.logoTiled === "boolean"
        ? imageWatermark.logoTiled
        : options.logoTiledFallback ?? legacyTiled,
    logoOpacity: Math.min(
      100,
      Math.max(
        0,
        normalizeNonNegativeInteger(
          imageWatermark.logoOpacity,
          normalizeNonNegativeInteger(options.logoOpacityFallback, legacyOpacity),
        ),
      ),
    ),
    logoMargin: Math.min(
      200,
      Math.max(
        0,
        normalizeNonNegativeInteger(
          imageWatermark.logoMargin,
          normalizeNonNegativeInteger(options.logoMarginFallback, legacyMargin),
        ),
      ),
    ),
    logoScalePercent,
    position: normalizeImageWatermarkPosition(
      imageWatermark.position,
      legacyPosition,
    ),
    tiled: legacyTiled,
    opacity: legacyOpacity,
    fontSize: legacyFontSize,
    fontFamily: resolveKnownWatermarkFontFamily(legacyFontFamily, fontAssets),
    margin: legacyMargin,
    color: legacyColor,
  }
}

export function mergeImageWatermarkSettings(
  appStateJson: string | null | undefined,
  input: ImageWatermarkSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const fontAssets = normalizeWatermarkFontAssets(input.fontAssets)
  const textFontFamily = resolveKnownWatermarkFontFamily(input.textFontFamily ?? input.fontFamily, fontAssets)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    imageWatermark: {
      enabled: Boolean(input.enabled),
      fontAssets,
      textEnabled: Boolean(input.textEnabled),
      text: String(input.text ?? "").trim().slice(0, 120),
      textPosition: normalizeImageWatermarkPosition(input.textPosition, "BOTTOM_RIGHT"),
      textTiled: Boolean(input.textTiled),
      textOpacity: Math.min(100, Math.max(0, normalizeNonNegativeInteger(input.textOpacity, 22))),
      textFontSize: Math.min(160, Math.max(8, normalizeNonNegativeInteger(input.textFontSize, 24))),
      textFontFamily,
      textMargin: Math.min(200, Math.max(0, normalizeNonNegativeInteger(input.textMargin, 24))),
      textColor: normalizeHexColor(input.textColor, "#FFFFFF"),
      logoEnabled: Boolean(input.logoEnabled),
      logoPath: String(input.logoPath ?? "").trim().slice(0, 1000),
      logoPosition: normalizeImageWatermarkPosition(input.logoPosition, "BOTTOM_LEFT"),
      logoTiled: Boolean(input.logoTiled),
      logoOpacity: Math.min(100, Math.max(0, normalizeNonNegativeInteger(input.logoOpacity, 22))),
      logoMargin: Math.min(200, Math.max(0, normalizeNonNegativeInteger(input.logoMargin, 24))),
      logoScalePercent: Math.min(60, Math.max(1, normalizeNonNegativeInteger(input.logoScalePercent, 16))),
      position: normalizeImageWatermarkPosition(input.textPosition ?? input.position, "BOTTOM_RIGHT"),
      tiled: Boolean(input.textTiled ?? input.tiled),
      opacity: Math.min(100, Math.max(0, normalizeNonNegativeInteger(input.textOpacity ?? input.opacity, 22))),
      fontSize: Math.min(160, Math.max(8, normalizeNonNegativeInteger(input.textFontSize ?? input.fontSize, 24))),
      fontFamily: textFontFamily,
      margin: Math.min(200, Math.max(0, normalizeNonNegativeInteger(input.textMargin ?? input.margin, 24))),
      color: normalizeHexColor(input.textColor ?? input.color, "#FFFFFF"),
    },
  })
}

export function resolveAttachmentFeatureSettings(options: {
  appStateJson?: string | null
  uploadEnabledFallback?: boolean
  downloadEnabledFallback?: boolean
  minUploadLevelFallback?: number
  minUploadVipLevelFallback?: number
  allowedExtensionsFallback?: string[]
  maxFileSizeMbFallback?: number
} = {}): AttachmentFeatureSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const attachments = isRecord(siteSettingsState.attachments)
    ? siteSettingsState.attachments
    : {}
  const fallbackAllowedExtensions = Array.from(
    new Set(
      (options.allowedExtensionsFallback ?? [
        "zip",
        "rar",
        "7z",
        "pdf",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "ppt",
        "pptx",
        "txt",
      ])
        .map((item) => item.trim().toLowerCase().replace(/^\./, ""))
        .filter(Boolean),
    ),
  )

  return {
    uploadEnabled:
      typeof attachments.uploadEnabled === "boolean"
        ? attachments.uploadEnabled
        : typeof attachments.enabled === "boolean"
          ? attachments.enabled
          : options.uploadEnabledFallback ?? false,
    downloadEnabled:
      typeof attachments.downloadEnabled === "boolean"
        ? attachments.downloadEnabled
        : typeof attachments.enabled === "boolean"
          ? attachments.enabled
          : options.downloadEnabledFallback ?? false,
    minUploadLevel: normalizeNonNegativeInteger(
      attachments.minUploadLevel,
      normalizeNonNegativeInteger(options.minUploadLevelFallback, 0),
    ),
    minUploadVipLevel: normalizeNonNegativeInteger(
      attachments.minUploadVipLevel,
      normalizeNonNegativeInteger(options.minUploadVipLevelFallback, 0),
    ),
    allowedExtensions: normalizeFileExtensionList(
      attachments.allowedExtensions,
      fallbackAllowedExtensions,
    ),
    maxFileSizeMb: Math.max(
      1,
      normalizeNonNegativeInteger(
        attachments.maxFileSizeMb,
        normalizeNonNegativeInteger(options.maxFileSizeMbFallback, 20),
      ),
    ),
  }
}

export function mergeAttachmentFeatureSettings(
  appStateJson: string | null | undefined,
  input: AttachmentFeatureSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const allowedExtensions = Array.from(
    new Set(
      input.allowedExtensions
        .map((item) => item.trim().toLowerCase().replace(/^\./, ""))
        .filter(Boolean),
    ),
  )

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    attachments: {
      uploadEnabled: Boolean(input.uploadEnabled),
      downloadEnabled: Boolean(input.downloadEnabled),
      minUploadLevel: normalizeNonNegativeInteger(input.minUploadLevel, 0),
      minUploadVipLevel: normalizeNonNegativeInteger(input.minUploadVipLevel, 0),
      allowedExtensions:
        allowedExtensions.length > 0
          ? allowedExtensions
          : ["zip", "rar", "7z", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"],
      maxFileSizeMb: Math.max(1, normalizeNonNegativeInteger(input.maxFileSizeMb, 20)),
    },
  })
}

export function resolveMessageMediaSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  imageUploadEnabledFallback?: boolean
  fileUploadEnabledFallback?: boolean
  promptAudioPathFallback?: string
  realtimeEnabledFallback?: boolean
  realtimeHeartbeatSecondsFallback?: number
} = {}): MessageMediaSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const messageMedia = isRecord(siteSettingsState.messageMedia)
    ? siteSettingsState.messageMedia
    : {}

  return {
    enabled:
      typeof messageMedia.enabled === "boolean"
        ? messageMedia.enabled
        : options.enabledFallback ?? true,
    imageUploadEnabled:
      typeof messageMedia.imageUploadEnabled === "boolean"
        ? messageMedia.imageUploadEnabled
        : options.imageUploadEnabledFallback ?? false,
    fileUploadEnabled:
      typeof messageMedia.fileUploadEnabled === "boolean"
        ? messageMedia.fileUploadEnabled
        : options.fileUploadEnabledFallback ?? false,
    promptAudioPath: normalizeMessagePromptAudioPath(
      messageMedia.promptAudioPath,
      options.promptAudioPathFallback,
    ),
    realtimeEnabled: normalizeMessageRealtimeEnabled(
      messageMedia.realtimeEnabled,
      options.realtimeEnabledFallback,
    ),
    realtimeHeartbeatSeconds: normalizeMessageRealtimeHeartbeatSeconds(
      messageMedia.realtimeHeartbeatSeconds,
      options.realtimeHeartbeatSecondsFallback,
    ),
  }
}

export function mergeMessageMediaSettings(
  appStateJson: string | null | undefined,
  input: MessageMediaSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    messageMedia: {
      enabled: Boolean(input.enabled),
      imageUploadEnabled: Boolean(input.imageUploadEnabled),
      fileUploadEnabled: Boolean(input.fileUploadEnabled),
      promptAudioPath: normalizeMessagePromptAudioPath(input.promptAudioPath),
      realtimeEnabled: normalizeMessageRealtimeEnabled(input.realtimeEnabled),
      realtimeHeartbeatSeconds: normalizeMessageRealtimeHeartbeatSeconds(input.realtimeHeartbeatSeconds),
    },
  })
}

export function resolveUploadObjectStorageSettings(options: {
  appStateJson?: string | null
  forcePathStyleFallback?: boolean
} = {}): UploadObjectStorageSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const uploadObjectStorage = isRecord(siteSettingsState.uploadObjectStorage)
    ? siteSettingsState.uploadObjectStorage
    : {}

  return {
    forcePathStyle:
      typeof uploadObjectStorage.forcePathStyle === "boolean"
        ? uploadObjectStorage.forcePathStyle
        : options.forcePathStyleFallback ?? true,
  }
}

export function mergeUploadObjectStorageSettings(
  appStateJson: string | null | undefined,
  input: UploadObjectStorageSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    uploadObjectStorage: {
      forcePathStyle: input.forcePathStyle,
    },
  })
}
