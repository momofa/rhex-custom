import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { SiteHeader } from "@/components/site-header"

import { SelfServeAdsPurchasePage } from "@/components/self-serve-ads-purchase-page"
import { getSelfServeAdsAppConfig } from "@/lib/self-serve-ads"
import { buildSelfServeAdPriceMap, toSelfServeAdConfig } from "@/lib/self-serve-ads.shared"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `购买广告位 - ${settings.siteName}`,
  }
}




export default async function SelfServeAdsPurchaseRoute(props: PageProps<"/funs/self-serve-ads/purchase">) {
  const searchParams = await props.searchParams;
  const slotTypeValue = readSearchParam(searchParams?.slotType)
  const slotType = slotTypeValue === "IMAGE" ? "IMAGE" : slotTypeValue === "TEXT" ? "TEXT" : null
  const slotIndex = Math.max(0, Number(readSearchParam(searchParams?.slotIndex) ?? 0) || 0)

  if (!slotType) {
    notFound()
  }

  const [rawConfig, settings] = await Promise.all([
    getSelfServeAdsAppConfig(),
    getSiteSettings(),
  ])
  const config = toSelfServeAdConfig(rawConfig)
  const funsAppSlotProps = {
    appId: "self-serve-ads",
    appName: "自助广告购买",
    slotType,
    slotIndex,
    pointName: settings.pointName,
  }


  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1 py-8">
        <AddonSlotRenderer slot="funs.app.page.before" props={funsAppSlotProps} />
        <AddonSurfaceRenderer surface="funs.app.page" props={funsAppSlotProps}>
          <AddonSlotRenderer slot="funs.app.content.before" props={funsAppSlotProps} />
          <AddonSurfaceRenderer surface="funs.app.content" props={funsAppSlotProps}>
            <SelfServeAdsPurchasePage
              slotType={slotType}
              slotIndex={slotIndex}
              pointName={settings.pointName}
              prices={buildSelfServeAdPriceMap(config)}
            />
          </AddonSurfaceRenderer>
          <AddonSlotRenderer slot="funs.app.content.after" props={funsAppSlotProps} />
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="funs.app.page.after" props={funsAppSlotProps} />
      </div>
    </div>
  )
}
