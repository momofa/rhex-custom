import type { ImageWatermarkPosition } from "@/lib/site-settings-app-state"
import type { UploadProvider } from "@/lib/upload-provider"
import type { WatermarkFontAsset } from "@/lib/watermark-lib"

export interface SiteSettingsMarkdownEmojiItem {
  shortcode: string
  label: string
  icon: string
  group?: string
  displaySize?: number
}

export interface SiteSettingsUploadData {
  uploadProvider: UploadProvider
  uploadLocalPath: string
  uploadBaseUrl?: string | null
  uploadOssBucket?: string | null
  uploadOssRegion?: string | null
  uploadOssEndpoint?: string | null
  uploadS3ForcePathStyle: boolean
  uploadRequireLogin: boolean
  uploadAllowedImageTypes: string[]
  uploadMaxFileSizeMb: number
  uploadAvatarMaxFileSizeMb: number
  markdownImageUploadEnabled: boolean
  imageWatermarkEnabled: boolean
  imageWatermarkTextEnabled: boolean
  imageWatermarkText: string
  imageWatermarkTextPosition: ImageWatermarkPosition
  imageWatermarkTextTiled: boolean
  imageWatermarkTextOpacity: number
  imageWatermarkTextFontSize: number
  imageWatermarkTextFontFamily: string
  imageWatermarkFontAssets: WatermarkFontAsset[]
  imageWatermarkTextMargin: number
  imageWatermarkTextColor: string
  imageWatermarkLogoEnabled: boolean
  imageWatermarkLogoPath: string
  imageWatermarkLogoPosition: ImageWatermarkPosition
  imageWatermarkLogoTiled: boolean
  imageWatermarkLogoOpacity: number
  imageWatermarkLogoMargin: number
  imageWatermarkLogoScalePercent: number
  imageWatermarkPosition: ImageWatermarkPosition
  imageWatermarkTiled: boolean
  imageWatermarkOpacity: number
  imageWatermarkFontSize: number
  imageWatermarkFontFamily: string
  imageWatermarkMargin: number
  imageWatermarkColor: string
  attachmentUploadEnabled: boolean
  attachmentDownloadEnabled: boolean
  attachmentMinUploadLevel: number
  attachmentMinUploadVipLevel: number
  attachmentAllowedExtensions: string[]
  attachmentMaxFileSizeMb: number
  messageEnabled: boolean
  messageImageUploadEnabled: boolean
  messageFileUploadEnabled: boolean
  messagePromptAudioPath: string
  messageRealtimeEnabled: boolean
  messageRealtimeHeartbeatSeconds: number
  markdownEmojiMapJson?: string | null
  markdownEmojiMap: SiteSettingsMarkdownEmojiItem[]
  appStateJson?: string | null
}
