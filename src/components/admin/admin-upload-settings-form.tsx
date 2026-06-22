"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useDeferredValue, useState, useTransition } from "react"
import { ImageIcon, Type, Upload, X } from "lucide-react"

import { AccessThresholdSelectGroup } from "@/components/access-threshold-select-group"
import {
  SettingsInputField,
  SettingsSection,
  SettingsSelectField,
  SettingsToggleField,
} from "@/components/admin/admin-settings-fields"
import { AdminSettingsSubTabs } from "@/components/admin/admin-settings-sub-tabs"
import { ColorPicker, normalizeHexColor } from "@/components/ui/color-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import type { AccessThresholdOption } from "@/lib/access-threshold-options"
import { saveAdminSiteSettings, uploadAdminWatermarkFontFile, uploadAdminWatermarkLogoFile } from "@/lib/admin-site-settings-client"
import { getAdminSettingsHref } from "@/lib/admin-settings-navigation"
import type { AdminSettingsSectionKey } from "@/lib/admin-navigation"
import type { UploadProvider } from "@/lib/upload-provider"
import type { ImageWatermarkPosition } from "@/lib/site-settings-app-state"
import {
  getAvailableWatermarkFontAssets,
  WATERMARK_BUILTIN_FONT_ASSETS,
  type WatermarkFontAsset,
} from "@/lib/watermark-lib"

interface AdminUploadSettingsFormProps {
  initialSettings: {
    uploadProvider: UploadProvider
    uploadLocalPath: string
    uploadBaseUrl?: string | null
    uploadOssBucket?: string | null
    uploadOssRegion?: string | null
    uploadOssEndpoint?: string | null
    uploadS3CredentialsConfigured: boolean
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
    attachmentUploadEnabled: boolean
    attachmentDownloadEnabled: boolean
    attachmentMinUploadLevel: number
    attachmentMinUploadVipLevel: number
    attachmentAllowedExtensions: string[]
    attachmentMaxFileSizeMb: number
  }
  levelOptions: AccessThresholdOption[]
  vipLevelOptions: AccessThresholdOption[]
  initialSubTab?: string
  tabRouteSection?: AdminSettingsSectionKey
}

