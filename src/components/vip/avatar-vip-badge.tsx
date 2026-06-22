"use client"

import { useEffect, useRef } from "react"

import { VipLevelIcon } from "@/components/vip/vip-level-icon"
import { cn } from "@/lib/utils"

interface AvatarVipBadgeProps {
  level?: number | null
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
}

const badgeSizeClasses = {
  xs: "bottom-[-2px] right-[-2px] h-4 w-4",
  sm: "bottom-[-2px] right-[-2px] h-[18px] w-[18px]",
  md: "bottom-[-3px] right-[-3px] h-5 w-5",
  lg: "bottom-[-4px] right-[-4px] h-6 w-6",
  xl: "bottom-[-5px] right-[-5px] h-7 w-7",
  "2xl": "bottom-[-7px] right-[-7px] h-9 w-9",
}

const iconSizeClasses = {
  xs: "h-2 w-2 text-[10px]",
  sm: "h-2.5 w-2.5 text-[11px]",
  md: "h-3 w-3 text-[12px]",
  lg: "h-3.5 w-3.5 text-[14px]",
  xl: "h-4 w-4 text-[16px]",
  "2xl": "h-5 w-5 text-[18px]",
}

const SPIN_DEGREES_PER_MS = 360 / 1100
const EASING_TIME_MS = 180
const MIN_STOP_SPEED = 0.01

function getBadgeTone(level: number) {
  if (level >= 3) {
    return "text-amber-700"
  }

  if (level === 2) {
    return "text-rose-700"
  }

  return "text-violet-700"
}

export function AvatarVipBadge({ level = 1, size = "md" }: AvatarVipBadgeProps) {
  const normalizedLevel = Math.max(1, level ?? 1)
  const label = `VIP${normalizedLevel} 会员`
  const badgeRef = useRef<HTMLSpanElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const hoveredRef = useRef(false)
  const angleRef = useRef(0)
  const velocityRef = useRef(0)
  const lastTimestampRef = useRef<number | null>(null)

  useEffect(() => {
    const badge = badgeRef.current
    const hoverTarget = badge?.parentElement
    if (!badge || !hoverTarget) {
      return
    }
    const badgeElement = badge

    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    if (mediaQuery?.matches) {
      return
    }

    function applyRotation(angle: number) {
      badgeElement.style.transform = `rotate(${angle}deg)`
    }

    function stopLoop() {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      lastTimestampRef.current = null
    }

    function tick(timestamp: number) {
      const previousTimestamp = lastTimestampRef.current ?? timestamp
      const delta = Math.min(32, timestamp - previousTimestamp)
      lastTimestampRef.current = timestamp

      const targetVelocity = hoveredRef.current ? SPIN_DEGREES_PER_MS : 0
      const easingFactor = 1 - Math.exp(-delta / EASING_TIME_MS)
      const nextVelocity = velocityRef.current + (targetVelocity - velocityRef.current) * easingFactor
      velocityRef.current = nextVelocity
      angleRef.current = (angleRef.current + (nextVelocity * delta)) % 360
      applyRotation(angleRef.current)

      if (!hoveredRef.current && Math.abs(nextVelocity) <= MIN_STOP_SPEED) {
        velocityRef.current = 0
        stopLoop()
        return
      }

      frameRef.current = window.requestAnimationFrame(tick)
    }

    function ensureLoop() {
      if (frameRef.current !== null) {
        return
      }

      frameRef.current = window.requestAnimationFrame(tick)
    }

    function handlePointerEnter() {
      hoveredRef.current = true
      ensureLoop()
    }

    function handlePointerLeave() {
      hoveredRef.current = false
      if (velocityRef.current > 0) {
        ensureLoop()
      }
    }

    hoverTarget.addEventListener("pointerenter", handlePointerEnter)
    hoverTarget.addEventListener("pointerleave", handlePointerLeave)

    return () => {
      hoverTarget.removeEventListener("pointerenter", handlePointerEnter)
      hoverTarget.removeEventListener("pointerleave", handlePointerLeave)
      stopLoop()
      badgeElement.style.transform = ""
    }
  }, [])

  return (
    <span
      ref={badgeRef}
      className={cn(
        "pointer-events-auto absolute z-1 inline-flex items-center justify-center rounded-full will-change-transform",
        badgeSizeClasses[size],
        getBadgeTone(normalizedLevel),
      )}
      aria-label={label}
    >
      <VipLevelIcon level={normalizedLevel} className={iconSizeClasses[size]} />
    </span>
  )
}
