"use client"

import type { ReactNode } from "react"

import { Tooltip } from "@/components/ui/tooltip"
import { formatPreciseDateTime } from "@/lib/formatters"

interface TimeTooltipProps {
  value?: string | null
  children: ReactNode
}

export function TimeTooltip({ value, children }: TimeTooltipProps) {
  const formatted = value ? formatPreciseDateTime(value) : null

  if (!formatted) {
    return <>{children}</>
  }

  return <Tooltip content={formatted}>{children}</Tooltip>
}
