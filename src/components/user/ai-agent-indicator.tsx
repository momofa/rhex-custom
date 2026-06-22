"use client"

import Image from "next/image"

import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface AiAgentIndicatorProps {
  className?: string
  iconClassName?: string
  label?: string
}

export function AiAgentIndicator({
  className,
  iconClassName,
  label = "社区AI Bot",
}: AiAgentIndicatorProps) {
  return (
    <Tooltip content={label}>
      <span className={cn("inline-flex shrink-0 items-center", className)} aria-label={label}>
        <Image
          src="/apps/icon/ai.svg"
          alt={label}
          width={16}
          height={16}
          className={cn("h-4 w-4", iconClassName)}
        />
      </span>
    </Tooltip>
  )
}
