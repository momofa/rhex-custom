import {
  AUDIO_EXTENSIONS,
  isSupportedMarkdownEmbedSrc,
  normalizeMarkdownMediaSrc,
  VIDEO_EXTENSIONS,
} from "@/lib/markdown/media"

export type PostListPreviewMedia = {
  type: "image" | "video" | "audio" | "embed"
  src: string
}

type MarkdownSourceInput = string | null | undefined

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".svg"]
const EXPLICIT_MEDIA_PATTERN = /MEDIA::(video|audio|iframe)::([^\n\r]+)/gi
const HTML_MEDIA_PATTERN = /<(video|audio|iframe)\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi
const HTML_IMAGE_PATTERN = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*]\((?:<)?([^)\s>]+)(?:[^)]*)\)/g
const MARKDOWN_LINK_PATTERN = /(?<!!)\[[^\]]+]\((?:<)?([^)\s>]+)(?:[^)]*)\)/g
const URL_PATTERN = /(?:https?:)?\/\/[^\s<>()"']+/g

function normalizeMarkdownSource(input: MarkdownSourceInput) {
  return typeof input === "string" ? input : ""
}

function normalizeSafeSrc(input: string) {
  const value = input.trim()
  if (!value || /^javascript:/i.test(value) || /^data:/i.test(value)) {
    return null
  }

  return value.startsWith("//") ? `https:${value}` : value
}

function normalizeComparableSrc(input: string) {
  const safeSrc = normalizeSafeSrc(input)
  if (!safeSrc) {
    return null
  }

  try {
    const url = new URL(safeSrc, "https://local.invalid")
    return `${url.hostname}${url.pathname}${url.search}${url.hash}`
  } catch {
    return safeSrc
  }
}

function isSamePreviewSrc(input: string, previewSrc: string) {
  const left = normalizeComparableSrc(input)
  const right = normalizeComparableSrc(previewSrc)

  return Boolean(left && right && left === right)
}

function hasExtension(input: string, extensions: string[]) {
  const safeSrc = normalizeSafeSrc(input)
  if (!safeSrc) {
    return false
  }

  const pathname = (() => {
    try {
      return new URL(safeSrc, "https://local.invalid").pathname
    } catch {
      return safeSrc.split(/[?#]/, 1)[0] ?? safeSrc
    }
  })().toLowerCase()

  return extensions.some((extension) => pathname.endsWith(extension))
}

function resolveDirectMedia(input: string): PostListPreviewMedia | null {
  const src = normalizeSafeSrc(input)
  if (!src) {
    return null
  }

  if (hasExtension(src, AUDIO_EXTENSIONS)) {
    return { type: "audio", src }
  }

  if (hasExtension(src, VIDEO_EXTENSIONS)) {
    return { type: "video", src }
  }

  if (isSupportedMarkdownEmbedSrc(src)) {
    const normalizedEmbedSrc = normalizeMarkdownMediaSrc(src)
    return normalizedEmbedSrc ? { type: "embed", src: normalizedEmbedSrc } : null
  }

  if (hasExtension(src, IMAGE_EXTENSIONS)) {
    return { type: "image", src }
  }

  return null
}

function resolveExplicitMedia(type: string, input: string): PostListPreviewMedia | null {
  const src = normalizeSafeSrc(input)
  if (!src) {
    return null
  }

  if (type.toLowerCase() === "iframe") {
    const normalizedEmbedSrc = normalizeMarkdownMediaSrc(src)
    return normalizedEmbedSrc && isSupportedMarkdownEmbedSrc(normalizedEmbedSrc)
      ? { type: "embed", src: normalizedEmbedSrc }
      : null
  }

  return type.toLowerCase() === "audio"
    ? { type: "audio", src }
    : { type: "video", src }
}

export function resolvePostListPreviewMedia(contentMarkdown: MarkdownSourceInput, fallbackImage?: string | null): PostListPreviewMedia | null {
  const markdown = normalizeMarkdownSource(contentMarkdown)
  const candidates: Array<PostListPreviewMedia & { index: number }> = []

  for (const match of markdown.matchAll(EXPLICIT_MEDIA_PATTERN)) {
    const media = resolveExplicitMedia(match[1] ?? "", match[2] ?? "")
    if (media) {
      candidates.push({ ...media, index: match.index ?? Number.MAX_SAFE_INTEGER })
    }
  }

  for (const match of markdown.matchAll(HTML_MEDIA_PATTERN)) {
    const media = resolveExplicitMedia(match[1] ?? "", match[2] ?? "")
    if (media) {
      candidates.push({ ...media, index: match.index ?? Number.MAX_SAFE_INTEGER })
    }
  }

  for (const match of markdown.matchAll(HTML_IMAGE_PATTERN)) {
    const src = normalizeSafeSrc(match[1] ?? "")
    if (src) {
      candidates.push({ type: "image", src, index: match.index ?? Number.MAX_SAFE_INTEGER })
    }
  }

  for (const match of markdown.matchAll(MARKDOWN_IMAGE_PATTERN)) {
    const src = normalizeSafeSrc(match[1] ?? "")
    if (src) {
      candidates.push({ type: "image", src, index: match.index ?? Number.MAX_SAFE_INTEGER })
    }
  }

  for (const match of markdown.matchAll(MARKDOWN_LINK_PATTERN)) {
    const media = resolveDirectMedia(match[1] ?? "")
    if (media) {
      candidates.push({ ...media, index: match.index ?? Number.MAX_SAFE_INTEGER })
    }
  }

  for (const match of markdown.matchAll(URL_PATTERN)) {
    const media = resolveDirectMedia(match[0] ?? "")
    if (media) {
      candidates.push({ ...media, index: match.index ?? Number.MAX_SAFE_INTEGER })
    }
  }

  const [firstContentMedia] = candidates.sort((left, right) => left.index - right.index)
  if (firstContentMedia) {
    return {
      type: firstContentMedia.type,
      src: firstContentMedia.src,
    }
  }

  const fallbackSrc = normalizeSafeSrc(fallbackImage ?? "")
  return fallbackSrc ? { type: "image", src: fallbackSrc } : null
}

function removeMatchBySrc(input: string, pattern: RegExp, previewSrc: string, srcGroupIndex: number) {
  for (const match of input.matchAll(pattern)) {
    const src = match[srcGroupIndex]
    if (!src || !isSamePreviewSrc(src, previewSrc)) {
      continue
    }

    const start = match.index ?? -1
    if (start < 0) {
      continue
    }

    const end = start + match[0].length
    return `${input.slice(0, start)}${input.slice(end)}`
  }

  return input
}

function normalizePreviewMarkdown(input: string) {
  return input
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function omitPostListPreviewMediaFromMarkdown(contentMarkdown: MarkdownSourceInput, previewMedia?: PostListPreviewMedia | null) {
  const markdown = normalizeMarkdownSource(contentMarkdown)

  if (!previewMedia?.src) {
    return markdown
  }

  const type = previewMedia.type === "embed" ? "iframe" : previewMedia.type
  const explicitMediaPattern = new RegExp(`^[ \\t]*MEDIA::${type}::([^\\n\\r]+)[ \\t]*$`, "gim")
  let nextContent = removeMatchBySrc(markdown, explicitMediaPattern, previewMedia.src, 1)

  if (previewMedia.type === "embed" || previewMedia.type === "video" || previewMedia.type === "audio") {
    nextContent = removeMatchBySrc(nextContent, HTML_MEDIA_PATTERN, previewMedia.src, 2)
    nextContent = removeMatchBySrc(nextContent, MARKDOWN_LINK_PATTERN, previewMedia.src, 1)
    nextContent = removeMatchBySrc(nextContent, URL_PATTERN, previewMedia.src, 0)
  }

  if (previewMedia.type === "image") {
    nextContent = removeMatchBySrc(nextContent, HTML_IMAGE_PATTERN, previewMedia.src, 1)
    nextContent = removeMatchBySrc(nextContent, MARKDOWN_IMAGE_PATTERN, previewMedia.src, 1)
    nextContent = removeMatchBySrc(nextContent, URL_PATTERN, previewMedia.src, 0)
  }

  return normalizePreviewMarkdown(nextContent)
}
