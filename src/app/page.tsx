import type { Metadata } from "next"

import { HomeFeedPage } from "@/app/home-feed-page"
import { listAddonHomeFeedTabs } from "@/lib/addon-home-feed-providers"
import { resolveDefaultAddonHomeFeedTab } from "@/lib/home-feed-tabs"
import { getSiteSettings } from "@/lib/site-settings"

export const revalidate = 30

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  const title = `${settings.siteName} - ${settings.siteSlogan}`

  return {
    title,
    description: settings.siteDescription,
    openGraph: {
      title,
      description: settings.siteDescription,
      type: "website",
    },
  }
}

export default async function HomePage() {
  const defaultAddonTab = resolveDefaultAddonHomeFeedTab(await listAddonHomeFeedTabs())

  if (defaultAddonTab) {
    return <HomeFeedPage addonTabSlug={defaultAddonTab.slug} autoCheckInOnEnter />
  }

  return <HomeFeedPage sort="latest" autoCheckInOnEnter />
}
