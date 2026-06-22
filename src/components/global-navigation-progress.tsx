"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

const START_PROGRESS = 14
const MAX_PROGRESS_BEFORE_COMPLETE = 90
const PROGRESS_TICK_MS = 140
const FINISH_HIDE_DELAY_MS = 220
const NAVIGATION_FALLBACK_TIMEOUT_MS = 12000

function isTrackableAnchor(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }

  const anchor = target.closest("a")
  if (!(anchor instanceof HTMLAnchorElement)) {
    return null
  }

  if (anchor.target && anchor.target !== "_self") {
    return null
  }

  if (anchor.hasAttribute("download") || anchor.dataset.disableNavigationProgress === "true") {
    return null
  }

  return anchor
}

export function GlobalNavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const hasHydratedRef = useRef(false)
  const navigatingRef = useRef(false)
  const progressTimerRef = useRef<number | null>(null)
  const finishTimerRef = useRef<number | null>(null)
  const fallbackTimerRef = useRef<number | null>(null)

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }, [])

  const clearFinishTimer = useCallback(() => {
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current)
      finishTimerRef.current = null
    }
  }, [])

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
  }, [])

  const completeProgress = useCallback(() => {
    clearProgressTimer()
    clearFallbackTimer()
    clearFinishTimer()

    navigatingRef.current = false
    setProgress(100)
    finishTimerRef.current = window.setTimeout(() => {
      setVisible(false)
      setProgress(0)
      finishTimerRef.current = null
    }, FINISH_HIDE_DELAY_MS)
  }, [clearFallbackTimer, clearFinishTimer, clearProgressTimer])

  const startProgress = useCallback(() => {
    clearProgressTimer()
    clearFallbackTimer()
    clearFinishTimer()

    navigatingRef.current = true
    setVisible(true)
    setProgress((current) => (current > 0 && current < MAX_PROGRESS_BEFORE_COMPLETE ? current : START_PROGRESS))

    progressTimerRef.current = window.setInterval(() => {
      setProgress((current) => {
        if (current >= MAX_PROGRESS_BEFORE_COMPLETE) {
          return current
        }

        const remaining = MAX_PROGRESS_BEFORE_COMPLETE - current
        const step = Math.max(1, Math.round(remaining * 0.18))
        return Math.min(MAX_PROGRESS_BEFORE_COMPLETE, current + step)
      })
    }, PROGRESS_TICK_MS)

    fallbackTimerRef.current = window.setTimeout(() => {
      if (navigatingRef.current) {
        completeProgress()
      }
    }, NAVIGATION_FALLBACK_TIMEOUT_MS)
  }, [clearFallbackTimer, clearFinishTimer, clearProgressTimer, completeProgress])

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
      ) {
        return
      }

      const anchor = isTrackableAnchor(event.target)
      if (!anchor) {
        return
      }

      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin) {
        return
      }

      const currentPath = `${window.location.pathname}${window.location.search}`
      const nextPath = `${destination.pathname}${destination.search}`
      if (currentPath === nextPath) {
        return
      }

      startProgress()
    }

    document.addEventListener("click", handleDocumentClick, true)

    return () => {
      document.removeEventListener("click", handleDocumentClick, true)
      clearProgressTimer()
      clearFallbackTimer()
      clearFinishTimer()
    }
  }, [clearFallbackTimer, clearFinishTimer, clearProgressTimer, startProgress])

  useEffect(() => {
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true
      return
    }

    if (!navigatingRef.current) {
      return
    }

    completeProgress()
  }, [completeProgress, pathname, search])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-120 h-1 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div
        className="h-full bg-linear-to-r from-orange-400 via-amber-400 to-yellow-300 shadow-[0_0_18px_rgba(251,191,36,0.55)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
