import type { ImageWatermarkPosition } from "@/lib/site-settings-app-state.types"

export type WatermarkRgbColor = {
  red: number
  green: number
  blue: number
}

export type WatermarkRenderPresentation = {
  color: string
  colorRgb: WatermarkRgbColor
  fontFamily: string
  fontSize: number
  letterSpacing: number
  lineHeight: number
  margin: number
  maxTextWidth: number
  opacityRatio: number
  shadowBlur: number
  shadowColor: string
  shadowOffsetX: number
  shadowOffsetY: number
  text: string
}

export type WatermarkFontAsset = {
  id: string
  label: string
  fileName: string
  fontFamily: string
  urlPath: string
}

export const WATERMARK_FONT_ALIAS = "BBS Watermark"
export const WATERMARK_HANDWRITING_FONT_FAMILY = `"${WATERMARK_FONT_ALIAS}", cursive`
export const WATERMARK_DEFAULT_FONT_FAMILY = `${WATERMARK_HANDWRITING_FONT_FAMILY}, sans-serif`
export const WATERMARK_FONT_UPLOAD_FOLDER = "watermark-fonts"
export const WATERMARK_CUSTOM_FONT_ALIAS_PREFIX = "BBS Watermark Custom"
export const WATERMARK_BUILTIN_FONT_ASSETS: WatermarkFontAsset[] = [
  {
    id: "builtin-zhimangxing",
    label: "芝芒行书",
    fileName: "zhi-mang-xing.ttf",
    fontFamily: WATERMARK_HANDWRITING_FONT_FAMILY,
    urlPath: "/fonts/zhi-mang-xing.ttf",
  },
]
export const WATERMARK_PREVIEW_WIDTH = 1280
export const WATERMARK_PREVIEW_HEIGHT = 720

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeHexColorToRgb(hexColor: string): WatermarkRgbColor {
  const fallback: WatermarkRgbColor = { red: 255, green: 255, blue: 255 }

  if (typeof hexColor !== "string") {
    return fallback
  }

  const normalized = hexColor.trim().replace(/^#/, "")
  let expanded: string

  // Self-defensive: only accept canonical 3- or 6-digit hex. Previously any
  // length ≥ 2 was silently accepted, which for 8-digit `#RRGGBBAA` input
  // dropped the alpha channel, and for odd lengths (e.g. 5) could read a
  // misaligned half-byte into the blue channel. Upstream
  // `normalizeWatermarkHexColor` already collapses bad input to `#FFFFFF`,
  // but this helper is exported and must not rely on the caller.
  if (/^[0-9a-f]{3}$/i.test(normalized)) {
    expanded = normalized.split("").map((char) => `${char}${char}`).join("")
  } else if (/^[0-9a-f]{6}$/i.test(normalized)) {
    expanded = normalized
  } else {
    return fallback
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16)
  const green = Number.parseInt(expanded.slice(2, 4), 16)
  const blue = Number.parseInt(expanded.slice(4, 6), 16)

  return {
    red: Number.isFinite(red) ? red : 255,
    green: Number.isFinite(green) ? green : 255,
    blue: Number.isFinite(blue) ? blue : 255,
  }
}

export function normalizeWatermarkHexColor(color: string) {
  const trimmed = color.trim()

  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const expanded = trimmed
      .slice(1)
      .split("")
      .map((char) => `${char}${char}`)
      .join("")

    return `#${expanded.toUpperCase()}`
  }

  return "#FFFFFF"
}

export const WATERMARK_TEXT_MAX_LENGTH = 400
export const WATERMARK_TEXT_MAX_LINES = 6

export function normalizeWatermarkFontAssetId(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""
  return /^[a-z0-9][a-z0-9_-]{2,63}$/.test(normalized) ? normalized : ""
}

export function normalizeWatermarkFontFileName(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : ""
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}\.(?:ttf|otf|ttc)$/i.test(normalized) && !normalized.includes("..")
    ? normalized
    : ""
}

export function normalizeWatermarkFontLabel(value: unknown, fallback = "自定义字体") {
  const normalized = typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, 40)
    : ""

  return normalized || fallback
}

export function buildWatermarkCustomFontFamily(id: string) {
  const normalizedId = normalizeWatermarkFontAssetId(id)
  return normalizedId ? `"${WATERMARK_CUSTOM_FONT_ALIAS_PREFIX} ${normalizedId}", sans-serif` : ""
}

export function normalizeWatermarkFontAsset(value: unknown): WatermarkFontAsset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>
  const id = normalizeWatermarkFontAssetId(candidate.id)
  const fileName = normalizeWatermarkFontFileName(candidate.fileName)

  if (!id || !fileName) {
    return null
  }

  const fontFamily = WATERMARK_BUILTIN_FONT_ASSETS.some((asset) => asset.id === id)
    ? normalizeWatermarkFontFamily(candidate.fontFamily)
    : buildWatermarkCustomFontFamily(id)
  if (!fontFamily) {
    return null
  }

  return {
    id,
    label: normalizeWatermarkFontLabel(candidate.label),
    fileName,
    fontFamily,
    urlPath: typeof candidate.urlPath === "string" ? candidate.urlPath.trim().slice(0, 300) : "",
  }
}

export function normalizeWatermarkFontAssets(value: unknown): WatermarkFontAsset[] {
  if (!Array.isArray(value)) {
    return []
  }

  const assets: WatermarkFontAsset[] = []
  const seenIds = new Set<string>()
  for (const item of value) {
    const asset = normalizeWatermarkFontAsset(item)
    if (!asset || seenIds.has(asset.id)) {
      continue
    }
    assets.push(asset)
    seenIds.add(asset.id)
  }

  return assets.slice(0, 20)
}

