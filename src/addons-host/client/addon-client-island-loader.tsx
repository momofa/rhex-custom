"use client"

import { useEffect, useState } from "react"

interface AddonClientIslandLoaderProps {
  moduleUrl: string
  props?: Record<string, unknown>
  fallback?: React.ReactNode
}

type AddonClientIslandComponent = typeof import("@/addons-host/client/addon-client-island")["AddonClientIsland"]

export function AddonClientIslandLoader({ moduleUrl, props, fallback = null }: AddonClientIslandLoaderProps) {
  const [AddonClientIsland, setAddonClientIsland] = useState<AddonClientIslandComponent | null>(null)

  useEffect(() => {
    let cancelled = false

    void import("@/addons-host/client/addon-client-island").then((module) => {
      if (!cancelled) {
        setAddonClientIsland(() => module.AddonClientIsland)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (!AddonClientIsland) {
    return <>{fallback}</>
  }

  return <AddonClientIsland moduleUrl={moduleUrl} props={props} fallback={fallback} />
}
