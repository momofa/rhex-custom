import type { Metadata } from "next"

import {
  generateAddonHomeFeedMetadata,
  generateHomeFeedMetadata,
  HomeFeedPage,
} from "@/app/home-feed-page"
import { listAddonHomeFeedTabs } from "@/lib/addon-home-feed-providers"
import { resolveDefaultAddonHomeFeedTab } from "@/lib/home-feed-tabs"

export const revalidate = 30

export async function generateMetadata(): Promise<Metadata> {
  const defaultAddonTab = resolveDefaultAddonHomeFeedTab(await listAddonHomeFeedTabs())
  if (defaultAddonTab) {
    return generateAddonHomeFeedMetadata(defaultAddonTab.slug, "/")
  }

  return generateHomeFeedMetadata("latest")
}

export default async function HomePage() {
  const defaultAddonTab = resolveDefaultAddonHomeFeedTab(await listAddonHomeFeedTabs())

  if (defaultAddonTab) {
    return <HomeFeedPage addonTabSlug={defaultAddonTab.slug} autoCheckInOnEnter />
  }

  return <HomeFeedPage sort="latest" autoCheckInOnEnter />
}



