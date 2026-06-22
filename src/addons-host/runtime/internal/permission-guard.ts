/**
 * @file permission-guard.ts
 * @responsibility 由 addon manifest 解析出 permissionSet 与冻结后的 resolvedPermissions 列表
 * @scope Phase B.5 抽自 runtime/loader.ts 531-542 的 buildAddonPermissionCache
 * @depends-on ../permissions, @/addons-host/types
 * @exports buildAddonPermissionCache
 */

import { resolveAddonPermissionSet } from "@/addons-host/runtime/permissions"
import type { AddonManifest } from "@/addons-host/types"

export function buildAddonPermissionCache(manifest: AddonManifest) {
  const permissionSet = resolveAddonPermissionSet(manifest.permissions)
  const resolvedPermissions = Object.freeze(
    [...permissionSet.values()].sort((left, right) =>
      left.localeCompare(right, "zh-CN"),
    ),
  )

  return {
    permissionSet,
    resolvedPermissions,
  }
}
