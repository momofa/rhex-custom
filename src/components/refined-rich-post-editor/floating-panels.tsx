"use client"

import React, { useRef, useState } from "react"

import { Popover, PopoverContent } from "@/components/ui/popover"
import type { FloatingPanelPosition } from "@/components/refined-rich-post-editor/types"

export function useFloatingPanel() {
  const [position, setPosition] = useState<FloatingPanelPosition | null>(null)
  const [isReady, setIsReady] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  return [position, setPosition, isReady, setIsReady, ref] as const
}

type FloatingEditorPanelProps = {
  open: boolean
  isClient: boolean
  disabled?: boolean
  anchorRef: React.RefObject<HTMLDivElement | null>
  position: FloatingPanelPosition | null
  ready: boolean
  panelRef: React.MutableRefObject<HTMLDivElement | null>
  className: string
  children: React.ReactNode
  onOpenChange?: (open: boolean) => void
}

export function FloatingEditorPanel({
  open,
  isClient,
  disabled = false,
  anchorRef,
  position,
  ready,
  panelRef,
  className,
  children,
  onOpenChange,
}: FloatingEditorPanelProps) {
  if (!isClient || disabled) {
    return null
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange} anchorRef={anchorRef}>
      <PopoverContent
        ref={panelRef}
        data-floating-ready={ready ? "true" : "false"}
        data-floating-left={position?.left}
        data-floating-top={position?.top}
        side="bottom"
        align="start"
        sideOffset={12}
        className={className}
        style={position ? { width: position.width, maxHeight: position.maxHeight } : undefined}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
