import type { AddonRenderResult, AddonSlotKey } from "@/addons-host/types"

export type GlobalLayoutAddonDevice = "desktop" | "mobile"

export type GlobalLayoutAddonSlotKey = Extract<
  AddonSlotKey,
  "layout.head.before" | "layout.head.after" | "layout.body.start" | "layout.body.end"
>

export interface GlobalLayoutAddonSlotBlock {
  addonId: string
  key: string
  order: number
  result: AddonRenderResult
  slot: GlobalLayoutAddonSlotKey
}

export interface GlobalLayoutAddonSlotsPayload {
  pathname: string
  device: GlobalLayoutAddonDevice
  slots: {
    headBefore: GlobalLayoutAddonSlotBlock[]
    headAfter: GlobalLayoutAddonSlotBlock[]
    bodyStart: GlobalLayoutAddonSlotBlock[]
    bodyEnd: GlobalLayoutAddonSlotBlock[]
  }
}
