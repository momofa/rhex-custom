"use client"

import Image from "next/image"
import { Coins, Gavel, Gift, Pin, Vote, type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Tooltip } from "@/components/ui/tooltip"
import type { PostRewardPoolMode } from "@/lib/post-reward-pool-config"
import { cn } from "@/lib/utils"

type PostTypeBadgeVariant = "auction" | "lottery" | "poll" | "bounty"

const postTypeBadgeMap = {
  AUCTION: {
    icon: Gavel,
    variant: "auction",
  },
  LOTTERY: {
    icon: Gift,
    variant: "lottery",
  },
  POLL: {
    icon: Vote,
    variant: "poll",
  },
  BOUNTY: {
    icon: Coins,
    variant: "bounty",
  },
} satisfies Record<string, { icon: LucideIcon; variant: PostTypeBadgeVariant }>

const postPinBadgeMap = {
  GLOBAL: {
    icon: Pin,
    label: "全局置顶",
    variant: "pinGlobal",
  },
  ZONE: {
    icon: Pin,
    label: "分区置顶",
    variant: "pinZone",
  },
  BOARD: {
    icon: Pin,
    label: "节点置顶",
    variant: "pinBoard",
  },
} satisfies Record<string, { icon: LucideIcon; label: string; variant: "pinGlobal" | "pinZone" | "pinBoard" }>

export function getPostPinTone(pinScope?: string | null, compact = false) {
  const badgeSizeClassName = compact
    ? "px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-[11px]"
    : "px-2 py-0.5 text-[11px] sm:px-2.5 sm:py-1 sm:text-xs"

  if (pinScope === "GLOBAL") {
    return {
      titleColorClassName: "text-red-700 hover:text-red-600 dark:text-red-300 dark:hover:text-red-200",
      badgeClassName: `rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200 ${badgeSizeClassName}`,
    }
  }

  if (pinScope === "ZONE") {
    return {
      titleColorClassName: "text-orange-700 hover:text-orange-600 dark:text-orange-300 dark:hover:text-orange-200",
      badgeClassName: `rounded-full bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200 ${badgeSizeClassName}`,
    }
  }

  if (pinScope === "BOARD") {
    return {
      titleColorClassName: "text-amber-700 hover:text-amber-600 dark:text-amber-300 dark:hover:text-amber-200",
      badgeClassName: `rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 ${badgeSizeClassName}`,
    }
  }

  return null
}

export function getPostTitleClassName(options: { isFeatured?: boolean; pinScope?: string | null; singleLine?: boolean; compact?: boolean }) {
  const pinTone = getPostPinTone(options.pinScope)
  const lineClampClassName = options.singleLine ? "truncate whitespace-nowrap" : "line-clamp-2"
  const sizeClassName = options.compact ? "text-[0.9rem] sm:text-[0.933rem]" : "text-sm sm:text-base"

  if (options.isFeatured) {
    return `${lineClampClassName} ${sizeClassName} font-semibold text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200`
  }

  if (pinTone) {
    return `${lineClampClassName} ${sizeClassName} font-semibold transition-colors ${pinTone.titleColorClassName}`
  }

  return `${lineClampClassName} ${sizeClassName} font-medium text-foreground transition-colors hover:text-primary`
}

export function PostTypeBadge({
  type,
  label,
  compact = false,
  mobileIconOnly = false,
  className,
}: {
  type?: string | null
  label?: string | null
  compact?: boolean
  mobileIconOnly?: boolean
  className?: string
}) {
  if (!type || type === "NORMAL" || !label) {
    return null
  }

  const config = type in postTypeBadgeMap
    ? postTypeBadgeMap[type as keyof typeof postTypeBadgeMap]
    : null

  if (!config) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "rounded-full text-muted-foreground",
          compact ? "px-1.5 text-[10px] sm:px-2 sm:text-[11px]" : "px-2 sm:px-2.5",
          className,
        )}
      >
        {label}
      </Badge>
    )
  }

  const Icon = config.icon

  return (
    <Badge
      variant={config.variant}
      aria-label={label}
      className={cn(
        "rounded-full",
        mobileIconOnly
          ? "size-5 p-0 sm:w-fit sm:px-2 sm:py-0.5 sm:text-[11px]"
          : compact ? "px-1.5 text-[10px] sm:px-2 sm:text-[11px]" : "px-2 sm:px-2.5",
        className,
      )}
    >
      <Icon {...(mobileIconOnly ? {} : { "data-icon": "inline-start" })} />
      <span className={mobileIconOnly ? "hidden sm:inline" : undefined}>{label}</span>
    </Badge>
  )
}

