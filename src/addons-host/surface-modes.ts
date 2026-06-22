import {
  getAddonSurfaceCatalogEntry,
  type AddonSurfaceExecutionMode,
} from "@/addons-host/surface-catalog"
import type { AddonSurfaceKey } from "@/addons-host/types"

export type { AddonSurfaceExecutionMode } from "@/addons-host/surface-catalog"

export function getAddonSurfaceExecutionMode(
  surface: AddonSurfaceKey,
): AddonSurfaceExecutionMode {
  return getAddonSurfaceCatalogEntry(surface)?.mode ?? "server"
}

export function isAddonClientOnlySurface(surface: AddonSurfaceKey) {
  return getAddonSurfaceExecutionMode(surface) === "client"
}
