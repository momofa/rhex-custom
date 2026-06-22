import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  generateAddonHomeFeedMetadata,
  HomeFeedPage,
} from "@/app/home-feed-page"
import { findAddonHomeFeedTabBySlug } from "@/lib/addon-home-feed-providers"

interface AddonHomeFeedRoutePageProps {
  params: Promise<{
    slug: string
  }>
  searchParams?: Promise<{
    page?: string | string[]
  }>
}

export async function generateMetadata(
  props: AddonHomeFeedRoutePageProps,
): Promise<Metadata> {
  const params = await props.params
  return generateAddonHomeFeedMetadata(params.slug)
}

export default async function AddonHomeFeedRoutePage(
  props: AddonHomeFeedRoutePageProps,
) {
  const params = await props.params
  const tab = await findAddonHomeFeedTabBySlug(params.slug)

  if (!tab) {
    notFound()
  }

  return <HomeFeedPage addonTabSlug={tab.slug} searchParams={props.searchParams} />
}
