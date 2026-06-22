import type { Metadata } from "next"
import type { ComponentType } from "react"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { SiteHeader } from "@/components/site-header"


import { SelfServeAdsIntroPage } from "@/components/self-serve-ads-intro-page"
import { getSelfServeAdsAppConfig, getSelfServeAdsPanelData } from "@/lib/self-serve-ads"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `自助广告 - ${settings.siteName}`,
  }
}


export default async function SelfServeAdsPage() {
  const [config, panelData] = await Promise.all([
    getSelfServeAdsAppConfig(),
    getSelfServeAdsPanelData(),
  ])
  const AppIntroComponent = SelfServeAdsIntroPage as ComponentType<{ AppId: string; config: Record<string, boolean | number | string>; panelData: Awaited<ReturnType<typeof getSelfServeAdsPanelData>> }>
  const funsAppSlotProps = {
    appId: "self-serve-ads",
    appName: "自助广告",
    isAuthenticated: false,
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1 py-8">
        <AddonSlotRenderer slot="funs.app.page.before" props={funsAppSlotProps} />
        <AddonSurfaceRenderer surface="funs.app.page" props={funsAppSlotProps}>
          <div className="space-y-6">
            <AddonSlotRenderer slot="funs.app.content.before" props={funsAppSlotProps} />
            <AddonSurfaceRenderer surface="funs.app.content" props={funsAppSlotProps}>
              <AppIntroComponent AppId="self-serve-ads" config={config} panelData={panelData} />
            </AddonSurfaceRenderer>
            <AddonSlotRenderer slot="funs.app.content.after" props={funsAppSlotProps} />
          </div>
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="funs.app.page.after" props={funsAppSlotProps} />
      </div>
    </div>
  )
}