export function PostStatusBadge({
  status,
  label,
  reviewNote,
  compact = false,
  className,
}: {
  status?: string | null
  label?: string | null
  reviewNote?: string | null
  compact?: boolean
  className?: string
}) {
  if (!status || status === "NORMAL") {
    return null
  }

  const resolvedLabel = label?.trim() || (status === "PENDING" ? "待审核" : status === "OFFLINE" ? "已下线" : status === "LOCKED" ? "已关闭回复" : status)
  const note = reviewNote?.trim()
  const toneClassName = status === "PENDING"
    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
    : status === "OFFLINE"
      ? "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-200"
      : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200"

  return (
    <Tooltip content={note ? `${resolvedLabel}：${note}` : resolvedLabel}>
      <Badge
        variant="outline"
        className={cn(
          "rounded-full font-medium",
          compact ? "px-1.5 text-[10px] sm:px-2 sm:text-[11px]" : "px-2 sm:px-2.5",
          toneClassName,
          className,
        )}
      >
        {resolvedLabel}
      </Badge>
    </Tooltip>
  )
}

export function PostPinBadge({
  scope,
  label,
  compact = false,
  className,
}: {
  scope?: string | null
  label?: string | null
  compact?: boolean
  className?: string
}) {
  if (!scope) {
    return null
  }

  const config = scope in postPinBadgeMap
    ? postPinBadgeMap[scope as keyof typeof postPinBadgeMap]
    : null

  if (!config) {
    return null
  }

  const Icon = config.icon
  const tooltipLabel = label?.trim() || config.label

  return (
    <Tooltip content={tooltipLabel}>
      <Badge
        variant={config.variant}
        aria-label={tooltipLabel}
        className={cn("rounded-full", compact ? "size-5 p-0" : "size-6 p-0", className)}
      >
        <Icon />
      </Badge>
    </Tooltip>
  )
}

export function PostRewardPoolIcon({
  className,
  mode = "RED_PACKET",
}: {
  className?: string
  mode?: PostRewardPoolMode
}) {
  const src = mode === "JACKPOT" ? "/apps/redpacked/jbp.svg" : "/apps/redpacked/hb.svg"
  const alt = mode === "JACKPOT" ? "聚宝盆" : "红包"

  return (
    <Image
      src={src}
      alt={alt}
      width={16}
      height={16}
      unoptimized
      className={cn("h-4 w-4", className)}
    />
  )
}

