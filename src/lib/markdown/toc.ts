export interface MarkdownHeadingItem {
  id: string
  text: string
  level: number
}

const HEADING_PATTERN = /<h([1-6])\b([^>]*)\bid="([^"]+)"([^>]*)>([\s\S]*?)<\/h\1>/gi
const HEADING_ANCHOR_PATTERN = /<a\b[^>]*\bclass="[^"]*\bmd-heading-anchor\b[^"]*"[^>]*>[\s\S]*?<\/a>/gi

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&#(\d+);/g, (_matched, rawValue: string) => {
      const value = Number.parseInt(rawValue, 10)
      return Number.isFinite(value) ? String.fromCodePoint(value) : _matched
    })
    .replace(/&#x([0-9a-f]+);/gi, (_matched, rawValue: string) => {
      const value = Number.parseInt(rawValue, 16)
      return Number.isFinite(value) ? String.fromCodePoint(value) : _matched
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
}

function stripHeadingHtml(input: string) {
  return decodeHtmlEntities(
    input
      .replace(HEADING_ANCHOR_PATTERN, "")
      .replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, "")
      .replace(/<rp\b[^>]*>[\s\S]*?<\/rp>/gi, "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
}

function replaceHashLinks(html: string, idMap: Map<string, string>) {
  if (idMap.size === 0) {
    return html
  }

  return html.replace(/href=(['"])#([^'"]+)\1/gi, (matched, quote: string, rawId: string) => {
    const normalized = idMap.get(rawId)
    return normalized ? `href=${quote}#${normalized}${quote}` : matched
  })
}

export function extractMarkdownHeadingsFromHtml(html: string) {
  const items: MarkdownHeadingItem[] = []

  for (const match of html.matchAll(HEADING_PATTERN)) {
    const level = Number.parseInt(match[1] ?? "", 10)
    const id = (match[3] ?? "").trim()
    const text = stripHeadingHtml(match[5] ?? "")

    if (!id || !text || Number.isNaN(level)) {
      continue
    }

    items.push({ id, text, level })
  }

  return items
}

export function normalizeRenderedMarkdownHtmlHeadings(
  html: string,
  usedHeadingIds: Map<string, number>,
) {
  if (!html) {
    return { html, headings: [] as MarkdownHeadingItem[] }
  }

  const idMap = new Map<string, string>()
  const headings: MarkdownHeadingItem[] = []

  const normalizedHtml = html.replace(
    HEADING_PATTERN,
    (
      matched,
      rawLevel: string,
      beforeIdAttributes: string,
      rawId: string,
      afterIdAttributes: string,
      innerHtml: string,
    ) => {
      const level = Number.parseInt(rawLevel, 10)
      const id = rawId.trim()
      const text = stripHeadingHtml(innerHtml)

      if (!id || Number.isNaN(level)) {
        return matched
      }

      const seen = usedHeadingIds.get(id) ?? 0
      usedHeadingIds.set(id, seen + 1)
      const normalizedId = seen === 0 ? id : `${id}-${seen}`

      idMap.set(id, normalizedId)

      if (text) {
        headings.push({
          id: normalizedId,
          text,
          level,
        })
      }

      return `<h${rawLevel}${beforeIdAttributes}id="${normalizedId}"${afterIdAttributes}>${innerHtml}</h${rawLevel}>`
    },
  )

  return {
    html: replaceHashLinks(normalizedHtml, idMap),
    headings,
  }
}
