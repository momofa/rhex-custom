"use client"

import { createPortal } from "react-dom"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"

import { PostRewardPoolIcon } from "@/components/post/post-list-shared"
import {
  DEFAULT_BROWSING_PREFERENCES,
  readBrowsingPreferencesSnapshot,
  subscribeBrowsingPreferences,
} from "@/lib/browsing-preferences"
import { formatCompactNumber, formatCompactPointValue } from "@/lib/formatters"
import type { PostRedPacketSummary } from "@/lib/post-red-packets"
import { cn } from "@/lib/utils"

const INTRO_DISPLAY_MS = 2000
const INTRO_SHRINK_MS = 850
const INTRO_START_SIZE = 196

interface RectSnapshot {
  top: number
  left: number
  width: number
  height: number
}

interface PostRewardPoolIntroAnimationProps {
  postId: string
  summary: PostRedPacketSummary
}

function shouldPlayRewardPoolIntro(summary: PostRedPacketSummary) {
  if (!summary.enabled) {
    return false
  }

  if (summary.rewardMode === "JACKPOT") {
    return summary.remainingPoints > 0
  }

  return summary.remainingCount > 0 && summary.remainingPoints > 0
}

function buildCenteredRect(): RectSnapshot {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const size = Math.min(INTRO_START_SIZE, Math.max(156, Math.floor(viewportWidth * 0.42)))

  return {
    width: size,
    height: size,
    left: Math.max(16, Math.round((viewportWidth - size) / 2)),
    top: Math.max(48, Math.round((viewportHeight - size) / 2) - 28),
  }
}

function readRewardPoolTriggerRect(postId: string): RectSnapshot | null {
  const triggerIcon = document.querySelector<HTMLElement>(`[data-post-reward-pool-trigger-icon="${postId}"]`)
  const trigger = triggerIcon ?? document.querySelector<HTMLElement>(`[data-post-reward-pool-trigger="${postId}"]`)
  if (!trigger) {
    return null
  }

  const rect = trigger.getBoundingClientRect()
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }
}

export function PostRewardPoolIntroAnimation({ postId, summary }: PostRewardPoolIntroAnimationProps) {
  const browsingPreferences = useSyncExternalStore(
    subscribeBrowsingPreferences,
    readBrowsingPreferencesSnapshot,
    () => DEFAULT_BROWSING_PREFERENCES,
  )
  const rewardPoolIntroAnimationMode = browsingPreferences.rewardPoolIntroAnimationMode
  const shouldShowIntro = shouldPlayRewardPoolIntro(summary) && rewardPoolIntroAnimationMode !== "never"
  const [visible, setVisible] = useState(false)
  const [shrinking, setShrinking] = useState(false)
  const [currentRect, setCurrentRect] = useState<RectSnapshot | null>(null)

  const introCopy = useMemo(() => {
    if (summary.rewardMode === "JACKPOT") {
      return {
        title: "聚宝盆已开启",
        value: `${formatCompactPointValue(summary.remainingPoints)} ${summary.pointName}`,
        description: "盆里当前积分",
      }
    }

    return {
      title: "红包已挂上",
      value: `${formatCompactNumber(summary.remainingCount)} 个`,
      description: "当前剩余红包",
    }
  }, [summary])

  useEffect(() => {
    if (!shouldShowIntro) {
      return
    }
    try{
    if(window.location.search !=='' && window.location.search !=='?view=flat') {
          return
        }
      }catch{
        // Ignore storage failures and continue showing the animation once per mount.

      }

    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    if (mediaQuery?.matches) {
      return
    }

    if (rewardPoolIntroAnimationMode === "once-per-tab") {
      const storageKey = `post-reward-pool-intro:${postId}`
      try {
        if (window.sessionStorage.getItem(storageKey) === "done") {
          return
        }
        window.sessionStorage.setItem(storageKey, "done")
      } catch {
        // Ignore storage failures and continue showing the animation once per mount.
      }
    }

    let attempts = 0
    let setupTimer: number | null = null
    let closeTimer: number | null = null
    let rafId: number | null = null

    const tryStart = () => {
      const triggerRect = readRewardPoolTriggerRect(postId)
      if (!triggerRect && attempts < 24) {
        attempts += 1
        rafId = window.requestAnimationFrame(tryStart)
        return
      }

      setShrinking(false)
      setCurrentRect(buildCenteredRect())
      setVisible(true)

      setupTimer = window.setTimeout(() => {
        const nextTargetRect = readRewardPoolTriggerRect(postId)
        if (nextTargetRect) {
          setCurrentRect(nextTargetRect)
        }
        setShrinking(true)
      }, INTRO_DISPLAY_MS)

      closeTimer = window.setTimeout(() => {
        setVisible(false)
        setShrinking(false)
        setCurrentRect(null)
      }, INTRO_DISPLAY_MS + INTRO_SHRINK_MS)
    }

    rafId = window.requestAnimationFrame(tryStart)

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
      if (setupTimer !== null) {
        window.clearTimeout(setupTimer)
      }
      if (closeTimer !== null) {
        window.clearTimeout(closeTimer)
      }
      setVisible(false)
      setShrinking(false)
      setCurrentRect(null)
    }
  }, [postId, rewardPoolIntroAnimationMode, shouldShowIntro, summary])

  if (!shouldShowIntro || !visible || !currentRect) {
    return null
  }

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-80"
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_48%)]"
      />
      <div
        className="absolute"
        style={{
          top: currentRect.top,
          left: currentRect.left,
          width: currentRect.width,
          height: currentRect.height,
          transition: `all ${INTRO_SHRINK_MS}ms cubic-bezier(0.2, 0.9, 0.2, 1)`,
        }}
      >
        <div className="relative h-full w-full">
          <span
            className={cn(
              "absolute inset-[-24%] rounded-full bg-[radial-gradient(circle,rgba(255,223,128,0.65)_0%,rgba(255,181,71,0.28)_38%,rgba(255,181,71,0.08)_58%,transparent_72%)] blur-md transition-all duration-700",
              shrinking && "inset-0 opacity-0",
            )}
          />
          <span
            className={cn(
              "absolute inset-[-12%] rounded-full border border-amber-200/60 opacity-80 shadow-[0_0_48px_rgba(255,193,93,0.42)] transition-all duration-700",
              shrinking && "inset-[22%] opacity-0",
            )}
          />

          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center rounded-full border border-amber-100/70 bg-background/90 text-center shadow-[0_24px_80px_-26px_rgba(245,158,11,0.7)] backdrop-blur-md transition-all duration-700",
              shrinking && "scale-75 border-transparent bg-background/0 shadow-none",
            )}
          >
            <div
              className={cn(
                "flex h-[44%] w-[44%] items-center justify-center rounded-full bg-linear-to-br from-amber-50 via-white to-orange-50 shadow-inner transition-all duration-700",
                shrinking && "h-full w-full rounded-full bg-transparent shadow-none",
              )}
            >
              <PostRewardPoolIcon mode={summary.rewardMode} className={cn("h-14 w-14 transition-all duration-700", shrinking && "h-5 w-5")} />
            </div>

            <div
              className={cn(
                "mt-4 space-y-1 px-3 transition-all duration-200",
                shrinking && "pointer-events-none absolute opacity-0",
              )}
            >
              <p className="text-[11px] font-semibold tracking-[0.22em] text-amber-600/90">{introCopy.title}</p>
              <p className="text-2xl font-semibold text-amber-500 drop-shadow-[0_0_16px_rgba(245,158,11,0.35)]">{introCopy.value}</p>
              <p className="text-xs text-muted-foreground">{introCopy.description}</p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
