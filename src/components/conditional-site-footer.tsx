"use client"

import type { ReactNode } from "react"
import { useMemo } from "react"
import { usePathname } from "next/navigation"

export function ConditionalSiteFooter({
  children,
  hiddenPaths = [],
}: {
  children: ReactNode
  hiddenPaths?: string[]
}) {
  const pathname = usePathname()
  const hiddenPathSet = useMemo(() => new Set(hiddenPaths), [hiddenPaths])
  const normalizedPathname = pathname && pathname !== "/"
    ? pathname.replace(/\/+$/g, "")
    : pathname

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/addons/")) {
    return null
  }

  if (normalizedPathname && hiddenPathSet.has(normalizedPathname)) {
    return null
  }

  return <>{children}</>
}
