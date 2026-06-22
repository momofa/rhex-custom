"use client"

import Link from "next/link"
import { useState } from "react"
import { ImageIcon, ImageOff, MessageCircle, type LucideIcon } from "lucide-react"

import { LevelIcon } from "@/components/level-icon"
import { PostListLink } from "@/components/post/post-list-link"
import { getPostTitleClassName, PostAccessBadges, PostPinBadge, PostRewardPoolIcon, PostStatusBadge, PostTypeBadge } from "@/components/post/post-list-shared"
import { Skeleton } from "@/components/ui/skeleton"
import { TimeTooltip } from "@/components/time-tooltip"
import { Tooltip } from "@/components/ui/tooltip"
import { UserStatusBadge } from "@/components/user/user-status-badge"
import { VipNameTooltip } from "@/components/vip/vip-name-tooltip"
import { formatCompactNumber, formatNumber } from "@/lib/formatters"
import { getPostPath } from "@/lib/post-links"
import type { PostRewardPoolMode } from "@/lib/post-reward-pool-config"
import { cn } from "@/lib/utils"

interface PostGalleryGridProps {
  items: Array<{
    id: string
    slug: string
    title: string
    excerpt: string
    coverImage?: string | null
    typeLabel?: string
    type?: string
    status?: string
    statusLabel?: string
    reviewNote?: string | null
    pinScope?: string | null
    pinLabel?: string | null
    hasRedPacket?: boolean
    rewardMode?: PostRewardPoolMode
    minViewLevel?: number
    minViewVipLevel?: number
    isFeatured?: boolean
    boardName: string
    boardSlug?: string
    boardIcon?: string
    authorName: string
    authorUsername: string
    authorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
    authorIsVip?: boolean
    authorVipLevel?: number | null
    authorNameClassName?: string
    metaPrimary: string
    metaPrimaryRaw?: string
    metaSecondary?: string | null
    commentCount: number
    commentAccentColor: string
  }>
  showBoard?: boolean
  postLinkDisplayMode?: "SLUG" | "ID"
  showPinBadge?: boolean
}

function GalleryCoverPlaceholder({ label, icon: Icon = ImageIcon }: { label: string; icon?: LucideIcon }) {
  return (
    <div className="flex min-h-[154px] items-center justify-center bg-[linear-gradient(135deg,rgba(249,115,22,0.12),rgba(15,23,42,0.04))] px-3 py-[2.1rem] text-muted-foreground">
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-background/85 px-2.5 py-1 text-[13px] shadow-xs">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
    </div>
  )
}