export function getAvailableWatermarkFontAssets(customAssets: readonly WatermarkFontAsset[] = []) {
  const assets = [...WATERMARK_BUILTIN_FONT_ASSETS]
  const seenIds = new Set(assets.map((asset) => asset.id))

  for (const asset of customAssets) {
    if (seenIds.has(asset.id)) {
      continue
    }
    assets.push(asset)
    seenIds.add(asset.id)
  }

  return assets
}

export function isKnownWatermarkFontFamily(value: unknown, customAssets: readonly WatermarkFontAsset[] = []) {
  const normalizedValue = normalizeWatermarkFontFamily(value)
  if (!normalizedValue) {
    return true
  }

  return getAvailableWatermarkFontAssets(customAssets)
    .some((asset) => normalizeWatermarkFontFamily(asset.fontFamily) === normalizedValue)
}

export function resolveKnownWatermarkFontFamily(value: unknown, customAssets: readonly WatermarkFontAsset[] = []) {
  const normalizedValue = normalizeWatermarkFontFamily(value)
  if (!normalizedValue) {
    return ""
  }

  return isKnownWatermarkFontFamily(normalizedValue, customAssets) ? normalizedValue : ""
}

export function normalizeWatermarkText(value: string) {
  if (typeof value !== "string") {
    return ""
  }

  // Hard cap BEFORE any heavy string processing to prevent O(n²) DoS in layout.
  const bounded = value.length > WATERMARK_TEXT_MAX_LENGTH
    ? value.slice(0, WATERMARK_TEXT_MAX_LENGTH)
    : value

  return bounded
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, lines) => line.length > 0 || index < lines.length - 1)
    .join("\n")
    .trim()
}

export function normalizeWatermarkFontFamily(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .split(",")
    .map((item) => {
      const family = item
        .replace(/[;\r\n\t(){}\\@]+/g, " ")
        .trim()
        .replace(/^["']+|["']+$/g, "")
        .replace(/\s+/g, " ")

      if (!family || family.length > 80) {
        return ""
      }

      if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace)$/i.test(family)) {
        return family.toLowerCase()
      }

      const escapedFamily = family.replace(/"/g, "")
      return `"${escapedFamily}"`
    })
    .filter(Boolean)
    .join(", ")
    .slice(0, 240)
}

export function resolveWatermarkFontFamily(value: unknown) {
  const customFontFamily = normalizeWatermarkFontFamily(value)

  if (!customFontFamily) {
    return WATERMARK_DEFAULT_FONT_FAMILY
  }

  return `${customFontFamily}, ${WATERMARK_DEFAULT_FONT_FAMILY}`
}

export function resolveWatermarkPresentation(options: {
  color: string
  fontSize: number
  fontFamily?: string
  margin: number
  opacity: number
  text: string
  width: number
}) {
  const normalizedColor = normalizeWatermarkHexColor(options.color || "#FFFFFF")
  const colorRgb = normalizeHexColorToRgb(normalizedColor)
  const fontSize = clamp(Math.round(options.fontSize || 24), 10, 256)
  const margin = clamp(Math.round(options.margin || 24), 0, Math.max(0, Math.floor(options.width / 3)))
  const opacityRatio = clamp(Number.isFinite(options.opacity) ? options.opacity / 100 : 0.22, 0, 1)
  const letterSpacing = Math.max(0, Math.round(fontSize * 0.04))
  const lineHeight = Math.max(fontSize + 8, Math.round(fontSize * 1.28))
  const maxTextWidth = Math.max(96, Math.min(options.width - margin * 2, Math.round(options.width * 0.58)))
  const shadowOffsetX = Math.max(1, Math.round(fontSize * 0.08))
  const shadowOffsetY = Math.max(1, Math.round(fontSize * 0.12))
  const shadowBlur = Math.max(8, Math.round(fontSize * 0.78))

  return {
    color: normalizedColor,
    colorRgb,
    fontFamily: resolveWatermarkFontFamily(options.fontFamily),
    fontSize,
    letterSpacing,
    lineHeight,
    margin,
    maxTextWidth,
    opacityRatio,
    shadowBlur,
    shadowColor: `rgba(15, 23, 42, ${Math.min(0.75, opacityRatio * 0.9).toFixed(3)})`,
    shadowOffsetX,
    shadowOffsetY,
    text: normalizeWatermarkText(options.text),
  } satisfies WatermarkRenderPresentation
}

export function resolveWatermarkPlacement(options: {
  width: number
  height: number
  overlayWidth: number
  overlayHeight: number
  position: ImageWatermarkPosition
  margin: number
}) {
  const { width, height, overlayWidth, overlayHeight, position, margin } = options

  switch (position) {
    case "TOP_LEFT":
      return { x: margin, y: margin }
    case "TOP_RIGHT":
      return { x: Math.max(0, width - overlayWidth - margin), y: margin }
    case "BOTTOM_LEFT":
      return { x: margin, y: Math.max(0, height - overlayHeight - margin) }
    case "CENTER":
      return { x: Math.max(0, Math.round((width - overlayWidth) / 2)), y: Math.max(0, Math.round((height - overlayHeight) / 2)) }
    case "BOTTOM_RIGHT":
    default:
      return { x: Math.max(0, width - overlayWidth - margin), y: Math.max(0, height - overlayHeight - margin) }
  }
}

export function isRightAlignedWatermark(position: ImageWatermarkPosition) {
  return position.endsWith("RIGHT")
}

export function isCenteredWatermark(position: ImageWatermarkPosition) {
  return position === "CENTER"
}
