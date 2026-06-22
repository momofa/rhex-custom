import { notFound } from "next/navigation"

import { generateTagRssXml } from "@/lib/rss"
import { getTagBySlug } from "@/lib/tags"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, props: RouteContext<"/tags/[slug]/rss.xml">) {
  const params = await props.params;
  const tag = await getTagBySlug(params.slug)

  if (!tag) {
    notFound()
  }

  const xml = await generateTagRssXml(tag)

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  })
}
