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
  className?: string
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
          "object-cover transition-opacity duration-200 ease-out",
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

export function UserAvatar({ name, avatarPath, size = "md", className, isVip = false, vipLevel }: UserAvatarProps) {
  const hasCustomAvatar = Boolean(avatarPath?.trim())
  const avatarUrl = getAvatarUrl(avatarPath, name)
  const fallback = getAvatarFallback(name)
  const colors = getAvatarColor(name)
  const showVipBadge = isVip && Boolean(vipLevel && vipLevel > 0)
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null)
  const imageFailed = hasCustomAvatar && failedAvatarUrl === avatarUrl
  const showTextFallback = !hasCustomAvatar || imageFailed

  return (
    <div className={cn("group/avatar relative aspect-square shrink-0", sizeClasses[size], className)}>
      <div className="relative h-full w-full overflow-hidden rounded-xl bg-card" style={{ backgroundColor: colors.background, color: colors.foreground }}>
        {showTextFallback ? (
          <div className={cn("flex h-full w-full items-center justify-center font-semibold tracking-wide", fallbackSizeClasses[size])}>
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
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.10)]" />
      </div>
      {showVipBadge ? <AvatarVipBadge level={vipLevel} size={size} /> : null}
    </div>
  )
}
