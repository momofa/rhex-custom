"use client"

import Image from "next/image"
import { useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { AvatarVipBadge } from "@/components/vip/avatar-vip-badge"
import { getAvatarColor, getAvatarFallback, getAvatarUrl } from "@/lib/avatar"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
  name: string
  avatarPath?: string | null
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
  isVip?: boolean
  vipLevel?: number | null
}

const sizeClasses = {
  xs: "size-7",
  sm: "size-9",
  md: "size-11",
  lg: "size-16",
  xl: "size-20",
  "2xl": "size-28",
}

const fallbackSizeClasses = {
  xs: "text-[11px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
}

function AvatarImage({
  avatarUrl,
  name,
  size,
  onLoad,
  onError,
}: {
  avatarUrl: string
  name: string
  size: UserAvatarProps["size"]
  onLoad?: () => void
  onError?: () => void
}) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)

  if (imageFailed) {
    return null
  }

  return (
    <>
      <Image
        src={avatarUrl}
        alt={name}
        fill
        sizes={size === "2xl" ? "112px" : size === "xl" ? "80px" : size === "lg" ? "64px" : size === "md" ? "44px" : size === "sm" ? "36px" : "32px"}
        className={cn(
          "object-cover transition-[transform,opacity] duration-300 ease-out group-hover/avatar:scale-[1.06]",
          imageLoaded ? "opacity-100" : "opacity-0",
        )}
        unoptimized
        onLoad={() => {
          setImageLoaded(true)
          onLoad?.()
        }}
        onError={() => {
          setImageFailed(true)
          setImageLoaded(true)
          onError?.()
        }}
      />
      {!imageLoaded ? <Skeleton aria-hidden="true" className="absolute inset-0 rounded-[inherit]" /> : null}
    </>
  )
}

export function UserAvatar({ name, avatarPath, size = "md", isVip = false, vipLevel }: UserAvatarProps) {
  const hasCustomAvatar = Boolean(avatarPath?.trim())
  const avatarUrl = getAvatarUrl(avatarPath, name)
  const fallback = getAvatarFallback(name)
  const colors = getAvatarColor(name)
  const showVipBadge = isVip && Boolean(vipLevel && vipLevel > 0)
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null)
  const imageFailed = hasCustomAvatar && failedAvatarUrl === avatarUrl
  const showTextFallback = !hasCustomAvatar || imageFailed

  return (
    <div className={cn("group/avatar relative aspect-square shrink-0", sizeClasses[size])}>
      <div className="relative h-full w-full overflow-hidden rounded-xl border border-border bg-card transition-[transform,box-shadow,border-color] duration-200 ease-out group-hover/avatar:-translate-y-0.5 group-hover/avatar:border-foreground/15 group-hover/avatar:shadow-[0_10px_24px_rgba(15,23,42,0.12)] dark:group-hover/avatar:shadow-[0_10px_28px_rgba(0,0,0,0.32)]" style={{ backgroundColor: colors.background, color: colors.foreground }}>
        {showTextFallback ? (
          <div className={cn("flex h-full w-full items-center justify-center font-semibold tracking-wide transition-transform duration-300 ease-out group-hover/avatar:scale-[1.03]", fallbackSizeClasses[size])}>
            {fallback}
          </div>
        ) : null}
        {hasCustomAvatar ? (
          <AvatarImage
            key={avatarUrl}
            avatarUrl={avatarUrl}
            name={name}
            size={size}
            onError={() => setFailedAvatarUrl(avatarUrl)}
          />
        ) : null}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_42%,rgba(15,23,42,0.08))] opacity-0 transition-opacity duration-200 group-hover/avatar:opacity-100 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_42%,rgba(15,23,42,0.18))]" />
      </div>
      {showVipBadge ? <AvatarVipBadge level={vipLevel} size={size} /> : null}
    </div>
  )
}
