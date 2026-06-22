import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const FRIEND_LINK_VERIFY_ACCEPT_HEADER = "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5,*/*;q=0.1"
const FRIEND_LINK_VERIFY_USER_AGENT = "Rhex FriendLink Verifier/1.0"
const FRIEND_LINK_VERIFY_TIMEOUT_MS = 8_000
const FRIEND_LINK_VERIFY_MAX_RESPONSE_BYTES = 1_048_576
const FRIEND_LINK_VERIFY_MAX_REDIRECTS = 3

function isPrivateIpv4(ip: string) {
  const [a = 0, b = 0] = ip.split(".").map((item) => Number(item))

  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a >= 224) return true

  return false
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase()

  if (normalized === "::1" || normalized === "::") return true
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true

  return false
}

async function assertSafeOutboundUrl(rawUrl: string) {
  const url = new URL(rawUrl)

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("仅允许抓取 http 或 https 地址")
  }

  if (url.username || url.password) {
    throw new Error("抓取地址不允许包含账号密码")
  }

  const hostname = url.hostname.trim().toLowerCase()
  if (!hostname) {
    throw new Error("抓取地址缺少主机名")
  }

  if (hostname === "localhost" || hostname.endsWith(".local")) {
    throw new Error("禁止抓取本地或局域网地址")
  }

  const ipVersion = isIP(hostname)
  if (ipVersion === 4) {
    if (isPrivateIpv4(hostname)) {
      throw new Error("禁止抓取内网 IPv4 地址")
    }
    return
  }

  if (ipVersion === 6) {
    if (isPrivateIpv6(hostname)) {
      throw new Error("禁止抓取内网 IPv6 地址")
    }
    return
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true })
  if (addresses.length === 0) {
    throw new Error("主机名解析失败")
  }

  for (const address of addresses) {
    if ((address.family === 4 && isPrivateIpv4(address.address)) || (address.family === 6 && isPrivateIpv6(address.address))) {
      throw new Error("目标主机解析到了内网地址，已拒绝访问")
    }
  }
}

async function readResponseText(response: Response, maxResponseBytes: number) {
  const reader = response.body?.getReader()
  if (!reader) {
    return ""
  }

  let total = 0
  let body = ""
  const decoder = new TextDecoder()

  while (true) {
    const chunk = await reader.read()
    if (chunk.done) {
      break
    }

    total += chunk.value.byteLength
    if (total > maxResponseBytes) {
      throw new Error(`响应体超过上限 ${maxResponseBytes} 字节`)
    }

    body += decoder.decode(chunk.value, { stream: true })
  }

  body += decoder.decode()
  return body
}

function normalizeComparableHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/^www\./, "")
}

function decodeHtmlAttributeValue(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .trim()
}

export function hrefPointsToSite(href: string, pageUrl: string, siteOrigin: string) {
  const normalizedHref = decodeHtmlAttributeValue(href)
  if (!normalizedHref || normalizedHref.startsWith("#")) {
    return false
  }

  if (/^(javascript|mailto|tel):/i.test(normalizedHref)) {
    return false
  }

  let resolvedHref: URL
  let resolvedSiteOrigin: URL

  try {
    resolvedHref = new URL(normalizedHref, pageUrl)
    resolvedSiteOrigin = new URL(siteOrigin)
  } catch {
    return false
  }

  if (!["http:", "https:"].includes(resolvedHref.protocol)) {
    return false
  }

  return normalizeComparableHostname(resolvedHref.hostname) === normalizeComparableHostname(resolvedSiteOrigin.hostname)
}

export function pageContainsSiteLink(html: string, pageUrl: string, siteOrigin: string) {
  const anchorHrefPattern = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi

  for (const match of html.matchAll(anchorHrefPattern)) {
    const href = match[1] ?? match[2] ?? match[3] ?? ""
    if (hrefPointsToSite(href, pageUrl, siteOrigin)) {
      return true
    }
  }

  return false
}

async function fetchPlacementPage(pageUrl: string) {
  let currentUrl = pageUrl

  for (let redirectCount = 0; redirectCount <= FRIEND_LINK_VERIFY_MAX_REDIRECTS; redirectCount += 1) {
    await assertSafeOutboundUrl(currentUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FRIEND_LINK_VERIFY_TIMEOUT_MS)

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: FRIEND_LINK_VERIFY_ACCEPT_HEADER,
          "User-Agent": FRIEND_LINK_VERIFY_USER_AGENT,
        },
      })

      const status = response.status
      const location = response.headers.get("location")

      if (status >= 300 && status < 400) {
        if (!location) {
          throw new Error(`收到 ${status} 重定向但缺少 Location`)
        }

        currentUrl = new URL(location, currentUrl).toString()
        continue
      }

      if (!response.ok) {
        throw new Error(`抓取失败，HTTP ${status}`)
      }

      return {
        finalUrl: currentUrl,
        html: await readResponseText(response, FRIEND_LINK_VERIFY_MAX_RESPONSE_BYTES),
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw new Error(`重定向次数超过上限 ${FRIEND_LINK_VERIFY_MAX_REDIRECTS}`)
}

export interface FriendLinkPlacementReviewResult {
  autoApproved: boolean
  matched: boolean
  reviewNote: string
}

export async function reviewFriendLinkPlacement(pageUrl: string, siteOrigin: string): Promise<FriendLinkPlacementReviewResult> {
  try {
    const { finalUrl, html } = await fetchPlacementPage(pageUrl)
    const matched = pageContainsSiteLink(html, finalUrl, siteOrigin)

    if (matched) {
      return {
        autoApproved: true,
        matched: true,
        reviewNote: "系统自动审核通过：已检测到本站链接。",
      }
    }

    return {
      autoApproved: false,
      matched: false,
      reviewNote: "系统自动检查未发现本站链接，已转人工审核。",
    }
  } catch (error) {
    console.warn("[friend-links] auto review skipped", error)

    return {
      autoApproved: false,
      matched: false,
      reviewNote: "系统自动检查失败，已转人工审核。",
    }
  }
}