export function PostAccessBadges({
  minViewLevel,
  minViewVipLevel,
  compact = false,
}: {
  minViewLevel?: number | null
  minViewVipLevel?: number | null
  compact?: boolean
}) {
  const hasLevelLimit = Boolean(minViewLevel && minViewLevel > 0)
  const hasVipLimit = Boolean(minViewVipLevel && minViewVipLevel > 0)

  if (!hasLevelLimit && !hasVipLimit) {
    return null
  }

  return (
    <div className="inline-flex items-center gap-1">
      {hasLevelLimit ? (
        <Tooltip content={`访问需要至少 Lv.${minViewLevel}`}>
          <span
            aria-label={`访问需要至少 Lv.${minViewLevel}`}
            className={cn(
              "inline-flex shrink-0 rounded-full from-red-500 via-rose-500 to-orange-500 font-semibold tracking-[0.08em] text-white",
              compact ? "px-1 py-0.5 text-[9px] sm:px-1.5 sm:text-[10px]" : "px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-[11px]",
            )}
          >
            <svg className="h-4 w-4" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="14255" width="200" height="200"><path d="M780.8 977.066667c41.813333 0 75.093333-33.28 75.093333-75.093334V122.026667c0-41.813333 33.28-75.093333 75.093334-75.093334h-699.733334c-41.813333 0-75.093333 33.28-75.093333 75.093334v855.893333h624.64z" fill="#FFFFFF" p-id="14256"></path><path d="M931.84 46.933333c-41.813333 0-75.093333 33.28-75.093333 75.093334v104.106666H1006.933333V122.026667c0-41.813333-34.133333-75.093333-75.093333-75.093334zM794.453333 976.213333H93.866667c-41.813333 0-75.093333-33.28-75.093334-75.093333v-46.08h700.586667v46.08c0 41.813333 34.133333 75.093333 75.093333 75.093333zM505.173333 735.573333c-93.013333 0-168.106667-53.76-168.106666-146.773333v59.733333c0 93.013333 75.093333 146.773333 168.106666 146.773334 93.013333 0 168.106667-53.76 168.106667-146.773334v-59.733333c0 92.16-75.093333 146.773333-168.106667 146.773333zM723.626667 164.693333c0 13.653333-11.946667 25.6-25.6 25.6H312.32c-14.506667 0-25.6-11.946667-25.6-25.6s11.093333-25.6 25.6-25.6h385.706667c13.653333 0 25.6 11.093333 25.6 25.6z" fill="#C7CAC7" p-id="14257"></path><path d="M674.133333 465.92v122.026667c0 93.013333-75.093333 146.773333-168.106666 146.773333-93.013333 0-168.106667-53.76-168.106667-146.773333V465.92H674.133333z" fill="#F65D4F" p-id="14258"></path><path d="M506.026667 564.906667m-40.106667 0a40.106667 40.106667 0 1 0 80.213333 0 40.106667 40.106667 0 1 0-80.213333 0Z" fill="#FFFFFF" p-id="14259"></path><path d="M931.84 38.4H231.253333c-46.08 0-83.626667 37.546667-83.626666 83.626667v725.333333h-128c-5.12 0-8.533333 3.413333-8.533334 8.533333v46.08c0 46.08 37.546667 83.626667 83.626667 83.626667h58.026667c0.853333 0.853333 2.56 0.853333 3.413333 0.853333h625.493333c3.413333 0 7.68 0 11.093334-0.853333h2.56c1.706667 0 2.56-0.853333 4.266666-0.853333 37.546667-7.68 65.706667-41.813333 65.706667-81.92V233.813333H1006.933333c5.12 0 8.533333-3.413333 8.533334-8.533333V122.026667c0-46.08-37.546667-83.626667-83.626667-83.626667zM164.693333 967.68H93.866667c-36.693333 0-66.56-29.866667-66.56-66.56v-37.546667h683.52v37.546667c0 27.306667 12.8 51.2 33.28 66.56H164.693333z m682.666667-65.706667c0 33.28-23.893333 60.586667-56.32 65.706667-34.986667-1.706667-64-30.72-64-66.56v-46.08c0-5.12-3.413333-8.533333-8.533333-8.533333H164.693333v-725.333334c0-36.693333 29.866667-66.56 66.56-66.56h650.24l-0.853333 0.853334c-1.706667 0.853333-2.56 2.56-4.266667 3.413333-0.853333 0.853333-1.706667 1.706667-2.56 1.706667l-5.12 5.12c0 0.853333-0.853333 0.853333-0.853333 1.706666-1.706667 2.56-3.413333 4.266667-5.12 6.826667-0.853333 0.853333-0.853333 1.706667-1.706667 2.56-0.853333 1.706667-2.56 3.413333-3.413333 5.12-0.853333 0.853333-0.853333 1.706667-1.706667 2.56l-2.56 5.12c-0.853333 0.853333-0.853333 2.56-0.853333 3.413333-0.853333 1.706667-0.853333 3.413333-1.706667 5.12 0 0.853333-0.853333 2.56-0.853333 3.413334-0.853333 1.706667-0.853333 4.266667-0.853333 5.973333 0 0.853333 0 1.706667-0.853334 2.56 0 3.413333-0.853333 5.973333-0.853333 9.386667v782.506666zM998.4 216.746667h-133.12V122.026667c0-36.693333 29.866667-66.56 66.56-66.56s66.56 29.866667 66.56 66.56v94.72z" p-id="14260"></path><path d="M674.133333 457.386667h-29.013333v-53.76c0-76.8-62.293333-139.946667-139.946667-139.946667-76.8 0-139.946667 62.293333-139.946666 139.946667v53.76h-29.013334c-5.12 0-8.533333 3.413333-8.533333 8.533333v122.026667c0 91.306667 72.533333 155.306667 176.64 155.306666s176.64-64 176.64-155.306666V465.92c1.706667-5.12-1.706667-8.533333-6.826667-8.533333z m-290.986666-53.76c0-67.413333 54.613333-122.88 122.88-122.88s122.88 54.613333 122.88 122.88v53.76H597.333333v-53.76c0-50.346667-40.96-91.306667-91.306666-91.306667-50.346667 0-91.306667 40.96-91.306667 91.306667v53.76H384v-53.76z m197.12 0v53.76H431.786667v-53.76c0-40.96 33.28-74.24 74.24-74.24s74.24 32.426667 74.24 74.24z m85.333333 184.32c0 69.12-49.493333 138.24-159.573333 138.24-110.08 0-159.573333-69.12-159.573334-138.24V474.453333H665.6v113.493334z" p-id="14261"></path><path d="M506.026667 516.266667c-27.306667 0-48.64 22.186667-48.64 48.64 0 23.893333 17.066667 43.52 40.106666 47.786666v46.933334c0 5.12 3.413333 8.533333 8.533334 8.533333s8.533333-3.413333 8.533333-8.533333v-46.933334C537.6 608.426667 554.666667 588.8 554.666667 564.906667c0-27.306667-22.186667-48.64-48.64-48.64z m0 80.213333c-17.066667 0-31.573333-14.506667-31.573334-31.573333s14.506667-31.573333 31.573334-31.573334 31.573333 14.506667 31.573333 31.573334-14.506667 31.573333-31.573333 31.573333zM582.826667 173.226667h17.066666c5.12 0 8.533333-3.413333 8.533334-8.533334s-3.413333-8.533333-8.533334-8.533333h-17.066666c-5.12 0-8.533333 3.413333-8.533334 8.533333s3.413333 8.533333 8.533334 8.533334zM497.493333 173.226667h17.066667c5.12 0 8.533333-3.413333 8.533333-8.533334s-3.413333-8.533333-8.533333-8.533333h-17.066667c-5.12 0-8.533333 3.413333-8.533333 8.533333s3.413333 8.533333 8.533333 8.533334zM352.426667 164.693333c0-5.12-3.413333-8.533333-8.533334-8.533333h-17.066666c-5.12 0-8.533333 3.413333-8.533334 8.533333s3.413333 8.533333 8.533334 8.533334h17.066666c5.12 0 8.533333-4.266667 8.533334-8.533334zM685.226667 156.16h-17.066667c-5.12 0-8.533333 3.413333-8.533333 8.533333s3.413333 8.533333 8.533333 8.533334h17.066667c5.12 0 8.533333-3.413333 8.533333-8.533334s-3.413333-8.533333-8.533333-8.533333zM412.16 173.226667h17.066667c5.12 0 8.533333-3.413333 8.533333-8.533334s-3.413333-8.533333-8.533333-8.533333h-17.066667c-5.12 0-8.533333 3.413333-8.533333 8.533333s3.413333 8.533333 8.533333 8.533334z" p-id="14262"></path></svg>
          </span>
        </Tooltip>
      ) : null}
      {hasVipLimit ? (
        <Tooltip content={`访问需要至少 VIP ${minViewVipLevel}`}>
          <span
            aria-label={`访问需要至少 VIP ${minViewVipLevel}`}
            className={cn(
              "inline-flex shrink-0 rounded-full from-amber-500 via-orange-500 to-yellow-500 font-semibold tracking-[0.08em] text-white",
              compact ? "px-1 py-0.5 text-[9px] sm:px-1.5 sm:text-[10px]" : "px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-[11px]",
            )}
          >
          <svg className="h-4 w-4" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="12217" width="200" height="200"><path d="M0 0h1024v1024H0V0z" fill="#202425" opacity=".01" p-id="12218"></path><path d="M743.867733 102.4a17.066667 17.066667 0 0 1 12.049067 4.983467l256.750933 256.750933a17.066667 17.066667 0 0 1 0.7168 23.3472L524.8 941.226667a17.066667 17.066667 0 0 1-25.6 0L10.615467 387.4816a17.066667 17.066667 0 0 1 0.7168-23.3472l256.750933-256.750933A17.066667 17.066667 0 0 1 280.132267 102.4h463.735466z" fill="#11AA66" p-id="12219"></path><path d="M499.165867 360.789333L278.016 108.066133A3.413333 3.413333 0 0 1 280.576 102.4h462.848a3.413333 3.413333 0 0 1 2.56 5.666133l-221.149867 252.7232a17.066667 17.066667 0 0 1-25.668266 0z" fill="#FFAA44" p-id="12220"></path><path d="M250.606933 383.8976a34.133333 34.133333 0 0 1 48.128 3.242667L512 630.852267l213.230933-243.712a34.133333 34.133333 0 0 1 51.4048 44.919466l-238.933333 273.066667a34.133333 34.133333 0 0 1-51.4048 0l-238.933333-273.066667a34.133333 34.133333 0 0 1 3.242666-48.128z" fill="#FFFFFF" p-id="12221"></path></svg>
          </span>
        </Tooltip>
      ) : null}
    </div>
  )
}
