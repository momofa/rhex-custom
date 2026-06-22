import "server-only"

import { revalidateTag } from "next/cache"

export const GLOBAL_LAYOUT_ADDON_SLOTS_CACHE_TAG = "addons:global-layout-slots"

export function revalidateGlobalLayoutAddonSlotsCache() {
  try {
    revalidateTag(GLOBAL_LAYOUT_ADDON_SLOTS_CACHE_TAG, { expire: 0 })
  } catch {
    // This can be called from scripts or addon lifecycle code outside a request.
  }
}
