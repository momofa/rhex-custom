/**
 * @file route-index.ts
 * @responsibility 构建 addon 页面/API 路由索引结构 + client module URL 归一化
 * @scope Phase B.9 抽自 runtime/loader.ts: resolveAddonClientModuleUrlForRegistry / buildAddonRouteIndex / buildAddonApiRouteIndex
 * @depends-on @/addons-host/runtime/fs, @/addons-host/runtime/internal/execution-context, @/addons-host/runtime/internal/map-utils, @/addons-host/types  (禁止 import ../loader)
 * @exports resolveAddonClientModuleUrlForRegistry, buildAddonRouteIndex, buildAddonApiRouteIndex
 */

import { normalizeMountedAddonPath } from "@/addons-host/runtime/fs"
import { buildAddonExecutionContext } from "@/addons-host/runtime/internal/execution-context"
import { getOrCreateMapValue } from "@/addons-host/runtime/internal/map-utils"
import type {
  AddonApiRegistration,
  AddonHttpMethod,
  AddonPageRegistration,
  LoadedAddonRuntime,
} from "@/addons-host/types"

export function resolveAddonClientModuleUrlForRegistry(
  addon: LoadedAddonRuntime,
  input?: string,
) {
  const target = typeof input === "string" ? input.trim() : ""
  if (!target) {
    return ""
  }

  if (/^(https?:)?\/\//i.test(target) || target.startsWith("/")) {
    return target
  }

  return buildAddonExecutionContext(addon).asset(target)
}

export function buildAddonRouteIndex(
  registrations: AddonPageRegistration[],
) {
  const routes = new Map<string, AddonPageRegistration>()

  for (const registration of registrations) {
    const mountedPath = normalizeMountedAddonPath(registration.path)
    if (!routes.has(mountedPath)) {
      routes.set(mountedPath, registration)
    }
  }

  return routes
}

export function buildAddonApiRouteIndex(
  registrations: AddonApiRegistration[],
) {
  const routes = new Map<string, Map<AddonHttpMethod, AddonApiRegistration>>()

  for (const registration of registrations) {
    const mountedPath = normalizeMountedAddonPath(registration.path)
    const methods = registration.methods ?? ["GET"]
    const routeMethods = getOrCreateMapValue(routes, mountedPath, () => new Map())

    for (const method of methods) {
      if (!routeMethods.has(method)) {
        routeMethods.set(method, registration)
      }
    }
  }

  return routes
}