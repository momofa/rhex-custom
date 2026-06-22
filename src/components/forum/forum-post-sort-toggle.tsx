"use client"

import Link from "next/link"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { TaxonomyPostSortLinks } from "@/lib/forum-taxonomy-sort"

export function ForumPostSortToggle({ currentSort, latestHref, newHref, featuredHref }: TaxonomyPostSortLinks) {
  return (
    <ToggleGroup
      value={[currentSort]}
      size="sm"
      spacing={1}
      aria-label="帖子排序切换"
      className="rounded-full border border-border bg-background p-1"
    >
      <ToggleGroupItem value="latest" nativeButton={false} render={<Link href={latestHref} />} className="rounded-full px-3">
        最新评论
      </ToggleGroupItem>
      <ToggleGroupItem value="new" nativeButton={false} render={<Link href={newHref} />} className="rounded-full px-3">
        最新帖子
      </ToggleGroupItem>
      <ToggleGroupItem value="featured" nativeButton={false} render={<Link href={featuredHref} />} className="rounded-full px-3">
        精华帖子
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
