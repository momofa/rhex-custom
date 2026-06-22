/**
 * @file registry-aggregator.ts
 * @responsibility 把 N 个 LoadedAddon 聚合为统一 registry —— slot/surface/actionHook/waterfallHook/...
 *                 候选 Map；提供 IndexedAddonXxxCandidate 类型
 * @scope Phase B.9 抽出自 runtime/loader.ts；Phase B.11 补全函数体搬迁
 * @depends-on @/addons-host/types, ./map-utils, ./route-index  (禁止 import ../loader)
 * @exports IndexedAddonSlotCandidate, IndexedAddonSurfaceCandidate,
 *          IndexedAddonProviderCandidate, IndexedAddonActionHookCandidate,
 *          IndexedAddonWaterfallHookCandidate, IndexedAddonAsyncWaterfallHookCandidate,
 *          LoadedAddonsRegistry, buildLoadedAddonsRegistry
 */

import type {
  AddonActionHookRegistration,
  AddonApiRegistration,
  AddonAsyncWaterfallHookRegistration,
  AddonHttpMethod,
  AddonPageRegistration,
  AddonProviderRegistration,
  AddonSlotKey,
  AddonSlotRegistration,
  AddonSurfaceOverrideDescriptor,
  AddonSurfaceRegistration,
  AddonWaterfallHookRegistration,
  LoadedAddonRuntime,
} from "@/addons-host/types"

import { getOrCreateMapValue } from "@/addons-host/runtime/internal/map-utils"
import {
  buildAddonApiRouteIndex,
  buildAddonRouteIndex,
  resolveAddonClientModuleUrlForRegistry,
} from "@/addons-host/runtime/internal/route-index"

export interface IndexedAddonSlotCandidate {
  addon: LoadedAddonRuntime
  registration: AddonSlotRegistration
  order: number
}

export interface IndexedAddonSurfaceCandidate<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  addon: LoadedAddonRuntime
  registration: AddonSurfaceRegistration<TProps>
  priority: number
}

export interface IndexedAddonProviderCandidate {
  addon: LoadedAddonRuntime
  provider: AddonProviderRegistration
  order: number
}

export interface IndexedAddonActionHookCandidate {
  addon: LoadedAddonRuntime
  registration: AddonActionHookRegistration
  order: number
}

export interface IndexedAddonWaterfallHookCandidate {
  addon: LoadedAddonRuntime
  registration: AddonWaterfallHookRegistration
  order: number
}

export interface IndexedAddonAsyncWaterfallHookCandidate {
  addon: LoadedAddonRuntime
  registration: AddonAsyncWaterfallHookRegistration
  order: number
}

export interface LoadedAddonsRegistry {
  addons: LoadedAddonRuntime[]
  addonsById: Map<string, LoadedAddonRuntime>
  slotCandidatesBySlot: Map<AddonSlotKey, IndexedAddonSlotCandidate[]>
  surfaceCandidatesBySurface: Map<string, IndexedAddonSurfaceCandidate[]>
  providerCandidatesByKind: Map<string, IndexedAddonProviderCandidate[]>
  actionHookCandidatesByHook: Map<string, IndexedAddonActionHookCandidate[]>
  waterfallHookCandidatesByHook: Map<string, IndexedAddonWaterfallHookCandidate[]>
  asyncWaterfallHookCandidatesByHook: Map<string, IndexedAddonAsyncWaterfallHookCandidate[]>
  surfaceOverrideDescriptors: AddonSurfaceOverrideDescriptor[]
  publicPageRoutesByAddonId: Map<string, Map<string, AddonPageRegistration>>
  adminPageRoutesByAddonId: Map<string, Map<string, AddonPageRegistration>>
  publicApiRoutesByAddonId: Map<string, Map<string, Map<AddonHttpMethod, AddonApiRegistration>>>
  adminApiRoutesByAddonId: Map<string, Map<string, Map<AddonHttpMethod, AddonApiRegistration>>>
}

