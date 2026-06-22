import type { Metadata } from "next"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { SiteHeader } from "@/components/site-header"
import { getCurrentUser } from "@/lib/auth"
import { getSiteSettings } from "@/lib/site-settings"
import { buildMetadataKeywords } from "@/lib/seo"
import { getYinYangLobbyData, YinYangContractPage } from "@/lib/yinyang-contract"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  return {
    title: `阴阳契 - ${settings.siteName}`,
    description: `在 ${settings.siteName} 发起双选项积分挑战，参与阴阳契应战、查看胜负排行与积分盈利榜。`,
    keywords: buildMetadataKeywords(settings.siteSeoKeywords, ["阴阳契", "积分挑战", "排行榜", "赢家榜", "盈利榜"]),
  }
}

export default async function YinYangContractFunPage() {
  const user = await getCurrentUser()
  const initialData = await getYinYangLobbyData(user)
  const funsAppSlotProps = {
    appId: "yinyang-contract",
    appName: "阴阳契",
    isAuthenticated: Boolean(user),
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto mt-8 max-w-[1200px] px-1 py-8">
        <AddonSlotRenderer slot="funs.app.page.before" props={funsAppSlotProps} />
        <AddonSurfaceRenderer surface="funs.app.page" props={funsAppSlotProps}>
          <AddonSlotRenderer slot="funs.app.content.before" props={funsAppSlotProps} />
          <AddonSurfaceRenderer surface="funs.app.content" props={funsAppSlotProps}>
            <YinYangContractPage initialData={initialData} canPlay={Boolean(user)} />
          </AddonSurfaceRenderer>
          <AddonSlotRenderer slot="funs.app.content.after" props={funsAppSlotProps} />
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="funs.app.page.after" props={funsAppSlotProps} />
      </div>
    </div>
  )
}
