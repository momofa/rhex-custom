import { NextResponse, type NextRequest } from "next/server"

import { buildUnauthorizedResponse, getSessionFromRequest, isProtectedPath } from "@/lib/auth-guards"
import { isForumContentPath } from "@/lib/forum-access-guard"
import { buildHomeFeedHref, normalizeHomeFeedSort, parseHomeFeedPage, type HomeFeedSort } from "@/lib/home-feed-route"
import { RHEX_PATHNAME_HEADER } from "@/lib/request-context-headers"
import { getSessionClearedCookieOptions, getSessionCookieName } from "@/lib/session"
import { getServerSiteSettings } from "@/lib/site-settings"

const PATH_HOME_FEED_SORTS: Record<string, HomeFeedSort> = {
  "/latest": "latest",
  "/new": "new",
  "/hot": "hot",
}

function redirectLegacyHomeFeedPageQuery(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return null
  }

  const rootPath = request.nextUrl.pathname === "/"
  const rawSort = request.nextUrl.searchParams.get("sort")
  const rawPage = request.nextUrl.searchParams.get("page")
  const sort = PATH_HOME_FEED_SORTS[request.nextUrl.pathname]
    ?? (rootPath && (rawSort !== null || rawPage !== null)
      ? normalizeHomeFeedSort(rawSort ?? undefined)
      : null)
  if (!sort || (rawPage === null && rawSort === null)) {
    return null
  }

  const url = request.nextUrl.clone()
  url.pathname = buildHomeFeedHref(sort, parseHomeFeedPage(rawPage ?? undefined))
  url.search = ""

  return NextResponse.redirect(url)
}

function nextWithRequestContext(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(RHEX_PATHNAME_HEADER, request.nextUrl.pathname)

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

async function isForumBrowseProtectedPath(pathname: string) {
  if (!isForumContentPath(pathname)) {
    return false
  }

  try {
    const settings = await getServerSiteSettings()
    return settings.forumRequireLoginToBrowse
  } catch {
    return false
  }
}

export async function proxy(request: NextRequest) {
  const legacyHomeFeedRedirect = redirectLegacyHomeFeedPageQuery(request)
  if (legacyHomeFeedRedirect) {
    return legacyHomeFeedRedirect
  }

  const token = request.cookies.get(getSessionCookieName())?.value
  const protectedPath = isProtectedPath(request.nextUrl.pathname)
    || await isForumBrowseProtectedPath(request.nextUrl.pathname)

  if (!protectedPath) {
    return nextWithRequestContext(request)
  }

  if (!token) {
    return buildUnauthorizedResponse(request)
  }

  const session = await getSessionFromRequest(request)
  if (session) {
    return nextWithRequestContext(request)
  }

  if (protectedPath) {
    const response = buildUnauthorizedResponse(request)
    response.cookies.set(getSessionCookieName(), "", getSessionClearedCookieOptions({ request }))
    return response
  }

  const response = nextWithRequestContext(request)
  response.cookies.set(getSessionCookieName(), "", getSessionClearedCookieOptions({ request }))
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
}
