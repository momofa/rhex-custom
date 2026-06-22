"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useTransition } from "react"

import { useCurrentUser } from "@/components/current-user-provider"
import { toast } from "@/components/ui/toast"

interface AutoCheckInOnHomeEnterProps {
  enabled: boolean
  todayKey: string
  userId: number
}

function buildAutoCheckInStorageKey(userId: number, todayKey: string) {
  return `home-auto-check-in:${userId}:${todayKey}`
}

export function AutoCheckInOnHomeEnter({ enabled, todayKey, userId }: AutoCheckInOnHomeEnterProps) {
  const router = useRouter()
  const { refresh: refreshCurrentUser } = useCurrentUser()
  const [isRefreshing, startTransition] = useTransition()
  const requestStartedRef = useRef(false)

  useEffect(() => {
    if (!enabled || requestStartedRef.current || isRefreshing) {
      return
    }

    const storageKey = buildAutoCheckInStorageKey(userId, todayKey)
    if (typeof window !== "undefined" && window.sessionStorage.getItem(storageKey)) {
      return
    }

    requestStartedRef.current = true
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, "pending")
    }

    void fetch("/api/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check-in" }),
    })
      .then(async (response) => {
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message ?? "自动签到失败")
        }

        if (result.data?.alreadyCheckedIn) {
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(storageKey, "done")
          }
          void refreshCurrentUser()
          startTransition(() => {
            router.refresh()
          })
          return
        }

        toast.success(result.message ?? "签到成功", "自动签到")
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(storageKey, "done")
        }
        void refreshCurrentUser()
        startTransition(() => {
          router.refresh()
        })
      })
      .catch((error) => {
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(storageKey)
        }
        requestStartedRef.current = false
        toast.error(error instanceof Error ? error.message : "自动签到失败，请稍后再试", "自动签到失败")
      })
  }, [enabled, isRefreshing, refreshCurrentUser, router, todayKey, userId])

  return null
}