function normalizeStringList(value: string[] | undefined, fallback: string[]) {
  return Array.isArray(value) && value.length > 0 ? value : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeSliderNumber(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return clamp(Number.isFinite(parsed) ? Math.round(parsed) : fallback, min, max)
}

type UploadSettingsTabKey = "storage" | "watermark" | "attachment"

const UPLOAD_TABS = [
  { key: "storage", label: "上传配置" },
  { key: "watermark", label: "水印配置" },
  { key: "attachment", label: "附件配置" },
] as const

const WATERMARK_POSITION_OPTIONS = [
  { value: "TOP_LEFT", label: "左上角" },
  { value: "TOP_RIGHT", label: "右上角" },
  { value: "BOTTOM_LEFT", label: "左下角" },
  { value: "BOTTOM_RIGHT", label: "右下角" },
  { value: "CENTER", label: "居中" },
]

function resolveUploadTab(initialSubTab?: string): UploadSettingsTabKey {
  return UPLOAD_TABS.some((item) => item.key === initialSubTab)
    ? (initialSubTab as UploadSettingsTabKey)
    : "storage"
}

function resolveDefaultWatermarkFontFamily() {
  return WATERMARK_BUILTIN_FONT_ASSETS[0]?.fontFamily ?? ""
}

function resolveKnownWatermarkFontFamilyForForm(value: string, fontAssets: readonly WatermarkFontAsset[]) {
  const availableFonts = getAvailableWatermarkFontAssets(fontAssets)
  return availableFonts.some((asset) => asset.fontFamily === value)
    ? value
    : resolveDefaultWatermarkFontFamily()
}

function mergeWatermarkFontAssets(currentAssets: readonly WatermarkFontAsset[], asset: WatermarkFontAsset) {
  const nextAssets = currentAssets.some((item) => item.id === asset.id)
    ? currentAssets.map((item) => item.id === asset.id ? asset : item)
    : [...currentAssets, asset]

  return nextAssets.slice(0, 20)
}

function isWatermarkFontFileName(fileName: string) {
  return /\.(?:ttf|otf|ttc)$/i.test(fileName)
}

export function AdminUploadSettingsForm({
  initialSettings,
  levelOptions,
  vipLevelOptions,
  initialSubTab,
  tabRouteSection,
}: AdminUploadSettingsFormProps) {
  const router = useRouter()
  const normalizedUploadAllowedImageTypes = normalizeStringList(initialSettings.uploadAllowedImageTypes, ["jpg", "jpeg", "png", "gif", "webp"])
  const normalizedAttachmentAllowedExtensions = normalizeStringList(initialSettings.attachmentAllowedExtensions, ["zip", "rar", "7z", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"])
  const normalizedAttachmentUploadEnabled = Boolean(initialSettings.attachmentUploadEnabled)
  const normalizedAttachmentDownloadEnabled = Boolean(initialSettings.attachmentDownloadEnabled)
  const normalizedAttachmentMinUploadLevel = Number.isInteger(initialSettings.attachmentMinUploadLevel) && initialSettings.attachmentMinUploadLevel >= 0
    ? initialSettings.attachmentMinUploadLevel
    : 0
  const normalizedAttachmentMinUploadVipLevel = Number.isInteger(initialSettings.attachmentMinUploadVipLevel) && initialSettings.attachmentMinUploadVipLevel >= 0
    ? initialSettings.attachmentMinUploadVipLevel
    : 0
  const normalizedAttachmentMaxFileSizeMb = Number.isFinite(initialSettings.attachmentMaxFileSizeMb) && initialSettings.attachmentMaxFileSizeMb > 0
    ? initialSettings.attachmentMaxFileSizeMb
    : 20
  const normalizedInitialWatermarkFontAssets = Array.isArray(initialSettings.imageWatermarkFontAssets)
    ? initialSettings.imageWatermarkFontAssets
    : []
  const [uploadProvider, setUploadProvider] = useState(initialSettings.uploadProvider)
  const [uploadLocalPath, setUploadLocalPath] = useState(initialSettings.uploadLocalPath)
  const [uploadBaseUrl, setUploadBaseUrl] = useState(initialSettings.uploadBaseUrl ?? "")
  const [uploadOssBucket, setUploadOssBucket] = useState(initialSettings.uploadOssBucket ?? "")
  const [uploadOssRegion, setUploadOssRegion] = useState(initialSettings.uploadOssRegion ?? "")
  const [uploadOssEndpoint, setUploadOssEndpoint] = useState(initialSettings.uploadOssEndpoint ?? "")
  const [uploadS3AccessKeyId, setUploadS3AccessKeyId] = useState("")
  const [uploadS3SecretAccessKey, setUploadS3SecretAccessKey] = useState("")
  const [uploadS3ForcePathStyle, setUploadS3ForcePathStyle] = useState(initialSettings.uploadS3ForcePathStyle)
  const [uploadRequireLogin, setUploadRequireLogin] = useState(initialSettings.uploadRequireLogin)
  const [uploadAllowedImageTypes, setUploadAllowedImageTypes] = useState(normalizedUploadAllowedImageTypes.join(", "))
  const [uploadMaxFileSizeMb, setUploadMaxFileSizeMb] = useState(String(initialSettings.uploadMaxFileSizeMb))
  const [uploadAvatarMaxFileSizeMb, setUploadAvatarMaxFileSizeMb] = useState(String(initialSettings.uploadAvatarMaxFileSizeMb))
  const [markdownImageUploadEnabled, setMarkdownImageUploadEnabled] = useState(initialSettings.markdownImageUploadEnabled)
  const [imageWatermarkEnabled, setImageWatermarkEnabled] = useState(Boolean(initialSettings.imageWatermarkEnabled))
  const [imageWatermarkTextEnabled, setImageWatermarkTextEnabled] = useState(Boolean(initialSettings.imageWatermarkTextEnabled))
  const [imageWatermarkText, setImageWatermarkText] = useState(initialSettings.imageWatermarkText ?? "")
  const [imageWatermarkTextPosition, setImageWatermarkTextPosition] = useState<ImageWatermarkPosition>(initialSettings.imageWatermarkTextPosition ?? "BOTTOM_RIGHT")
  const [imageWatermarkTextTiled, setImageWatermarkTextTiled] = useState(Boolean(initialSettings.imageWatermarkTextTiled))
  const [imageWatermarkTextOpacity, setImageWatermarkTextOpacity] = useState(String(initialSettings.imageWatermarkTextOpacity ?? 22))
  const [imageWatermarkTextFontSize, setImageWatermarkTextFontSize] = useState(String(initialSettings.imageWatermarkTextFontSize ?? 24))
  const [imageWatermarkFontAssets, setImageWatermarkFontAssets] = useState<WatermarkFontAsset[]>(normalizedInitialWatermarkFontAssets)
  const [imageWatermarkTextFontFamily, setImageWatermarkTextFontFamily] = useState(() => resolveKnownWatermarkFontFamilyForForm(initialSettings.imageWatermarkTextFontFamily ?? "", normalizedInitialWatermarkFontAssets))
  const [imageWatermarkTextMargin, setImageWatermarkTextMargin] = useState(String(initialSettings.imageWatermarkTextMargin ?? 24))
  const [imageWatermarkTextColor, setImageWatermarkTextColor] = useState(initialSettings.imageWatermarkTextColor ?? "#FFFFFF")
  const [imageWatermarkLogoEnabled, setImageWatermarkLogoEnabled] = useState(Boolean(initialSettings.imageWatermarkLogoEnabled))
  const [imageWatermarkLogoPath, setImageWatermarkLogoPath] = useState(initialSettings.imageWatermarkLogoPath ?? "")
  const [imageWatermarkLogoPosition, setImageWatermarkLogoPosition] = useState<ImageWatermarkPosition>(initialSettings.imageWatermarkLogoPosition ?? "BOTTOM_LEFT")
  const [imageWatermarkLogoTiled, setImageWatermarkLogoTiled] = useState(Boolean(initialSettings.imageWatermarkLogoTiled))
  const [imageWatermarkLogoOpacity, setImageWatermarkLogoOpacity] = useState(String(initialSettings.imageWatermarkLogoOpacity ?? 22))
  const [imageWatermarkLogoMargin, setImageWatermarkLogoMargin] = useState(String(initialSettings.imageWatermarkLogoMargin ?? 24))
  const [imageWatermarkLogoScalePercent, setImageWatermarkLogoScalePercent] = useState(String(initialSettings.imageWatermarkLogoScalePercent ?? 16))
  const [watermarkFontUploading, setWatermarkFontUploading] = useState(false)
  const [watermarkLogoUploading, setWatermarkLogoUploading] = useState(false)
  const [attachmentUploadEnabled, setAttachmentUploadEnabled] = useState(normalizedAttachmentUploadEnabled)
  const [attachmentDownloadEnabled, setAttachmentDownloadEnabled] = useState(normalizedAttachmentDownloadEnabled)
  const [attachmentMinUploadLevel, setAttachmentMinUploadLevel] = useState(String(normalizedAttachmentMinUploadLevel))
  const [attachmentMinUploadVipLevel, setAttachmentMinUploadVipLevel] = useState(String(normalizedAttachmentMinUploadVipLevel))
  const [attachmentAllowedExtensions, setAttachmentAllowedExtensions] = useState(normalizedAttachmentAllowedExtensions.join(", "))
  const [attachmentMaxFileSizeMb, setAttachmentMaxFileSizeMb] = useState(String(normalizedAttachmentMaxFileSizeMb))
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()
  const resolvedRouteTab = resolveUploadTab(initialSubTab)
  const [localActiveTab, setLocalActiveTab] = useState<UploadSettingsTabKey>(resolvedRouteTab)
  const activeTab = tabRouteSection ? resolvedRouteTab : localActiveTab
  const normalizedImageWatermarkTextOpacity = normalizeSliderNumber(imageWatermarkTextOpacity, initialSettings.imageWatermarkTextOpacity ?? 22, 0, 100)
  const normalizedImageWatermarkTextFontSize = normalizeSliderNumber(imageWatermarkTextFontSize, initialSettings.imageWatermarkTextFontSize ?? 24, 8, 160)
  const normalizedImageWatermarkTextMargin = normalizeSliderNumber(imageWatermarkTextMargin, initialSettings.imageWatermarkTextMargin ?? 24, 0, 200)
  const normalizedImageWatermarkLogoOpacity = normalizeSliderNumber(imageWatermarkLogoOpacity, initialSettings.imageWatermarkLogoOpacity ?? 22, 0, 100)
  const normalizedImageWatermarkLogoMargin = normalizeSliderNumber(imageWatermarkLogoMargin, initialSettings.imageWatermarkLogoMargin ?? 24, 0, 200)
  const normalizedImageWatermarkLogoScalePercent = normalizeSliderNumber(imageWatermarkLogoScalePercent, initialSettings.imageWatermarkLogoScalePercent ?? 16, 1, 60)
  const availableWatermarkFonts = getAvailableWatermarkFontAssets(imageWatermarkFontAssets)
  const selectedImageWatermarkTextFontFamily = availableWatermarkFonts.some((asset) => asset.fontFamily === imageWatermarkTextFontFamily)
    ? imageWatermarkTextFontFamily
    : resolveDefaultWatermarkFontFamily()
  const useRemoteStorage = uploadProvider === "s3"
  const currentTabSaveLabel = activeTab === "storage"
    ? "保存上传配置"
    : activeTab === "watermark"
      ? "保存水印配置"
      : "保存附件配置"

  async function handleWatermarkLogoUpload(file: File) {
    if (file.type && !file.type.startsWith("image/")) {
      setFeedback("请先选择图片格式的水印文件")
      return
    }

    setFeedback("")
    setWatermarkLogoUploading(true)

    try {
      const result = await uploadAdminWatermarkLogoFile(file)
      setFeedback(result.message)

      if (result.ok) {
        setImageWatermarkLogoPath(result.data.urlPath)
      }
    } finally {
      setWatermarkLogoUploading(false)
    }
  }

  async function handleWatermarkFontUpload(file: File) {
    if (!isWatermarkFontFileName(file.name)) {
      setFeedback("请先选择 TTF / OTF / TTC 字体文件")
      return
    }

    setFeedback("")
    setWatermarkFontUploading(true)

    try {
      const result = await uploadAdminWatermarkFontFile(file)
      setFeedback(result.message)

      if (result.ok) {
        setImageWatermarkFontAssets((currentAssets) => mergeWatermarkFontAssets(currentAssets, result.data.asset))
        setImageWatermarkTextFontFamily(result.data.asset.fontFamily)
        router.refresh()
      }
    } finally {
      setWatermarkFontUploading(false)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        setFeedback("")
        startTransition(async () => {
          const result = await saveAdminSiteSettings({
            uploadProvider,
            uploadLocalPath,
            uploadBaseUrl,
            uploadOssBucket,
            uploadOssRegion,
            uploadOssEndpoint,
            uploadS3AccessKeyId,
            uploadS3SecretAccessKey,
            uploadS3ForcePathStyle,
            uploadRequireLogin,
            uploadAllowedImageTypes,
            uploadMaxFileSizeMb: Number(uploadMaxFileSizeMb),
            uploadAvatarMaxFileSizeMb: Number(uploadAvatarMaxFileSizeMb),
            markdownImageUploadEnabled,
            imageWatermarkEnabled,
            imageWatermarkTextEnabled,
            imageWatermarkText,
            imageWatermarkTextPosition,
            imageWatermarkTextTiled,
            imageWatermarkTextOpacity: normalizedImageWatermarkTextOpacity,
            imageWatermarkTextFontSize: normalizedImageWatermarkTextFontSize,
            imageWatermarkTextFontFamily: selectedImageWatermarkTextFontFamily,
            imageWatermarkFontAssets,
            imageWatermarkTextMargin: normalizedImageWatermarkTextMargin,
            imageWatermarkTextColor,
            imageWatermarkLogoEnabled,
            imageWatermarkLogoPath,
            imageWatermarkLogoPosition,
            imageWatermarkLogoTiled,
            imageWatermarkLogoOpacity: normalizedImageWatermarkLogoOpacity,
            imageWatermarkLogoMargin: normalizedImageWatermarkLogoMargin,
            imageWatermarkLogoScalePercent: normalizedImageWatermarkLogoScalePercent,
            attachmentUploadEnabled,
            attachmentDownloadEnabled,
            attachmentMinUploadLevel: Number(attachmentMinUploadLevel),
            attachmentMinUploadVipLevel: Number(attachmentMinUploadVipLevel),
            attachmentAllowedExtensions,
            attachmentMaxFileSizeMb: Number(attachmentMaxFileSizeMb),
            section: "upload",
          })
          setFeedback(result.message)
          if (result.ok) {
            router.refresh()
          }
        })
      }}
    >
      <SettingsSection
        title="上传系统配置"
        description="将上传链路拆分为存储、水印、附件三块配置，减少单页信息密度。"
        className="border-none shadow-none ring-0"
      >
        {!tabRouteSection ? (
          <AdminSettingsSubTabs
            items={UPLOAD_TABS.map((item) => ({
              key: item.key,
              label: item.label,
              ...(tabRouteSection
                ? { href: getAdminSettingsHref(tabRouteSection, item.key) }
                : { onSelect: () => setLocalActiveTab(item.key) }),
            }))}
            activeKey={activeTab}
          />
        ) : null}

        {activeTab === "storage" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SettingsSelectField label="存储策略" value={uploadProvider} onChange={(value) => setUploadProvider(value as UploadProvider)} options={[{ value: "local", label: "本地存储" }, { value: "s3", label: "S3 兼容对象存储" }]} />
              <SettingsInputField label="本地上传目录" value={uploadLocalPath} onChange={setUploadLocalPath} placeholder="如 uploads" />
              <SettingsInputField label="资源访问基础 URL" value={uploadBaseUrl} onChange={setUploadBaseUrl} placeholder={useRemoteStorage ? "如 https://cdn.example.com 或 https://pub-xxx.r2.dev" : "留空则自动使用 /uploads"} />
              {useRemoteStorage ? <SettingsInputField label="Bucket" value={uploadOssBucket} onChange={setUploadOssBucket} placeholder="如 my-bucket" /> : null}
              {useRemoteStorage ? <SettingsInputField label="Region" value={uploadOssRegion} onChange={setUploadOssRegion} placeholder="R2 可填 auto" /> : null}
              {useRemoteStorage ? <SettingsInputField label="Endpoint" value={uploadOssEndpoint} onChange={setUploadOssEndpoint} placeholder="如 https://<accountid>.r2.cloudflarestorage.com" /> : null}
              {useRemoteStorage ? <SettingsInputField label="Access Key ID" value={uploadS3AccessKeyId} onChange={setUploadS3AccessKeyId} placeholder={initialSettings.uploadS3CredentialsConfigured ? "留空则保持当前 Access Key ID" : "填写对象存储 Access Key ID"} /> : null}
              {useRemoteStorage ? <SettingsInputField label="Secret Access Key" type="password" value={uploadS3SecretAccessKey} onChange={setUploadS3SecretAccessKey} placeholder={initialSettings.uploadS3CredentialsConfigured ? "留空则保持当前 Secret Access Key" : "填写对象存储 Secret Access Key"} /> : null}
              {useRemoteStorage ? <SettingsToggleField label="强制 Path-Style" checked={uploadS3ForcePathStyle} onChange={setUploadS3ForcePathStyle} description="R2、MinIO 等自定义 endpoint 通常建议开启；若使用原生 AWS S3 虚拟主机风格，可关闭。" /> : null}
              <SettingsToggleField label="必须登录后上传" checked={uploadRequireLogin} onChange={setUploadRequireLogin} description="关闭后游客也能调用上传接口，但当前上传记录仍依赖用户归属，通常建议保持开启。" />
              <SettingsToggleField label="Markdown 图片上传" checked={markdownImageUploadEnabled} onChange={setMarkdownImageUploadEnabled} description="关闭后，Markdown 编辑器中的图片按钮会改为手动插入远程图片 URL，不再触发本地图片上传。" />
              <SettingsInputField label="允许图片格式" value={uploadAllowedImageTypes} onChange={setUploadAllowedImageTypes} placeholder="如 jpg, jpeg, png, gif, webp" />
              <SettingsInputField label="通用图片大小上限（MB）" type="number" value={uploadMaxFileSizeMb} onChange={setUploadMaxFileSizeMb} />
              <SettingsInputField label="头像大小上限（MB）" type="number" value={uploadAvatarMaxFileSizeMb} onChange={setUploadAvatarMaxFileSizeMb} />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">
              {useRemoteStorage
                ? `对象存储模式下会直接上传到 S3 兼容接口；图片最终访问地址优先使用“资源访问基础 URL”，未填写时会尝试用 endpoint 自动拼接。${initialSettings.uploadS3CredentialsConfigured ? "当前已保存对象存储密钥，留空提交将继续沿用。" : "当前尚未保存对象存储密钥。"}`
                : "本地存储模式下，文件会写入站点服务器的本地上传目录；资源访问基础 URL 留空时默认使用 /uploads。"}
            </p>
          </div>
        ) : null}

        {activeTab === "watermark" ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SettingsToggleField label="启用水印处理" checked={imageWatermarkEnabled} onChange={setImageWatermarkEnabled} description="开启后会在服务端保存前写入已启用的文字或图片水印，远程存储也会先处理图片后再上传。" className="md:col-span-2 xl:col-span-3" />

              <div className="flex flex-col gap-4 border-t border-border pt-4 md:col-span-2 xl:col-span-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">文字水印</h4>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">文字水印拥有独立的位置、平铺、透明度、字号、颜色和边距。</p>
                  </div>
                  <SettingsToggleField label="启用文字水印" checked={imageWatermarkTextEnabled} onChange={setImageWatermarkTextEnabled} className="min-w-48" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <SettingsInputField label="水印文字" value={imageWatermarkText} onChange={setImageWatermarkText} placeholder="如 @站点名称 / 禁止转载" />
                  <SettingsSelectField
                    label="文字位置"
                    value={imageWatermarkTextPosition}
                    onChange={(value) => setImageWatermarkTextPosition(value as ImageWatermarkPosition)}
                    description="单点文字决定角落位置；铺满模式下作为平铺纹理的起始偏移锚点。"
                    options={WATERMARK_POSITION_OPTIONS}
                  />
                  <SettingsToggleField label="文字铺满整张图片" checked={imageWatermarkTextTiled} onChange={setImageWatermarkTextTiled} description="开启后文字会以倾斜网格重复铺设，文字边距会被当作平铺间距使用。" />
                  <WatermarkFontPicker
                    fonts={availableWatermarkFonts}
                    customFonts={imageWatermarkFontAssets}
                    value={selectedImageWatermarkTextFontFamily}
                    uploading={watermarkFontUploading}
                    onValueChange={setImageWatermarkTextFontFamily}
                    onUpload={handleWatermarkFontUpload}
                  />
                  <ColorPicker
                    label="文字颜色"
                    value={imageWatermarkTextColor}
                    onChange={setImageWatermarkTextColor}
                    presets={WATERMARK_COLOR_PRESETS}
                    fallbackColor="#FFFFFF"
                    placeholder="#FFFFFF"
                    popoverTitle="选择文字颜色"
                  />
                  <WatermarkSliderField
                    label="文字透明度"
                    value={normalizedImageWatermarkTextOpacity}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(nextValue) => setImageWatermarkTextOpacity(String(nextValue))}
                    description="数值越低越隐蔽，数值越高越醒目。"
                  />
                  <WatermarkSliderField
                    label="文字字号"
                    value={normalizedImageWatermarkTextFontSize}
                    min={8}
                    max={160}
                    suffix="px"
                    onChange={(nextValue) => setImageWatermarkTextFontSize(String(nextValue))}
                    description="服务端会按这个字号测量、换行并绘制水印文本。"
                  />
                  <WatermarkSliderField
                    label="文字边距 / 间距"
                    value={normalizedImageWatermarkTextMargin}
                    min={0}
                    max={200}
                    suffix="px"
                    onChange={(nextValue) => setImageWatermarkTextMargin(String(nextValue))}
                    description="单点模式表示离边缘的距离，铺满模式表示相邻文字之间的间距。"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-border pt-4 md:col-span-2 xl:col-span-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">图片水印</h4>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">图片水印拥有独立的位置、平铺、透明度、尺寸和边距。</p>
                  </div>
                  <SettingsToggleField label="启用图片水印" checked={imageWatermarkLogoEnabled} onChange={setImageWatermarkLogoEnabled} className="min-w-48" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <WatermarkLogoUploadField
                    value={imageWatermarkLogoPath}
                    uploading={watermarkLogoUploading}
                    onValueChange={setImageWatermarkLogoPath}
                    onUpload={handleWatermarkLogoUpload}
                    onClear={() => setImageWatermarkLogoPath("")}
                  />
                  <SettingsSelectField
                    label="图片位置"
                    value={imageWatermarkLogoPosition}
                    onChange={(value) => setImageWatermarkLogoPosition(value as ImageWatermarkPosition)}
                    description="单点图片决定角落位置；铺满模式下作为平铺纹理的起始偏移锚点。"
                    options={WATERMARK_POSITION_OPTIONS}
                  />
                  <SettingsToggleField label="图片铺满整张图片" checked={imageWatermarkLogoTiled} onChange={setImageWatermarkLogoTiled} description="开启后图片会以倾斜网格重复铺设，图片边距会被当作平铺间距使用。" />
                  <WatermarkSliderField
                    label="图片透明度"
                    value={normalizedImageWatermarkLogoOpacity}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(nextValue) => setImageWatermarkLogoOpacity(String(nextValue))}
                    description="单独控制图片水印的显示强度。"
                  />
                  <WatermarkSliderField
                    label="图片边距 / 间距"
                    value={normalizedImageWatermarkLogoMargin}
                    min={0}
                    max={200}
                    suffix="px"
                    onChange={(nextValue) => setImageWatermarkLogoMargin(String(nextValue))}
                    description="单点模式表示离边缘的距离，铺满模式表示相邻图片之间的间距。"
                  />
                  <WatermarkSliderField
                    label="图片水印宽度"
                    value={normalizedImageWatermarkLogoScalePercent}
                    min={1}
                    max={60}
                    suffix="%"
                    onChange={(nextValue) => setImageWatermarkLogoScalePercent(String(nextValue))}
                    description="按原图宽度比例缩放水印图片，高度会按图片自身比例自动计算。"
                  />
                </div>
              </div>
            </div>
            <WatermarkPreview
              enabled={imageWatermarkEnabled}
              textEnabled={imageWatermarkTextEnabled}
              text={imageWatermarkText}
              textPosition={imageWatermarkTextPosition}
              textTiled={imageWatermarkTextTiled}
              textOpacity={normalizedImageWatermarkTextOpacity}
              textFontSize={normalizedImageWatermarkTextFontSize}
              textFontFamily={selectedImageWatermarkTextFontFamily}
              textMargin={normalizedImageWatermarkTextMargin}
              textColor={imageWatermarkTextColor}
              logoEnabled={imageWatermarkLogoEnabled}
              logoPath={imageWatermarkLogoPath}
              logoPosition={imageWatermarkLogoPosition}
              logoTiled={imageWatermarkLogoTiled}
              logoOpacity={normalizedImageWatermarkLogoOpacity}
              logoMargin={normalizedImageWatermarkLogoMargin}
              logoScalePercent={normalizedImageWatermarkLogoScalePercent}
            />
          </div>
        ) : null}

        {activeTab === "attachment" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SettingsToggleField label="启用附件上传" checked={attachmentUploadEnabled} onChange={setAttachmentUploadEnabled} description="关闭后不再允许上传站内附件，但仍可继续添加网盘链接附件。" />
              <SettingsToggleField label="启用附件下载" checked={attachmentDownloadEnabled} onChange={setAttachmentDownloadEnabled} description="关闭后仅拦截站内附件的下载与购买入口，网盘附件的信息查看不受影响。" />
              <div className="md:col-span-2 xl:col-span-2">
                <AccessThresholdSelectGroup
                  levelValue={attachmentMinUploadLevel}
                  vipLevelValue={attachmentMinUploadVipLevel}
                  levelOptions={levelOptions}
                  vipLevelOptions={vipLevelOptions}
                  onLevelChange={setAttachmentMinUploadLevel}
                  onVipLevelChange={setAttachmentMinUploadVipLevel}
                  levelLabel="附件添加最低用户等级"
                  vipLevelLabel="附件添加最低 VIP 等级"
                  levelDescriptionBuilder={(option) => option?.value === "0" ? "不限制用户等级，任何满足发帖权限的用户都可以添加附件。" : `至少达到 ${option?.label ?? "当前等级"} 才能在发帖时添加站内附件或网盘附件。`}
                  vipLevelDescriptionBuilder={(option) => option?.value === "0" ? "不限制 VIP 等级。" : `至少达到 ${option?.label ?? "当前 VIP"} 才能在发帖时添加站内附件或网盘附件。`}
                />
              </div>
              <SettingsInputField label="允许附件格式" value={attachmentAllowedExtensions} onChange={setAttachmentAllowedExtensions} placeholder="如 zip, rar, 7z, pdf, docx, xlsx" />
              <SettingsInputField label="附件大小上限（MB）" type="number" value={attachmentMaxFileSizeMb} onChange={setAttachmentMaxFileSizeMb} />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">
              上传型附件会复用现有存储策略写入本地或对象存储；下载时统一走站内接口完成权限校验与下载次数统计。网盘附件不占用站内存储，且不受站内上传/下载开关影响，但仍受各附件自身的等级、积分和回复权限控制。
            </p>
          </div>
        ) : null}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isPending} size="lg" className="rounded-full px-4 text-xs">{isPending ? "保存中..." : currentTabSaveLabel}</Button>
          {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
        </div>
      </SettingsSection>
    </form>
  )
}

