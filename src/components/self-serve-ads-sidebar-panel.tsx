import { cache } from "react"

import { SelfServeAdsSidebar } from "@/components/self-serve-ads-sidebar"
import { getSelfServeAdsAppConfig } from "@/lib/app-config"
import { getSelfServeAdsPanelData } from "@/lib/self-serve-ads"
import type { HomeSidebarPanelItem } from "@/lib/home-sidebar-layout"
import { toSelfServeAdConfig } from "@/lib/self-serve-ads.shared"

export type SelfServeAdsSidebarSurface = "home" | "global" | "post"

function isSelfServeAdsVisibleOnSurface(config: ReturnType<typeof toSelfServeAdConfig>, surface: SelfServeAdsSidebarSurface) {
  if (!config.enabled) return false
  if (surface === "home") return config.visibleOnHome
  if (surface === "post") return config.visibleOnPostDetail
  return config.visibleOnGlobalSidebar
}

export const getSelfServeAdsSidebarPanel = cache(async (surface: SelfServeAdsSidebarSurface): Promise<HomeSidebarPanelItem | null> => {
  const [rawConfig, panelData] = await Promise.all([
    getSelfServeAdsAppConfig(),
    getSelfServeAdsPanelData(),
  ])
  const config = toSelfServeAdConfig(rawConfig)

  if (!panelData || !isSelfServeAdsVisibleOnSurface(config, surface)) {
    return null
  }

  return {
    id: `self-serve-ads:${surface}`,
    slot: config.sidebarSlot,
    order: config.sidebarOrder,
    content: (
      <SelfServeAdsSidebar
        AppId="self-serve-ads"
        config={rawConfig}
        panelData={panelData}
      />
    ),
  }
})

export async function SelfServeAdsSidebarPanelSlot({ surface, slot }: { surface: SelfServeAdsSidebarSurface; slot: HomeSidebarPanelItem["slot"] }) {
  const panel = await getSelfServeAdsSidebarPanel(surface)

  if (!panel || panel.slot !== slot) {
    return null
  }

  return <div>{panel.content}</div>
}