function compareAddonCandidates(
  left: { addon: LoadedAddonRuntime; registrationKey: string },
  right: { addon: LoadedAddonRuntime; registrationKey: string },
) {
  return `${left.addon.manifest.id}:${left.registrationKey}`.localeCompare(
    `${right.addon.manifest.id}:${right.registrationKey}`,
    "zh-CN",
  )
}

function compareOrderedAddonCandidates(
  left: IndexedAddonSlotCandidate,
  right: IndexedAddonSlotCandidate,
) {
  if (left.order !== right.order) {
    return left.order - right.order
  }

  return compareAddonCandidates(
    { addon: left.addon, registrationKey: left.registration.key },
    { addon: right.addon, registrationKey: right.registration.key },
  )
}

function compareOrderedAddonHookCandidates(
  left: Pick<IndexedAddonActionHookCandidate | IndexedAddonWaterfallHookCandidate | IndexedAddonAsyncWaterfallHookCandidate, "order" | "addon" | "registration">,
  right: Pick<IndexedAddonActionHookCandidate | IndexedAddonWaterfallHookCandidate | IndexedAddonAsyncWaterfallHookCandidate, "order" | "addon" | "registration">,
) {
  if (left.order !== right.order) {
    return left.order - right.order
  }

  return compareAddonCandidates(
    { addon: left.addon, registrationKey: left.registration.key },
    { addon: right.addon, registrationKey: right.registration.key },
  )
}

function comparePrioritizedAddonCandidates(
  left: IndexedAddonSurfaceCandidate,
  right: IndexedAddonSurfaceCandidate,
) {
  if (left.priority !== right.priority) {
    return right.priority - left.priority
  }

  return compareAddonCandidates(
    { addon: left.addon, registrationKey: left.registration.key },
    { addon: right.addon, registrationKey: right.registration.key },
  )
}

function compareIndexedAddonProviders(
  left: IndexedAddonProviderCandidate,
  right: IndexedAddonProviderCandidate,
) {
  if (left.order !== right.order) {
    return left.order - right.order
  }

  const byLabel = left.provider.label.localeCompare(
    right.provider.label,
    "zh-CN",
  )
  if (byLabel !== 0) {
    return byLabel
  }

  return left.provider.code.localeCompare(right.provider.code, "zh-CN")
}