const WATERMARK_COLOR_PRESETS = ["#FFFFFF", "#F8FAFC", "#E2E8F0", "#FDE68A", "#FCA5A5", "#93C5FD", "#A7F3D0", "#000000", "#111827"] as const

function WatermarkPreview({
  enabled,
  textEnabled,
  text,
  textPosition,
  textTiled,
  textOpacity,
  textFontSize,
  textFontFamily,
  textMargin,
  textColor,
  logoEnabled,
  logoPath,
  logoPosition,
  logoTiled,
  logoOpacity,
  logoMargin,
  logoScalePercent,
}: {
  enabled: boolean
  textEnabled: boolean
  text: string
  textPosition: ImageWatermarkPosition
  textTiled: boolean
  textOpacity: number
  textFontSize: number
  textFontFamily: string
  textMargin: number
  textColor: string
  logoEnabled: boolean
  logoPath: string
  logoPosition: ImageWatermarkPosition
  logoTiled: boolean
  logoOpacity: number
  logoMargin: number
  logoScalePercent: number
}) {
  const previewQuery = new URLSearchParams({
    enabled: enabled ? "1" : "0",
    textEnabled: textEnabled ? "1" : "0",
    text,
    textPosition,
    textTiled: textTiled ? "1" : "0",
    textOpacity: String(textOpacity),
    textFontSize: String(textFontSize),
    textFontFamily,
    textMargin: String(textMargin),
    textColor: normalizeHexColor(textColor || "#FFFFFF", "#FFFFFF"),
    logoEnabled: logoEnabled ? "1" : "0",
    logoPath,
    logoPosition,
    logoTiled: logoTiled ? "1" : "0",
    logoOpacity: String(logoOpacity),
    logoMargin: String(logoMargin),
    logoScalePercent: String(logoScalePercent),
  }).toString()
  const previewUrl = useDeferredValue(`/api/admin/site-settings/watermark-preview?${previewQuery}`)

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h4 className="text-sm font-semibold">效果预览</h4>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">预览图由服务端实时生成，字体、换行、阴影和透明度与实际落盘水印完全复用同一套 canvas 渲染逻辑。</p>
      </div>
      <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle_at_top_left,#fef3c7,transparent_32%),radial-gradient(circle_at_bottom_right,#bfdbfe,transparent_34%),linear-gradient(135deg,#0f172a,#1e293b_52%,#334155)]">
        <Image
          alt="水印服务端预览"
          className="object-cover"
          draggable={false}
          fill
          loading="eager"
          sizes="(max-width: 1024px) 100vw, 768px"
          src={previewUrl}
          unoptimized
        />
        {!enabled ? (
          <div className="absolute inset-x-0 bottom-0 bg-black/45 px-4 py-2 text-center text-xs text-white/80">
            当前水印功能关闭，以上仅为配置预览
          </div>
        ) : null}
      </div>
    </div>
  )
}

