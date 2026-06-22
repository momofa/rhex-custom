import { adminPost, getAdminClientErrorMessage } from "@/lib/admin-client"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import type { WatermarkFontAsset } from "@/lib/watermark-lib"

export interface UploadMarkdownEmojiFilesData {
  items: MarkdownEmojiItem[]
}

export interface UploadAdminImageData {
  urlPath: string
}

export interface UploadAdminWatermarkFontData {
  asset: WatermarkFontAsset
}

function isUploadAdminImageData(value: unknown): value is UploadAdminImageData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  return typeof (value as Record<string, unknown>).urlPath === "string"
}

function isWatermarkFontAsset(value: unknown): value is WatermarkFontAsset {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const row = value as Record<string, unknown>
  return (
    typeof row.id === "string" &&
    typeof row.label === "string" &&
    typeof row.fileName === "string" &&
    typeof row.fontFamily === "string" &&
    typeof row.urlPath === "string"
  )
}

function isUploadAdminWatermarkFontData(value: unknown): value is UploadAdminWatermarkFontData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  return isWatermarkFontAsset((value as Record<string, unknown>).asset)
}

function isMarkdownEmojiItem(value: unknown): value is MarkdownEmojiItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const row = value as Record<string, unknown>
  return (
    typeof row.shortcode === "string" &&
    typeof row.label === "string" &&
    typeof row.icon === "string" &&
    (typeof row.group === "undefined" || typeof row.group === "string") &&
    (typeof row.displaySize === "undefined" || typeof row.displaySize === "number")
  )
}

function isUploadMarkdownEmojiFilesData(value: unknown): value is UploadMarkdownEmojiFilesData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const row = value as Record<string, unknown>
  return (
    Array.isArray(row.items) &&
    row.items.every(isMarkdownEmojiItem)
  )
}

export async function saveAdminSiteSettings(payload: Record<string, unknown>) {
  try {
    const result = await adminPost("/api/admin/site-settings", payload, {
      defaultSuccessMessage: "保存成功",
      defaultErrorMessage: "保存失败",
    })

    return {
      ok: true,
      message: result.message,
    }
  } catch (error) {
    return {
      ok: false,
      message: getAdminClientErrorMessage(error, "保存失败"),
    }
  }
}

export async function uploadAdminMarkdownEmojiFiles(files: File[], group?: string) {
  try {
    const formData = new FormData()
    for (const file of files) {
      formData.append("files", file)
    }
    if (group) {
      formData.append("group", group)
    }

    const result = await adminPost<UploadMarkdownEmojiFilesData>(
      "/api/admin/site-settings/markdown-emoji/upload",
      formData,
      {
        validateData: isUploadMarkdownEmojiFilesData,
        defaultSuccessMessage: "上传完成",
        defaultErrorMessage: "上传失败",
      },
    )

    return {
      ok: true as const,
      message: result.message,
      data: result.data,
    }
  } catch (error) {
    return {
      ok: false as const,
      message: getAdminClientErrorMessage(error, "上传失败"),
    }
  }
}

export async function uploadAdminWatermarkLogoFile(file: File) {
  try {
    const formData = new FormData()
    formData.append("file", file)

    const result = await adminPost<UploadAdminImageData>(
      "/api/admin/site-settings/watermark-logo-upload",
      formData,
      {
        validateData: isUploadAdminImageData,
        defaultSuccessMessage: "上传成功",
        defaultErrorMessage: "上传失败",
      },
    )

    return {
      ok: true as const,
      message: result.message,
      data: result.data,
    }
  } catch (error) {
    return {
      ok: false as const,
      message: getAdminClientErrorMessage(error, "上传失败"),
    }
  }
}

export async function uploadAdminWatermarkFontFile(file: File, label?: string) {
  try {
    const formData = new FormData()
    formData.append("file", file)
    if (label?.trim()) {
      formData.append("label", label.trim())
    }

    const result = await adminPost<UploadAdminWatermarkFontData>(
      "/api/admin/site-settings/watermark-font-upload",
      formData,
      {
        validateData: isUploadAdminWatermarkFontData,
        defaultSuccessMessage: "上传成功",
        defaultErrorMessage: "上传失败",
      },
    )

    return {
      ok: true as const,
      message: result.message,
      data: result.data,
    }
  } catch (error) {
    return {
      ok: false as const,
      message: getAdminClientErrorMessage(error, "上传失败"),
    }
  }
}
