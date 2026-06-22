import path from "path"

import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"

export const MARKDOWN_EMOJI_UPLOAD_FOLDER = "emoji"
export const MARKDOWN_EMOJI_UPLOAD_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"] as const
export const MARKDOWN_EMOJI_UPLOAD_MAX_FILES = 100

const MARKDOWN_EMOJI_UPLOAD_IMAGE_EXTENSION_SET = new Set<string>(MARKDOWN_EMOJI_UPLOAD_IMAGE_EXTENSIONS)

export function isMarkdownEmojiUploadImageFile(fileName: string) {
  const extension = path.extname(fileName).replace(/^\./, "").toLowerCase()
  return MARKDOWN_EMOJI_UPLOAD_IMAGE_EXTENSION_SET.has(extension)
}

function normalizeEmojiUploadBaseName(fileName: string) {
  return path.basename(fileName, path.extname(fileName)).trim()
}

function normalizeEmojiUploadLabel(fileName: string) {
  return normalizeEmojiUploadBaseName(fileName).replace(/[_-]+/g, " ").trim() || "表情"
}

function normalizeEmojiUploadShortcodeBase(fileName: string) {
  const normalized = normalizeEmojiUploadBaseName(fileName)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .replace(/[_-]{2,}/g, "_")
    .toLowerCase()

  const startsWithLetterOrDigit = /^[a-z0-9]/.test(normalized)
  const shortcode = startsWithLetterOrDigit ? normalized : `emoji_${normalized}`

  return shortcode.replace(/^[_-]+|[_-]+$/g, "").slice(0, 32) || "emoji"
}

export function buildUniqueMarkdownEmojiUploadShortcode(fileName: string, usedShortcodes: Set<string>, fallbackIndex: number) {
  const base = normalizeEmojiUploadShortcodeBase(fileName) || `emoji_${fallbackIndex + 1}`
  let candidate = base
  let suffix = 2

  while (usedShortcodes.has(candidate)) {
    const suffixText = `_${suffix}`
    candidate = `${base.slice(0, Math.max(1, 32 - suffixText.length))}${suffixText}`
    suffix += 1
  }

  usedShortcodes.add(candidate)
  return candidate
}

export function buildMarkdownEmojiUploadItem(
  fileName: string,
  icon: string,
  usedShortcodes: Set<string>,
  fallbackIndex: number,
  group?: string,
): MarkdownEmojiItem {
  return {
    shortcode: buildUniqueMarkdownEmojiUploadShortcode(fileName, usedShortcodes, fallbackIndex),
    label: normalizeEmojiUploadLabel(fileName),
    icon,
    ...(group ? { group } : {}),
  }
}
