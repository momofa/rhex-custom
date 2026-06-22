export type MarkdownLinkHintKind = "external-site" | "mailto" | "tel"

export interface MarkdownLinkHint {
  kind: MarkdownLinkHintKind
  title: string
  description: string
  detail?: string
  footnote: string
  ariaLabelSuffix: string
}

function getMarkdownLinkBaseOrigin(baseOrigin?: string) {
  if (baseOrigin?.trim()) {
    return baseOrigin
  }

  if (typeof window !== "undefined") {
    return window.location.origin
  }

  return "https://bbs.invalid"
}

function decodeLinkDetail(value: string) {
  const normalizedValue = value.trim()
  if (!normalizedValue) {
    return ""
  }

  try {
    return decodeURIComponent(normalizedValue)
  } catch {
    return normalizedValue
  }
}

export function getMarkdownLinkHint(href: string, baseOrigin?: string): MarkdownLinkHint | null {
  const normalizedHref = href.trim()
  if (!normalizedHref) {
    return null
  }

  if (/^mailto:/i.test(normalizedHref)) {
    const address = decodeLinkDetail(normalizedHref.slice("mailto:".length).split("?")[0] ?? "")
    return {
      kind: "mailto",
      title: "邮件链接",
      description: "将尝试打开你的默认邮件应用来发送邮件。",
      detail: address || undefined,
      footnote: "发送前请确认收件地址和内容。",
      ariaLabelSuffix: "邮件链接",
    }
  }

  if (/^tel:/i.test(normalizedHref)) {
    const phoneNumber = decodeLinkDetail(normalizedHref.slice("tel:".length).split("?")[0] ?? "")
    return {
      kind: "tel",
      title: "电话链接",
      description: "将尝试调起当前设备的拨号能力。",
      detail: phoneNumber || undefined,
      footnote: "拨出前请确认号码无误。",
      ariaLabelSuffix: "电话链接",
    }
  }

  const resolvedBaseOrigin = getMarkdownLinkBaseOrigin(baseOrigin)

  try {
    const resolvedUrl = new URL(normalizedHref, resolvedBaseOrigin)
    if (!["http:", "https:"].includes(resolvedUrl.protocol)) {
      return null
    }

    if (resolvedUrl.origin === resolvedBaseOrigin) {
      return null
    }

    return {
      kind: "external-site",
      title: "外部站点",
      description: "即将离开本站，请确认目标域名可信后再继续访问。",
      detail: resolvedUrl.host || resolvedUrl.origin,
      footnote: "该链接会在新标签页打开。",
      ariaLabelSuffix: "外部站点链接，将在新标签页打开",
    }
  } catch {
    return null
  }
}

export function buildMarkdownLinkAriaLabel(textContent: string | null | undefined, hint: MarkdownLinkHint) {
  const normalizedText = textContent?.trim() || hint.title
  return `${normalizedText}（${hint.ariaLabelSuffix}）`
}
