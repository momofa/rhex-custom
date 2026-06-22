import { revalidateTag, unstable_cache } from "next/cache"

import { findPublishedSiteDocumentByTypeAndSlug, findPublishedSiteDocuments, type SiteDocumentRow } from "@/db/site-document-queries"
import { formatMonthDayTime, serializeDateTime } from "@/lib/formatters"
import {
  buildSiteDocumentHref,
  getSiteDocumentSourceTypeLabel,
  getSiteDocumentTypeLabel,
  isExternalSiteDocumentHref,
  resolveSiteDocumentSlugFromSegments,
  type SiteDocumentRecordBase,
  type SiteDocumentType,
} from "@/lib/site-document-types"

export const SITE_DOCUMENTS_CACHE_TAG = "site-documents"

export interface SiteDocumentItem extends SiteDocumentRecordBase {
  typeLabel: string
  sourceTypeLabel: string
}

function mapSiteDocument(item: SiteDocumentRow): SiteDocumentItem {
  const publishedAt = serializeDateTime(item.publishedAt ?? item.createdAt) ?? item.createdAt.toISOString()
  const type = item.type as SiteDocumentType
  const href = buildSiteDocumentHref({
    id: item.id,
    type,
    sourceType: item.sourceType as SiteDocumentItem["sourceType"],
    slug: item.slug,
    linkUrl: item.linkUrl,
  })

  return {
    id: item.id,
    type,
    typeLabel: getSiteDocumentTypeLabel(type),
    title: item.title,
    content: item.content,
    sourceType: item.sourceType as SiteDocumentItem["sourceType"],
    sourceTypeLabel: getSiteDocumentSourceTypeLabel(item.sourceType as SiteDocumentItem["sourceType"]),
    slug: item.slug,
    linkUrl: item.linkUrl,
    titleColor: item.titleColor,
    titleBold: item.titleBold,
    status: item.status,
    isPinned: item.isPinned,
    createdAt: serializeDateTime(item.createdAt) ?? item.createdAt.toISOString(),
    publishedAt,
    publishedAtText: formatMonthDayTime(publishedAt),
    creatorName: item.creator.nickname ?? item.creator.username,
    href,
    isExternal: isExternalSiteDocumentHref(href),
  }
}

async function readPublishedSiteDocumentItems(type: SiteDocumentType, limit?: number) {
  const items = await findPublishedSiteDocuments(type, limit)
  return items.map(mapSiteDocument)
}

const getPersistentPublishedSiteDocumentItems = unstable_cache(
  async (type: SiteDocumentType, limit?: number) => readPublishedSiteDocumentItems(type, limit),
  ["site-documents:list"],
  {
    tags: [SITE_DOCUMENTS_CACHE_TAG],
    revalidate: 60,
  },
)

export async function getPublishedSiteDocumentItems(type: SiteDocumentType, limit?: number) {
  return getPersistentPublishedSiteDocumentItems(type, limit)
}

async function readPublishedSiteDocumentBySlug(type: SiteDocumentType, slug: string) {
  const item = await findPublishedSiteDocumentByTypeAndSlug(type, slug)
  return item ? mapSiteDocument(item) : null
}

const getPersistentPublishedSiteDocumentBySlug = unstable_cache(
  readPublishedSiteDocumentBySlug,
  ["site-documents:by-slug"],
  {
    tags: [SITE_DOCUMENTS_CACHE_TAG],
    revalidate: 60,
  },
)

export async function getPublishedSiteDocumentBySlug(type: SiteDocumentType, slugSegments?: string[]) {
  const slug = resolveSiteDocumentSlugFromSegments(slugSegments)
  if (!slug) {
    return null
  }

  return getPersistentPublishedSiteDocumentBySlug(type, slug)
}

export function revalidateSiteDocumentsCache() {
  try {
    revalidateTag(SITE_DOCUMENTS_CACHE_TAG, { expire: 0 })
  } catch {
    // Ignore when called outside a Next.js request context.
  }
}

export async function getHelpDocumentPageData(slugSegments?: string[]) {
  const items = await getPublishedSiteDocumentItems("HELP")
  const readableItems = items.filter((item) => item.sourceType === "DOCUMENT")
  const requestedSlug = resolveSiteDocumentSlugFromSegments(slugSegments)

  if (requestedSlug) {
    return {
      items,
      activeItem: readableItems.find((item) => item.slug === requestedSlug) ?? null,
    }
  }

  return {
    items,
    activeItem: readableItems[0] ?? null,
  }
}
