import "server-only"

import { unstable_cache } from "next/cache"

import { executeAddonSlot } from "@/addons-host/runtime/execute"
import { GLOBAL_LAYOUT_ADDON_SLOTS_CACHE_TAG } from "@/addons-host/runtime/global-layout-slot-cache"
import type {
  GlobalLayoutAddonDevice,
  GlobalLayoutAddonSlotBlock,
  GlobalLayoutAddonSlotKey,
  GlobalLayoutAddonSlotsPayload,
} from "@/addons-host/global-layout-addon-slots-types"

export type {
  GlobalLayoutAddonDevice,
  GlobalLayoutAddonSlotBlock,
  GlobalLayoutAddonSlotsPayload,
} from "@/addons-host/global-layout-addon-slots-types"

function normalizePathname(value: string | null | undefined) {
  const rawValue = String(value ?? "/").trim()
  if (!rawValue || !rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return "/"
  }

  return rawValue === "/" ? "/" : rawValue.replace(/\/+$/g, "")
}

export function normalizeGlobalLayoutAddonPathname(value: string | null | undefined) {
  return normalizePathname(value)
}

export function resolveGlobalLayoutAddonDevice(userAgent: string | null | undefined): GlobalLayoutAddonDevice {
  return /android|iphone|ipad|ipod|mobile|windows phone|iemobile|opera mini|blackberry|tablet/i.test(String(userAgent ?? ""))
    ? "mobile"
    : "desktop"
}

function deviceToUserAgent(device: GlobalLayoutAddonDevice) {
  return device === "mobile" ? "Mobile" : ""
}

async function executeGlobalLayoutSlot(
  slot: GlobalLayoutAddonSlotKey,
  props: { pathname: string; userAgent: string },
): Promise<GlobalLayoutAddonSlotBlock[]> {
  const blocks = await executeAddonSlot(slot, props, {
    pathname: props.pathname,
  })

  return blocks.map((block) => ({
    addonId: block.addon.manifest.id,
    key: block.key,
    order: block.order,
    result: block.result,
    slot,
  }))
}

const getCachedGlobalLayoutAddonSlotsPayloadInternal = unstable_cache(
  async (pathnameInput: string, device: GlobalLayoutAddonDevice): Promise<GlobalLayoutAddonSlotsPayload> => {
    const pathname = normalizePathname(pathnameInput)
    const props = {
      pathname,
      userAgent: deviceToUserAgent(device),
    }

    const [headBefore, headAfter, bodyStart, bodyEnd] = await Promise.all([
      executeGlobalLayoutSlot("layout.head.before", props),
      executeGlobalLayoutSlot("layout.head.after", props),
      executeGlobalLayoutSlot("layout.body.start", props),
      executeGlobalLayoutSlot("layout.body.end", props),
    ])

    return {
      pathname,
      device,
      slots: {
        headBefore,
        headAfter,
        bodyStart,
        bodyEnd,
      },
    }
  },
  [GLOBAL_LAYOUT_ADDON_SLOTS_CACHE_TAG],
  {
    tags: [GLOBAL_LAYOUT_ADDON_SLOTS_CACHE_TAG],
    revalidate: 300,
  },
)

export function getCachedGlobalLayoutAddonSlotsPayload(pathname: string, device: GlobalLayoutAddonDevice) {
  return getCachedGlobalLayoutAddonSlotsPayloadInternal(pathname, device)
}