function GalleryCoverImage({ src, title }: { src: string; title: string }) {
  const [hasLoadError, setHasLoadError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  if (hasLoadError) {
    return <GalleryCoverPlaceholder label="封面暂不可用" icon={ImageOff} />
  }

  return (
    <div className="relative min-h-[154px] overflow-hidden bg-secondary/40">
      {!imageLoaded ? <Skeleton aria-hidden="true" className="absolute inset-0 rounded-none" /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={title}
        title={title}
        className={cn("block h-auto w-full transition-opacity duration-300", imageLoaded ? "opacity-100" : "opacity-0")}
        loading="lazy"
        decoding="async"
        onLoad={() => setImageLoaded(true)}
        onError={() => {
          setHasLoadError(true)
          setImageLoaded(true)
        }}
      />
    </div>
  )
}

function PostGalleryCover({ coverImage, title }: { coverImage?: string | null; title: string }) {
  const normalizedCoverImage = coverImage?.trim() ?? ""

  if (!normalizedCoverImage) {
    return <GalleryCoverPlaceholder label="无封面图" />
  }

  return <GalleryCoverImage key={normalizedCoverImage} src={normalizedCoverImage} title={title} />
}

export function PostGalleryGrid({ items, showBoard = true, postLinkDisplayMode = "SLUG", showPinBadge = true }: PostGalleryGridProps) {
  return (
    <div className="post-gallery-grid px-1.5 py-1.5 sm:px-2">
      {items.map((item) => {
        const postPath = getPostPath({ id: item.id, slug: item.slug }, { mode: postLinkDisplayMode })
        const isRestrictedAuthor = item.authorStatus === "BANNED" || item.authorStatus === "MUTED"

        return (
          <article key={item.id} className="post-gallery-card overflow-hidden rounded-[17px] border border-border bg-card transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-xs">
            <PostListLink href={postPath} className="block">
              <PostGalleryCover coverImage={item.coverImage} title={item.title} />
            </PostListLink>

            <div className="space-y-2 p-[0.7rem]">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 overflow-hidden">
                    <PostListLink href={postPath} visitedPath={postPath} dimWhenRead className="min-w-0 flex-1" title={item.title}>
                      <h2 className={getPostTitleClassName({ isFeatured: item.isFeatured, pinScope: item.pinScope, singleLine: true, compact: true })}>
                        {item.title}
                      </h2>
                    </PostListLink>
                    {item.hasRedPacket ? (
                      <Tooltip content={item.rewardMode === "JACKPOT" ? "聚宝盆帖" : "红包帖"}>
                        <span className="shrink-0" aria-label={item.rewardMode === "JACKPOT" ? "聚宝盆帖" : "红包帖"}>
                          <PostRewardPoolIcon mode={item.rewardMode} className="h-3.5 w-3.5" />
                        </span>
                      </Tooltip>
                    ) : null}
                    <PostAccessBadges minViewLevel={item.minViewLevel} minViewVipLevel={item.minViewVipLevel} compact />
                  </div>

                  <div className="mt-1.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
                    {showPinBadge ? <PostPinBadge scope={item.pinScope} label={item.pinLabel} compact className="shrink-0" /> : null}
                  </div>

                  <div className={cn("mt-2 flex min-w-0 items-center gap-1 overflow-hidden text-[11px] text-muted-foreground", isRestrictedAuthor && "grayscale")}>
                    {showBoard && item.boardSlug ? (
                      <>
                        <Link href={`/boards/${item.boardSlug}`} className="flex min-w-0 max-w-[40%] items-center gap-1 font-medium hover:underline" title={item.boardName}>
                          <LevelIcon icon={item.boardIcon} className="h-3 w-3 shrink-0 text-[11px]" svgClassName="[&>svg]:block" />
                          <span className="truncate">{item.boardName}</span>
                        </Link>
                        <span className="shrink-0">•</span>
                      </>
                    ) : null}
                    <VipNameTooltip isVip={item.authorIsVip} level={item.authorVipLevel}>
                      <Link href={`/users/${item.authorUsername}`} className={cn("min-w-0 shrink truncate", item.authorNameClassName ?? "hover:underline")} title={item.authorName}>
                        {item.authorName}
                      </Link>
                    </VipNameTooltip>
                    {isRestrictedAuthor ? <UserStatusBadge status={item.authorStatus} compact /> : null}
                    <span className="shrink-0">•</span>
                    <TimeTooltip value={item.metaPrimaryRaw}>
                      <span className="truncate">{item.metaPrimary}</span>
                    </TimeTooltip>
                    {item.metaSecondary ? (
                      <>
                        <span className="shrink-0">·</span>
                        <span className="truncate" title={item.metaSecondary}>{item.metaSecondary}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5 self-center">
                  <PostListLink href={`${postPath}#comments`} title={`${formatNumber(item.commentCount)} 回复`} className="inline-flex items-center gap-1 rounded-full px-2 py-[0.2rem] text-[10px] font-medium tabular-nums" style={{ backgroundColor: `${item.commentAccentColor}14`, color: item.commentAccentColor }}>
                    <MessageCircle className="h-3 w-3" />
                    {formatCompactNumber(item.commentCount)}
                  </PostListLink>
                  {item.isFeatured ? <span className="rounded-full bg-emerald-100 px-2 py-[0.2rem] text-[10px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">精华</span> : null}
                  <PostStatusBadge status={item.status} label={item.statusLabel} reviewNote={item.reviewNote} compact />
                  <PostTypeBadge type={item.type} label={item.typeLabel} compact mobileIconOnly />
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
