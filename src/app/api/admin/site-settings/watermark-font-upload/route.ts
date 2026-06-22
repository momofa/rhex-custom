import { createHash } from "crypto"
import { mkdir, unlink, writeFile } from "fs/promises"
import path from "path"

import { GlobalFonts } from "@napi-rs/canvas"

import { updateSiteSettingsRecord } from "@/db/site-settings-write-queries"
import { apiError, apiSuccess, createAdminRouteHandler } from "@/lib/api-route"
import { finalizeSiteSettingsUpdate } from "@/lib/admin-site-settings-shared"
import { getOrCreateSiteSettings } from "@/lib/admin-site-settings-service"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { mergeImageWatermarkSettings, resolveImageWatermarkSettings } from "@/lib/site-settings-app-state"
import { buildUploadStoragePath } from "@/lib/upload-path"
import { normalizeUploadExtension } from "@/lib/upload-rules"
import {
  buildWatermarkCustomFontFamily,
  normalizeWatermarkFontLabel,
  WATERMARK_FONT_UPLOAD_FOLDER,
  type WatermarkFontAsset,
} from "@/lib/watermark-lib"

const WATERMARK_FONT_EXTENSIONS = ["ttf", "otf", "ttc"] as const
const WATERMARK_FONT_EXTENSION_SET = new Set<string>(WATERMARK_FONT_EXTENSIONS)
const WATERMARK_FONT_MAX_SIZE_MB = 20

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

function getPrimaryFontAlias(fontFamily: string) {
  return fontFamily
    .split(",")[0]
    ?.trim()
    .replace(/^["']+|["']+$/g, "") ?? ""
}

async function readFontFileBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer())
}

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const settings = await getOrCreateSiteSettings()
  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    apiError(400, "缺少上传文件")
  }

  if (file.size <= 0) {
    apiError(400, "上传文件不能为空")
  }

  if (file.size > WATERMARK_FONT_MAX_SIZE_MB * 1024 * 1024) {
    apiError(400, `字体文件不能超过 ${WATERMARK_FONT_MAX_SIZE_MB}MB`)
  }

  const extension = normalizeUploadExtension(file.name)
  if (!extension || !WATERMARK_FONT_EXTENSION_SET.has(extension)) {
    apiError(400, `仅支持上传 ${WATERMARK_FONT_EXTENSIONS.join(" / ")} 格式的字体文件`)
  }

  const fileBuffer = await readFontFileBuffer(file)
  const fileHash = createHash("sha256").update(fileBuffer).digest("hex")
  const shortHash = fileHash.slice(0, 16)
  const id = `custom-${shortHash}`
  const fileName = `font-${shortHash}.${extension}`
  const label = normalizeWatermarkFontLabel(formData.get("label"), file.name.replace(/\.[^.]+$/, ""))
  const fontFamily = buildWatermarkCustomFontFamily(id)
  const alias = getPrimaryFontAlias(fontFamily)
  const uploadRoot = buildUploadStoragePath(settings.uploadLocalPath, WATERMARK_FONT_UPLOAD_FOLDER)
  const destinationPath = path.join(uploadRoot, fileName)

  await mkdir(uploadRoot, { recursive: true })
  await writeFile(destinationPath, fileBuffer)

  try {
    if (!GlobalFonts.has(alias)) {
      const registered = GlobalFonts.registerFromPath(destinationPath, alias)

      if (!registered) {
        apiError(400, "字体文件无法被服务端识别，请换用有效的 TTF/OTF/TTC 文件")
      }
    }
  } catch (error) {
    await unlink(destinationPath).catch(() => undefined)
    console.warn("[watermark-font-upload] invalid watermark font file", error)
    apiError(400, "字体文件无法被服务端识别，请换用有效的 TTF/OTF/TTC 文件")
  }

  const asset: WatermarkFontAsset = {
    id,
    label,
    fileName,
    fontFamily,
    urlPath: "",
  }
  const existingImageWatermarkSettings = resolveImageWatermarkSettings({
    appStateJson: settings.appStateJson,
    enabledFallback: false,
    textFallback: "",
    positionFallback: "BOTTOM_RIGHT",
    tiledFallback: false,
    opacityFallback: 22,
    fontSizeFallback: 24,
    fontFamilyFallback: "",
    marginFallback: 24,
    colorFallback: "#FFFFFF",
    logoPathFallback: "",
    logoScalePercentFallback: 16,
  })
  const nextFontAssets = existingImageWatermarkSettings.fontAssets.some((item) => item.id === asset.id)
    ? existingImageWatermarkSettings.fontAssets.map((item) => item.id === asset.id ? asset : item)
    : [...existingImageWatermarkSettings.fontAssets, asset]
  const appStateJson = mergeImageWatermarkSettings(settings.appStateJson, {
    ...existingImageWatermarkSettings,
    fontAssets: nextFontAssets,
    textFontFamily: asset.fontFamily,
    fontFamily: asset.fontFamily,
  })
  const updatedSettings = await updateSiteSettingsRecord(settings.id, {
    appStateJson,
  })

  logRouteWriteSuccess({
    scope: "admin-watermark-font-upload",
    action: "upload-watermark-font",
  }, {
    userId: adminUser.id,
    targetId: asset.id,
    extra: {
      fileName: asset.fileName,
      label: asset.label,
    },
  })

  finalizeSiteSettingsUpdate({
    settings: updatedSettings,
    message: "字体上传成功",
  })

  return apiSuccess({ asset }, "字体上传成功")
}, {
  errorMessage: "上传水印字体失败",
  logPrefix: "[api/admin/site-settings/watermark-font-upload] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.operations.manage",
})