export function buildLoadedAddonsRegistry(
  addons: LoadedAddonRuntime[],
): LoadedAddonsRegistry {
  const addonsById = new Map<string, LoadedAddonRuntime>()
  const slotCandidatesBySlot = new Map<AddonSlotKey, IndexedAddonSlotCandidate[]>()
  const surfaceCandidatesBySurface = new Map<string, IndexedAddonSurfaceCandidate[]>()
  const providerCandidatesByKind = new Map<string, IndexedAddonProviderCandidate[]>()
  const actionHookCandidatesByHook = new Map<string, IndexedAddonActionHookCandidate[]>()
  const waterfallHookCandidatesByHook = new Map<string, IndexedAddonWaterfallHookCandidate[]>()
  const asyncWaterfallHookCandidatesByHook = new Map<string, IndexedAddonAsyncWaterfallHookCandidate[]>()
  const surfaceOverrideDescriptors: AddonSurfaceOverrideDescriptor[] = []
  const publicPageRoutesByAddonId = new Map<string, Map<string, AddonPageRegistration>>()
  const adminPageRoutesByAddonId = new Map<string, Map<string, AddonPageRegistration>>()
  const publicApiRoutesByAddonId = new Map<string, Map<string, Map<AddonHttpMethod, AddonApiRegistration>>>()
  const adminApiRoutesByAddonId = new Map<string, Map<string, Map<AddonHttpMethod, AddonApiRegistration>>>()

  for (const addon of addons) {
    addonsById.set(addon.manifest.id, addon)

    if (!addon.enabled || addon.loadError) {
      continue
    }

    for (const registration of addon.slots) {
      getOrCreateMapValue(slotCandidatesBySlot, registration.slot, () => []).push({
        addon,
        registration,
        order: registration.order ?? 0,
      })
    }

    for (const registration of addon.surfaces) {
      getOrCreateMapValue(surfaceCandidatesBySurface, registration.surface, () => []).push({
        addon,
        registration,
        priority: registration.priority ?? 0,
      })

      const clientModuleUrl = resolveAddonClientModuleUrlForRegistry(
        addon,
        registration.clientModule,
      )
      if (!clientModuleUrl) {
        continue
      }

      surfaceOverrideDescriptors.push({
        addonId: addon.manifest.id,
        clientModuleUrl,
        description: registration.description,
        key: registration.key,
        priority: registration.priority ?? 0,
        surface: registration.surface,
        title: registration.title,
      })
    }

    for (const registration of addon.actionHooks) {
      getOrCreateMapValue(actionHookCandidatesByHook, registration.hook, () => []).push({
        addon,
        registration,
        order: registration.order ?? 0,
      })
    }

    for (const registration of addon.waterfallHooks) {
      getOrCreateMapValue(waterfallHookCandidatesByHook, registration.hook, () => []).push({
        addon,
        registration,
        order: registration.order ?? 0,
      })
    }

    for (const registration of addon.asyncWaterfallHooks) {
      getOrCreateMapValue(asyncWaterfallHookCandidatesByHook, registration.hook, () => []).push({
        addon,
        registration,
        order: registration.order ?? 0,
      })
    }

    for (const provider of addon.providers) {
      getOrCreateMapValue(providerCandidatesByKind, provider.kind, () => []).push({
        addon,
        provider,
        order: typeof provider.order === "number" && Number.isFinite(provider.order)
          ? provider.order
          : 0,
      })
    }

    if (addon.publicPages.length > 0) {
      publicPageRoutesByAddonId.set(
        addon.manifest.id,
        buildAddonRouteIndex(addon.publicPages),
      )
    }

    if (addon.adminPages.length > 0) {
      adminPageRoutesByAddonId.set(
        addon.manifest.id,
        buildAddonRouteIndex(addon.adminPages),
      )
    }

    if (addon.publicApis.length > 0) {
      publicApiRoutesByAddonId.set(
        addon.manifest.id,
        buildAddonApiRouteIndex(addon.publicApis),
      )
    }

    if (addon.adminApis.length > 0) {
      adminApiRoutesByAddonId.set(
        addon.manifest.id,
        buildAddonApiRouteIndex(addon.adminApis),
      )
    }
  }

  for (const candidates of slotCandidatesBySlot.values()) {
    candidates.sort(compareOrderedAddonCandidates)
  }

  for (const candidates of surfaceCandidatesBySurface.values()) {
    candidates.sort(comparePrioritizedAddonCandidates)
  }

  for (const candidates of providerCandidatesByKind.values()) {
    candidates.sort(compareIndexedAddonProviders)
  }

  for (const candidates of actionHookCandidatesByHook.values()) {
    candidates.sort(compareOrderedAddonHookCandidates)
  }

  for (const candidates of waterfallHookCandidatesByHook.values()) {
    candidates.sort(compareOrderedAddonHookCandidates)
  }

  for (const candidates of asyncWaterfallHookCandidatesByHook.values()) {
    candidates.sort(compareOrderedAddonHookCandidates)
  }

  surfaceOverrideDescriptors.sort((left, right) => {
    if (left.priority !== right.priority) {
      return right.priority - left.priority
    }

    return `${left.addonId}:${left.key}`.localeCompare(
      `${right.addonId}:${right.key}`,
      "zh-CN",
    )
  })

  return {
    addons,
    addonsById,
    slotCandidatesBySlot,
    surfaceCandidatesBySurface,
    providerCandidatesByKind,
    actionHookCandidatesByHook,
    waterfallHookCandidatesByHook,
    asyncWaterfallHookCandidatesByHook,
    surfaceOverrideDescriptors,
    publicPageRoutesByAddonId,
    adminPageRoutesByAddonId,
    publicApiRoutesByAddonId,
    adminApiRoutesByAddonId,
  }
}