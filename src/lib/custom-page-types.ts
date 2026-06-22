export const BUILTIN_CUSTOM_PAGE_ROUTE_PATHS = ["/about", "/terms"] as const

const BUILTIN_CUSTOM_PAGE_ROUTE_PATH_SET = new Set<string>(BUILTIN_CUSTOM_PAGE_ROUTE_PATHS)

const CUSTOM_PAGE_RESERVED_TOP_LEVEL_SEGMENTS = new Set([
  "_addons",
  "about",
  "addons",
  "admin",
  "announcements",
  "api",
  "auth",
  "badges",
  "boards",
  "collections",
  "faq",
  "feed",
  "following",
  "forgot-password",
  "funs",
  "help",
  "history",
  "hot",
  "latest",
  "leaderboards",
  "level",
  "link",
  "login",
  "messages",
  "new",
  "notifications",
  "posts",
  "prison",
  "register",
  "robots.txt",
  "rss.xml",
  "search",
  "settings",
  "sitemap.xml",
  "tags",
  "terms",
  "topup",
  "universe",
  "uploads",
  "users",
  "vip",
  "write",
  "zones",
  "_next",
]) as ReadonlySet<string>

function normalizeRouteSegment(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function decodeRouteSegment(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function normalizeCustomPageRoutePath(value: unknown) {
  const rawValue = String(value ?? "")
    .trim()
    .split(/[?#]/, 1)[0]
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")

  if (!rawValue) {
    return ""
  }

  const segments = rawValue
    .split("/")
    .map((segment) => normalizeRouteSegment(segment))
    .filter(Boolean)

  if (segments.length === 0) {
    return ""
  }

  return `/${segments.join("/")}`.slice(0, 161)
}

export function resolveCustomPageRoutePathFromSegments(segments?: string[]) {
  if (!segments?.length) {
    return ""
  }

  return normalizeCustomPageRoutePath(
    segments
      .map((segment) => decodeRouteSegment(String(segment)))
      .join("/"),
  )
}

export function getCustomPageRoutePreview(path: unknown) {
  return normalizeCustomPageRoutePath(path) || "/"
}

export function isReservedCustomPageRoutePath(routePath: string) {
  const normalized = normalizeCustomPageRoutePath(routePath)
  if (!normalized) {
    return true
  }

  const [topLevelSegment] = normalized.slice(1).split("/", 1)
  return CUSTOM_PAGE_RESERVED_TOP_LEVEL_SEGMENTS.has(topLevelSegment)
}

export function isBuiltinCustomPageRoutePath(routePath: string) {
  const normalized = normalizeCustomPageRoutePath(routePath)
  return BUILTIN_CUSTOM_PAGE_ROUTE_PATH_SET.has(normalized)
}

export function stripCustomPageHtmlToText(html: string, maxLength = 180) {
  const text = String(html ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()

  return text.slice(0, maxLength)
}

export { CUSTOM_PAGE_RESERVED_TOP_LEVEL_SEGMENTS }
