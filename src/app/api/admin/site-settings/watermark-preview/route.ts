import { createAdminRouteHandler } from "@/lib/api-route"
import { createWatermarkPreviewImageBuffer } from "@/lib/watermark-lib.server"
import { WATERMARK_TEXT_MAX_LENGTH } from "@/lib/watermark-lib"
import type { ImageWatermarkPosition } from "@/lib/site-settings-app-state"
import { getSiteSettings } from "@/lib/site-settings"
import { resolveWatermarkLogoBuffer } from "@/lib/watermark-logo.server"

const WATERMARK_POSITIONS: ImageWatermarkPosition[] = ["TOP_LEFT", "TOP_RIGHT", "BOTTOM_LEFT", "BOTTOM_RIGHT", "CENTER"]

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseBoolean(value: string | null, fallback: boolean) {
  if (value === null) {
    return fallback
  }

  return value === "1" || value.toLowerCase() === "true"
}

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parsePosition(value: string | null, fallback: ImageWatermarkPosition) {
  if (value && WATERMARK_POSITIONS.includes(value as ImageWatermarkPosition)) {
    return value as ImageWatermarkPosition
  }

  return fallback
}

export const GET = createAdminRouteHandler(async ({ request }) => {
  const searchParams = new URL(request.url).searchParams
  const settings = await getSiteSettings()
  const rawText = searchParams.get("text") ?? ""
  // Defense in depth: cap text length at the route entry so a crafted URL
  // cannot drive watermark layout into super-linear CPU work.
  const boundedText = rawText.length > WATERMARK_TEXT_MAX_LENGTH
    ? rawText.slice(0, WATERMARK_TEXT_MAX_LENGTH)
    : rawText
  const logoPath = searchParams.get("logoPath") ?? ""
  const pngBuffer = await createWatermarkPreviewImageBuffer({
    enabled: parseBoolean(searchParams.get("enabled"), true),
    textEnabled: parseBoolean(searchParams.get("textEnabled"), true),
    text: boundedText,
    position: parsePosition(searchParams.get("textPosition") ?? searchParams.get("position"), "BOTTOM_RIGHT"),
    tiled: parseBoolean(searchParams.get("textTiled") ?? searchParams.get("tiled"), false),
    opacity: parseNumber(searchParams.get("textOpacity") ?? searchParams.get("opacity"), 22),
    fontAssets: settings.imageWatermarkFontAssets,
    fontSize: parseNumber(searchParams.get("textFontSize") ?? searchParams.get("fontSize"), 24),
    fontFamily: searchParams.get("textFontFamily") ?? searchParams.get("fontFamily") ?? "",
    logo: {
      enabled: parseBoolean(searchParams.get("logoEnabled"), true),
      buffer: await resolveWatermarkLogoBuffer({
        logoPath,
        uploadLocalPath: settings.uploadLocalPath,
      }),
      margin: parseNumber(searchParams.get("logoMargin"), 24),
      opacity: parseNumber(searchParams.get("logoOpacity"), 22),
      position: parsePosition(searchParams.get("logoPosition"), "BOTTOM_LEFT"),
      scalePercent: parseNumber(searchParams.get("logoScalePercent"), 16),
      tiled: parseBoolean(searchParams.get("logoTiled"), false),
    },
    logoBuffer: null,
    logoScalePercent: parseNumber(searchParams.get("logoScalePercent"), 16),
    margin: parseNumber(searchParams.get("textMargin") ?? searchParams.get("margin"), 24),
    color: searchParams.get("textColor") ?? searchParams.get("color") ?? "#FFFFFF",
    uploadLocalPath: settings.uploadLocalPath,
  })

  return new Response(new Uint8Array(pngBuffer), {
    headers: {
      "Cache-Control": "private, no-store, no-cache, max-age=0",
      "Content-Type": "image/png",
    },
  })
}, {
  errorMessage: "生成水印预览失败",
  logPrefix: "[api/admin/site-settings/watermark-preview] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.operations.manage",
})
