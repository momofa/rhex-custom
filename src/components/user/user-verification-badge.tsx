import Link from "next/link"

import { LevelIcon } from "@/components/level-icon"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface UserVerificationBadgeItem {
  id: string
  slug?: string | null
  name: string
  color: string
  iconText?: string | null
  customIconText?: string | null
  description?: string | null
  customDescription?: string | null
}

interface UserVerificationBadgeProps {
  verification?: UserVerificationBadgeItem | null
  username?: string | null
  compact?: boolean
  className?: string
  iconClassName?: string
  appearance?: "outlined" | "plain"
}

export function UserVerificationBadge({ verification, username, compact = false, className, iconClassName, appearance = "outlined" }: UserVerificationBadgeProps) {
  if (!verification) {
    return null
  }

  const effectiveIcon = verification.customIconText?.trim() || verification.iconText
  const tooltipContent = verification.customDescription?.trim()
    ? `${verification.customDescription.trim()}`
    : verification.description?.trim() || verification.name
  const normalizedSlug = verification.slug?.trim()
  const normalizedUsername = username?.trim()
  const href = normalizedSlug
    ? normalizedUsername
      ? `/verifications/${normalizedSlug}?user=${encodeURIComponent(normalizedUsername)}`
      : `/verifications/${normalizedSlug}`
    : null
  const wrapperClassName = cn(
    "inline-flex items-center justify-center align-middle",
    appearance === "outlined" ? "rounded-full border" : "rounded-none border-none bg-transparent",
    compact ? "h-5 min-w-5" : "h-6 min-w-6",
    href && "transition-opacity hover:opacity-80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/60",
    className,
  )
  const wrapperStyle = appearance === "outlined"
    ? {
        color: verification.color,
        borderColor: `${verification.color}55`,
        backgroundColor: `${verification.color}12`,
      }
    : {
        color: verification.color,
      }
  const icon = (
    <LevelIcon
      icon={effectiveIcon}
      color={verification.color}
      className={cn(compact ? "h-5 min-w-5 text-[12px]" : "h-3.5 min-w-3.5 text-[14px]", iconClassName)}
      emojiClassName="text-inherit"
      svgClassName="[&>svg]:block"
    />
  )

  return (
    <Tooltip content={tooltipContent}>
      {href ? (
        <Link
          href={href}
          className={wrapperClassName}
          aria-label={`${tooltipContent}，查看认证介绍`}
          style={wrapperStyle}
        >
          {icon}
        </Link>
      ) : (
        <span
          className={wrapperClassName}
          aria-label={tooltipContent}
          style={wrapperStyle}
        >
          {icon}
        </span>
      )}
    </Tooltip>
  )
}
