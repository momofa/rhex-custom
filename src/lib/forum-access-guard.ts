const FORUM_CONTENT_EXACT_PATHS = new Set([
  "/",
  "/latest",
  "/new",
  "/hot",
  "/feed",
  "/following",
  "/replied",
  "/history",
  "/search",
  "/universe",
  "/tags",
  "/collections",
])

const FORUM_CONTENT_PREFIXES = [
  "/latest/page/",
  "/new/page/",
  "/hot/page/",
  "/feed/",
  "/posts/",
  "/boards/",
  "/zones/",
  "/tags/",
  "/users/",
  "/collections/",
] as const

export function isForumContentPath(pathname: string) {
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`

  if (FORUM_CONTENT_EXACT_PATHS.has(normalizedPathname)) {
    return true
  }

  return FORUM_CONTENT_PREFIXES.some((prefix) => normalizedPathname.startsWith(prefix))
}
