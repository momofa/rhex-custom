import "server-only"

import { headers } from "next/headers"

import { GlobalLayoutAddonSlots } from "@/addons-host/client/global-layout-addon-slots"
import {
  getCachedGlobalLayoutAddonSlotsPayload,
  normalizeGlobalLayoutAddonPathname,
  resolveGlobalLayoutAddonDevice,
} from "@/addons-host/runtime/global-layout-slots"
import type { GlobalLayoutAddonSlotsPayload } from "@/addons-host/global-layout-addon-slots-types"
import { RHEX_PATHNAME_HEADER } from "@/lib/request-context-headers"

export async function GlobalLayoutAddonSlotsBoundary() {
  let initialPayload: GlobalLayoutAddonSlotsPayload | undefined

  try {
    const headersList = await headers()
    const pathname = normalizeGlobalLayoutAddonPathname(headersList.get(RHEX_PATHNAME_HEADER))
    const device = resolveGlobalLayoutAddonDevice(headersList.get("user-agent"))
    initialPayload = await getCachedGlobalLayoutAddonSlotsPayload(pathname, device)
  } catch (error) {
    console.error("[global-layout-addon-slots:ssr] failed to load initial payload", error)
  }

  return <GlobalLayoutAddonSlots initialPayload={initialPayload} />
}
