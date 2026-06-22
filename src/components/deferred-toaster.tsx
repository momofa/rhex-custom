"use client"

import { useEffect, useState } from "react"

type ToasterComponent = typeof import("@/components/ui/sonner")["Toaster"]

export function DeferredToaster() {
  const [Toaster, setToaster] = useState<ToasterComponent | null>(null)

  useEffect(() => {
    let cancelled = false

    void import("@/components/ui/sonner").then((module) => {
      if (!cancelled) {
        setToaster(() => module.Toaster)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return Toaster ? <Toaster richColors position="top-right" /> : null
}
