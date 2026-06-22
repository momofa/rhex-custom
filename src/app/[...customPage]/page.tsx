import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CustomPageRenderer } from "@/components/custom-page-renderer"
import { getPublishedCustomPageByPath } from "@/lib/custom-pages"
import { resolveCustomPageRoutePathFromSegments, stripCustomPageHtmlToText } from "@/lib/custom-page-types"
import { getSiteSettings } from "@/lib/site-settings"

interface CustomPageRouteProps {
  params: Promise<{ customPage: string[] }>
}

export const dynamic = "force-dynamic"

async function getCustomPageRouteData(segments: string[]) {
  const routePath = resolveCustomPageRoutePathFromSegments(segments)
  if (!routePath) {
    return null
  }

  return getPublishedCustomPageByPath(routePath)
}

export async function generateMetadata({ params }: CustomPageRouteProps): Promise<Metadata> {
  const { customPage } = await params
  const routePath = resolveCustomPageRoutePathFromSegments(customPage)
  const [settings, page] = await Promise.all([
    getSiteSettings(),
    routePath ? getPublishedCustomPageByPath(routePath) : Promise.resolve(null),
  ])

  if (!page) {
    return {
      title: settings.siteName,
      description: settings.siteDescription,
    }
  }

  const description = stripCustomPageHtmlToText(page.htmlContent, 120) || settings.siteDescription

  return {
    title: `${page.title} - ${settings.siteName}`,
    description,
    openGraph: {
      title: `${page.title} - ${settings.siteName}`,
      description,
      type: "website",
    },
  }
}

export default async function CustomPageRoute({ params }: CustomPageRouteProps) {
  const { customPage } = await params
  const routePath = resolveCustomPageRoutePathFromSegments(customPage)
  const page = await getCustomPageRouteData(customPage)

  if (!page) {
    notFound()
  }

  return <CustomPageRenderer page={page} routePath={routePath} />
}
