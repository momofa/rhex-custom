import type { AddonManifest } from "@/addons-host/types"

export interface AddonRelationCatalogItem {
  manifest: Pick<AddonManifest, "id" | "name" | "dependencies">
  enabled: boolean
  loadError?: string | null
}

export interface AddonManifestRelationResult {
  blockingIssues: string[]
  warnings: string[]
}

function pushUnique(target: string[], message: string) {
  if (!target.includes(message)) {
    target.push(message)
  }
}

function normalizeAddonIdList(values?: string[]) {
  const items = Array.isArray(values) ? values : []
  const seen = new Set<string>()

  return items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false
      }

      seen.add(item)
      return true
    })
}

function formatAddonLabel(item: AddonRelationCatalogItem | undefined, fallbackId: string) {
  const addonId = item?.manifest.id?.trim() || fallbackId
  const addonName = item?.manifest.name?.trim()

  return addonName ? `${addonName} (${addonId})` : addonId
}

function sortCatalogItems(catalog: ReadonlyMap<string, AddonRelationCatalogItem>) {
  return [...catalog.values()].sort((left, right) =>
    left.manifest.id.localeCompare(right.manifest.id, "zh-CN"),
  )
}

export function buildAddonRelationCatalog(items: AddonRelationCatalogItem[]) {
  const catalog = new Map<string, AddonRelationCatalogItem>()

  for (const item of items) {
    const addonId = item.manifest.id.trim()
    if (!addonId) {
      continue
    }

    catalog.set(addonId, {
      manifest: {
        id: addonId,
        name: item.manifest.name?.trim() || addonId,
        dependencies: item.manifest.dependencies,
      },
      enabled: Boolean(item.enabled),
      loadError: item.loadError ?? null,
    })
  }

  return catalog
}

export function validateAddonManifestRelations(input: {
  manifest: AddonManifest
  enabled: boolean
  catalog: ReadonlyMap<string, AddonRelationCatalogItem>
  includeDependencyLoadErrors?: boolean
}): AddonManifestRelationResult {
  const blockingIssues: string[] = []
  const warnings: string[] = []
  const addIssue = input.enabled
    ? (message: string) => pushUnique(blockingIssues, message)
    : (message: string) => pushUnique(warnings, message)
  const addonId = input.manifest.id.trim()
  const requiredAddonIds = normalizeAddonIdList(input.manifest.dependencies?.addons)
  const conflictingAddonIds = normalizeAddonIdList(input.manifest.dependencies?.conflicts)

  for (const dependencyAddonId of requiredAddonIds) {
    if (dependencyAddonId === addonId) {
      addIssue(`插件 "${addonId}" 不能依赖自身`)
      continue
    }

    const dependency = input.catalog.get(dependencyAddonId)
    if (!dependency) {
      addIssue(`依赖插件 "${dependencyAddonId}" 未安装`)
      continue
    }

    if (!dependency.enabled) {
      addIssue(`依赖插件 "${formatAddonLabel(dependency, dependencyAddonId)}" 已安装但未启用`)
      continue
    }

    if (input.includeDependencyLoadErrors && dependency.loadError) {
      addIssue(`依赖插件 "${formatAddonLabel(dependency, dependencyAddonId)}" 当前加载失败`)
    }
  }

  for (const conflictAddonId of conflictingAddonIds) {
    if (conflictAddonId === addonId) {
      addIssue(`插件 "${addonId}" 不能与自身冲突`)
      continue
    }

    const conflict = input.catalog.get(conflictAddonId)
    if (conflict?.enabled) {
      addIssue(`与已启用插件 "${formatAddonLabel(conflict, conflictAddonId)}" 冲突`)
    }
  }

  return {
    blockingIssues,
    warnings,
  }
}

export function collectReverseConflictIssues(input: {
  manifest: AddonManifest
  catalog: ReadonlyMap<string, AddonRelationCatalogItem>
}) {
  const issues: string[] = []
  const addonId = input.manifest.id.trim()

  for (const item of sortCatalogItems(input.catalog)) {
    if (!item.enabled || item.manifest.id === addonId) {
      continue
    }

    const conflicts = normalizeAddonIdList(item.manifest.dependencies?.conflicts)
    if (conflicts.includes(addonId)) {
      pushUnique(
        issues,
        `已启用插件 "${formatAddonLabel(item, item.manifest.id)}" 声明与当前插件冲突`,
      )
    }
  }

  return issues
}

export function collectDependentAddonIssues(input: {
  addonId: string
  catalog: ReadonlyMap<string, AddonRelationCatalogItem>
}) {
  const issues: string[] = []
  const targetAddonId = input.addonId.trim()

  for (const item of sortCatalogItems(input.catalog)) {
    if (!item.enabled || item.manifest.id === targetAddonId) {
      continue
    }

    const dependencies = normalizeAddonIdList(item.manifest.dependencies?.addons)
    if (dependencies.includes(targetAddonId)) {
      pushUnique(
        issues,
        `已启用插件 "${formatAddonLabel(item, item.manifest.id)}" 依赖当前插件`,
      )
    }
  }

  return issues
}
