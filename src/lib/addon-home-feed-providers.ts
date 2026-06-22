import "server-only"

import type {
  AddonHomeFeedProviderMetadata,
  AddonHomeFeedProviderRuntimeHooks,
  AddonHomeFeedTabRegistration,
  ResolvedAddonHomeFeedTab,
} from "@/addons-host/home-feed-types"
import type { AddonRenderResult } from "@/addons-host/types"
import {
  isRecord,
  normalizeOptionalString,
  normalizeProviderOrder,
} from "@/lib/addon-provider-helpers"
import {
  invokeAddonProviderRuntime,
  listAddonProviderRuntimeItems,
} from "@/lib/addon-provider-registry"

interface AddonHomeFeedRenderResult {
  addonId: string
  providerCode: string
  result: AddonRenderResult
  tab: ResolvedAddonHomeFeedTab
}

function normalizeAddonHomeFeedSlug(value: unknown, fallback: string) {
  const normalized = normalizeOptionalString(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized
}

function normalizeAddonHomeFeedTab(
  value: unknown,
  input: {
    addonId: string
    fallbackOrder: number
    providerCode: string
    providerLabel: string
  },
): ResolvedAddonHomeFeedTab | null {
  if (!isRecord(value)) {
    return null
  }

  const slug = normalizeAddonHomeFeedSlug(value.slug, input.providerCode)
  const label = normalizeOptionalString(value.label)
  const description = normalizeOptionalString(value.description) || undefined
  const order = typeof value.order === "number" && Number.isFinite(value.order)
    ? normalizeProviderOrder(value.order)
    : input.fallbackOrder

  if (!slug || !label) {
    return null
  }

  return {
    addonId: input.addonId,
    providerCode: input.providerCode,
    providerLabel: input.providerLabel,
    slug,
    label,
    description,
    order,
  }
}

function compareAddonHomeFeedTabs(
  left: ResolvedAddonHomeFeedTab,
  right: ResolvedAddonHomeFeedTab,
) {
  if (left.order !== right.order) {
    return left.order - right.order
  }

  const byLabel = left.label.localeCompare(right.label, "zh-CN")
  if (byLabel !== 0) {
    return byLabel
  }

  return `${left.addonId}:${left.providerCode}:${left.slug}`.localeCompare(
    `${right.addonId}:${right.providerCode}:${right.slug}`,
    "zh-CN",
  )
}

async function resolveProviderTabList(input?: {
  request?: Request
}) {
  const providers = await listAddonProviderRuntimeItems<AddonHomeFeedProviderRuntimeHooks>(
    "home-feed",
    input,
  )
  const tabs: ResolvedAddonHomeFeedTab[] = []

  for (const item of providers) {
    const data = isRecord(item.provider.data) ? item.provider.data : null
    const staticTab = isRecord(data?.tab)
      ? (data.tab as unknown as AddonHomeFeedTabRegistration)
      : null
    let runtimeTab: AddonHomeFeedTabRegistration | null | undefined = null

    try {
      runtimeTab = await invokeAddonProviderRuntime(
        item,
        "getTab",
        () => ({
          addon: item.addon,
          provider: item.provider,
          context: item.context,
        }),
      ) as AddonHomeFeedTabRegistration | null | undefined
    } catch (error) {
      console.error(
        "[addon-home-feed-providers] failed to read addon home-feed tab",
        item.provider.code,
        error,
      )
    }

    const normalized = normalizeAddonHomeFeedTab(runtimeTab ?? staticTab, {
      addonId: item.addon.manifest.id,
      fallbackOrder: item.order,
      providerCode: item.provider.code,
      providerLabel: item.provider.label,
    })

    if (normalized) {
      tabs.push(normalized)
    }
  }

  return tabs.sort(compareAddonHomeFeedTabs)
}

export async function listAddonHomeFeedTabs(input?: {
  request?: Request
}) {
  return resolveProviderTabList(input)
}

export async function findAddonHomeFeedTabBySlug(
  slug: string,
  input?: {
    request?: Request
  },
) {
  const normalizedSlug = normalizeAddonHomeFeedSlug(slug, "")
  if (!normalizedSlug) {
    return null
  }

  const tabs = await resolveProviderTabList(input)
  return tabs.find((item) => item.slug === normalizedSlug) ?? null
}

export async function renderAddonHomeFeedTab(input: {
  slug: string
  page: number
  pathname: string
  request?: Request
  searchParams?: URLSearchParams
}) {
  const normalizedSlug = normalizeAddonHomeFeedSlug(input.slug, "")
  if (!normalizedSlug) {
    return null
  }

  const providers = await listAddonProviderRuntimeItems<AddonHomeFeedProviderRuntimeHooks>(
    "home-feed",
    { request: input.request },
  )

  for (const item of providers) {
    const data = isRecord(item.provider.data) ? item.provider.data : null
    const staticTab = isRecord(data?.tab)
      ? (data.tab as unknown as AddonHomeFeedTabRegistration)
      : null
    let runtimeTab: AddonHomeFeedTabRegistration | null | undefined = null

    try {
      runtimeTab = await invokeAddonProviderRuntime(
        item,
        "getTab",
        () => ({
          addon: item.addon,
          provider: item.provider,
          context: item.context,
        }),
      ) as AddonHomeFeedTabRegistration | null | undefined
    } catch (error) {
      console.error(
        "[addon-home-feed-providers] failed to resolve addon home-feed tab",
        item.provider.code,
        error,
      )
      continue
    }

    const tab = normalizeAddonHomeFeedTab(runtimeTab ?? staticTab, {
      addonId: item.addon.manifest.id,
      fallbackOrder: item.order,
      providerCode: item.provider.code,
      providerLabel: item.provider.label,
    })
    if (!tab || tab.slug !== normalizedSlug) {
      continue
    }

    try {
      const result = await invokeAddonProviderRuntime(
        item,
        "render",
        () => ({
          addon: item.addon,
          provider: item.provider,
          context: item.context,
          page: input.page,
          pathname: input.pathname,
          request: input.request,
          searchParams: input.searchParams,
          tab,
        }),
      ) as AddonRenderResult | null | undefined

      if (!result) {
        return null
      }

      return {
        addonId: item.addon.manifest.id,
        providerCode: item.provider.code,
        result,
        tab,
      } satisfies AddonHomeFeedRenderResult
    } catch (error) {
      console.error(
        "[addon-home-feed-providers] failed to render addon home-feed tab",
        item.provider.code,
        error,
      )
      return null
    }
  }

  return null
}

export async function getAddonHomeFeedMetadata(input: {
  slug: string
  page?: number
  pathname: string
  request?: Request
  searchParams?: URLSearchParams
}) {
  const normalizedSlug = normalizeAddonHomeFeedSlug(input.slug, "")
  if (!normalizedSlug) {
    return null
  }

  const providers = await listAddonProviderRuntimeItems<AddonHomeFeedProviderRuntimeHooks>(
    "home-feed",
    { request: input.request },
  )

  for (const item of providers) {
    const data = isRecord(item.provider.data) ? item.provider.data : null
    const staticTab = isRecord(data?.tab)
      ? (data.tab as unknown as AddonHomeFeedTabRegistration)
      : null
    let runtimeTab: AddonHomeFeedTabRegistration | null | undefined = null

    try {
      runtimeTab = await invokeAddonProviderRuntime(
        item,
        "getTab",
        () => ({
          addon: item.addon,
          provider: item.provider,
          context: item.context,
        }),
      ) as AddonHomeFeedTabRegistration | null | undefined
    } catch (error) {
      console.error(
        "[addon-home-feed-providers] failed to resolve addon home-feed metadata tab",
        item.provider.code,
        error,
      )
      continue
    }

    const tab = normalizeAddonHomeFeedTab(runtimeTab ?? staticTab, {
      addonId: item.addon.manifest.id,
      fallbackOrder: item.order,
      providerCode: item.provider.code,
      providerLabel: item.provider.label,
    })
    if (!tab || tab.slug !== normalizedSlug) {
      continue
    }

    try {
      return await invokeAddonProviderRuntime(
        item,
        "getMetadata",
        () => ({
          addon: item.addon,
          provider: item.provider,
          context: item.context,
          page: Math.max(1, Math.trunc(input.page ?? 1)),
          pathname: input.pathname,
          request: input.request,
          searchParams: input.searchParams,
          tab,
        }),
      ) as AddonHomeFeedProviderMetadata | null | undefined
    } catch (error) {
      console.error(
        "[addon-home-feed-providers] failed to read addon home-feed metadata",
        item.provider.code,
        error,
      )
      return null
    }
  }

  return null
}
