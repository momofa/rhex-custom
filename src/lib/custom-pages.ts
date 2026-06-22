import { revalidateTag, unstable_cache } from "next/cache"

import { listPublishedCustomPagePathsWithoutFooter, findPublishedCustomPageByRoutePath, type CustomPageRow } from "@/db/custom-page-queries"
import { formatMonthDayTime, serializeDateTime } from "@/lib/formatters"
import { isBuiltinCustomPageRoutePath, stripCustomPageHtmlToText } from "@/lib/custom-page-types"

export const CUSTOM_PAGES_CACHE_TAG = "custom-pages"
export const CUSTOM_PAGE_CACHE_REVALIDATE_SECONDS = 60 * 60

export interface CustomPageItem {
  id: string
  title: string
  routePath: string
  htmlContent: string
  status: string
  includeHeader: boolean
  includeFooter: boolean
  includeLeftSidebar: boolean
  includeRightSidebar: boolean
  isBuiltin: boolean
  createdAt: string
  publishedAt: string | null
  publishedAtText: string | null
  creatorName: string
  summaryText: string
}

function mapCustomPage(item: CustomPageRow): CustomPageItem {
  const publishedAt = serializeDateTime(item.publishedAt)

  return {
    id: item.id,
    title: item.title,
    routePath: item.routePath,
    htmlContent: item.htmlContent,
    status: item.status,
    includeHeader: item.includeHeader,
    includeFooter: item.includeFooter,
    includeLeftSidebar: item.includeLeftSidebar,
    includeRightSidebar: item.includeRightSidebar,
    isBuiltin: isBuiltinCustomPageRoutePath(item.routePath),
    createdAt: serializeDateTime(item.createdAt) ?? item.createdAt.toISOString(),
    publishedAt,
    publishedAtText: publishedAt ? formatMonthDayTime(publishedAt) : null,
    creatorName: item.creator.nickname ?? item.creator.username,
    summaryText: stripCustomPageHtmlToText(item.htmlContent),
  }
}

export async function getPublishedCustomPageByPath(routePath: string) {
  const item = isBuiltinCustomPageRoutePath(routePath)
    ? await findPublishedCustomPageByRoutePath(routePath)
    : await getPersistentPublishedCustomPageByPath(routePath)
  return item ? mapCustomPage(item) : null
}

export async function getPublishedCustomPageFooterHiddenPaths() {
  return getPersistentPublishedCustomPageFooterHiddenPaths()
}

const getPersistentPublishedCustomPageByPath = unstable_cache(
  async (routePath: string) => findPublishedCustomPageByRoutePath(routePath),
  ["custom-pages:published-by-path"],
  {
    tags: [CUSTOM_PAGES_CACHE_TAG],
    revalidate: CUSTOM_PAGE_CACHE_REVALIDATE_SECONDS,
  },
)

const getPersistentPublishedCustomPageFooterHiddenPaths = unstable_cache(
  async () => listPublishedCustomPagePathsWithoutFooter(),
  ["custom-pages:footer-hidden-paths"],
  {
    tags: [CUSTOM_PAGES_CACHE_TAG],
    revalidate: CUSTOM_PAGE_CACHE_REVALIDATE_SECONDS,
  },
)

export function revalidateCustomPagesCache() {
  revalidateTag(CUSTOM_PAGES_CACHE_TAG, "max")
}
