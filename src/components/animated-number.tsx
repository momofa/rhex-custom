"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

interface AnimatedNumberProps {
  value: number
  className?: string
  decimals?: number
  durationMs?: number
  prefix?: string
  suffix?: string
  signDisplay?: "auto" | "always" | "exceptZero" | "never"
  useGrouping?: boolean
}

function formatAnimatedNumber(value: number, options: Required<Pick<AnimatedNumberProps, "decimals" | "prefix" | "suffix" | "signDisplay" | "useGrouping">>) {
  const formatter = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: options.decimals,
    maximumFractionDigits: options.decimals,
    signDisplay: options.signDisplay,
    useGrouping: options.useGrouping,
  })

  return `${options.prefix}${formatter.format(value)}${options.suffix}`
}

export function AnimatedNumber({
  value,
  className,
  decimals = 0,
  durationMs = 900,
  prefix = "",
  suffix = "",
  signDisplay = "auto",
  useGrouping = true,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const frameRef = useRef<number | null>(null)
  const previousValueRef = useRef(0)

  useEffect(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
    }

    const startValue = previousValueRef.current
    const delta = value - startValue

    if (Math.abs(delta) < 0.001) {
      frameRef.current = window.requestAnimationFrame(() => {
        previousValueRef.current = value
        setDisplayValue(value)
        frameRef.current = null
      })
      return
    }

    const startAt = performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startAt) / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      const nextValue = startValue + delta * eased

      setDisplayValue(progress >= 1 ? value : nextValue)

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(tick)
        return
      }

      previousValueRef.current = value
      frameRef.current = null
    }

    frameRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [durationMs, value])

  return (
    <span className={cn(className)}>
      {formatAnimatedNumber(displayValue, {
        decimals,
        prefix,
        suffix,
        signDisplay,
        useGrouping,
      })}
    </span>
  )
}
