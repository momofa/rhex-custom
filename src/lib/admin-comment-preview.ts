const MEDIA_MARKER_PATTERN = /\bMEDIA::(video|audio|iframe)::([^\s<>()\]]+)/gi
const MARKDOWN_IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const HTML_TAG_PATTERN = /<[^>]+>/g
const URL_PATTERN = /\bhttps?:\/\/[^\s<>()\]]+/gi

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

export function formatAdminCommentPreview(content: string) {
  const normalized = normalizeWhitespace(content)
    .replace(MEDIA_MARKER_PATTERN, (_match, type: string) => {
      if (type === "audio") {
        return "[音频]"
      }

      if (type === "iframe") {
        return "[嵌入内容]"
      }

      return "[视频]"
    })
    .replace(MARKDOWN_IMAGE_PATTERN, (_match, alt: string) => `[图片${alt ? `: ${alt}` : ""}]`)
    .replace(MARKDOWN_LINK_PATTERN, (_match, label: string) => label)
    .replace(HTML_TAG_PATTERN, " ")
    .replace(URL_PATTERN, "[链接]")

  return normalizeWhitespace(normalized) || "无评论内容"
}