function WatermarkFontPicker({
  fonts,
  customFonts,
  value,
  uploading,
  onValueChange,
  onUpload,
}: {
  fonts: WatermarkFontAsset[]
  customFonts: WatermarkFontAsset[]
  value: string
  uploading: boolean
  onValueChange: (value: string) => void
  onUpload: (file: File) => void | Promise<void>
}) {
  return (
    <div className="flex flex-col gap-2 md:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">水印字体</span>
        <Button type="button" variant="outline" size="sm" disabled={uploading} nativeButton={false} render={(buttonProps) => (
          <label {...buttonProps} className={`${buttonProps.className ?? ""} cursor-pointer`}>
            <Upload data-icon="inline-start" />
            {uploading ? "上传中..." : "上传字体"}
            <input
              type="file"
              accept=".ttf,.otf,.ttc,font/ttf,font/otf,application/x-font-ttf,application/x-font-otf"
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void onUpload(file)
                }
                event.target.value = ""
              }}
            />
          </label>
        )} />
      </div>
      <SettingsSelectField
        label="选择字体"
        value={value}
        onChange={onValueChange}
        options={fonts.map((asset) => ({ value: asset.fontFamily, label: asset.label }))}
        description="默认仅提供芝芒行书；新增字体需要先上传 TTF、OTF 或 TTC 文件。"
      />
      {customFonts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {customFonts.map((asset) => (
            <span key={asset.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              <Type data-icon="inline-start" />
              <span className="truncate">{asset.label}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function WatermarkLogoUploadField({
  value,
  uploading,
  onValueChange,
  onUpload,
  onClear,
}: {
  value: string
  uploading: boolean
  onValueChange: (value: string) => void
  onUpload: (file: File) => void | Promise<void>
  onClear: () => void
}) {
  return (
    <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">水印图片</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={uploading} nativeButton={false} render={(buttonProps) => (
            <label {...buttonProps} className={`${buttonProps.className ?? ""} cursor-pointer`}>
              <Upload data-icon="inline-start" />
              {uploading ? "上传中..." : "上传图片"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void onUpload(file)
                  }
                  event.target.value = ""
                }}
              />
            </label>
          )} />
          <Button type="button" variant="ghost" size="icon-sm" disabled={!value || uploading} onClick={onClear} title="清空水印图片">
            <X />
          </Button>
        </div>
      </div>
      <Input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className="h-11 rounded-xl bg-background px-4 text-sm"
        placeholder="上传后自动填入，也可以填写 /uploads/... 图片地址"
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
          <div className="relative flex aspect-video w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
            <Image src={value} alt="水印图片预览" fill sizes="128px" className="object-contain p-2" unoptimized />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ImageIcon data-icon="inline-start" />
              <span className="truncate">已选择图片水印</span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{value}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">图片水印适合使用透明 PNG/WebP；可单独使用，也可以和文字水印叠加。</p>
      )}
    </div>
  )
}

function WatermarkSliderField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
  description,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  onChange: (value: number) => void
  description?: string
}) {
  return (
    <label className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground/80">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={1}
        value={[value]}
        className="px-1 [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-foreground/10 dark:[&_[data-slot=slider-track]]:bg-white/12 [&_[data-slot=slider-range]]:bg-foreground dark:[&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-background [&_[data-slot=slider-thumb]]:bg-background [&_[data-slot=slider-thumb]]:shadow-[0_0_0_4px_rgba(15,23,42,0.08)] dark:[&_[data-slot=slider-thumb]]:shadow-[0_0_0_4px_rgba(255,255,255,0.12)]"
        onValueChange={(nextValue) => {
          const resolvedValue = Array.isArray(nextValue) ? nextValue[0] : nextValue
          onChange(typeof resolvedValue === "number" ? resolvedValue : min)
        }}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">
          {min}
          {suffix}
        </span>
        <span className="tabular-nums">
          {max}
          {suffix}
        </span>
      </div>
      {description ? <p className="text-xs leading-5 text-muted-foreground">{description}</p> : null}
    </label>
  )
}
