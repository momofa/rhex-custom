"use client"

import { useRouter, useSearchParams } from "next/navigation"

interface SettingsTabsProps {
  tabs: Array<{ key: string; label: string }>
  queryKey?: string
  basePath?: string
}

export function SettingsTabs({ tabs, queryKey = "tab", basePath = "/settings" }: SettingsTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get(queryKey) ?? tabs[0]?.key ?? "profile"

  function buildTabHref(nextTabKey: string) {
    const [pathnamePart, queryPart = ""] = basePath.split("?", 2)
    const nextSearchParams = new URLSearchParams(searchParams.toString())

    if (queryKey !== "tab") {
      nextSearchParams.delete("page")
    }

    if (queryPart) {
      const baseSearchParams = new URLSearchParams(queryPart)
      for (const [key, value] of baseSearchParams.entries()) {
        nextSearchParams.set(key, value)
      }
    }

    nextSearchParams.set(queryKey, nextTabKey)
    const queryString = nextSearchParams.toString()

    return queryString ? `${pathnamePart}?${queryString}` : pathnamePart
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = currentTab === tab.key

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => router.push(buildTabHref(tab.key))}
            className={active ? "rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background" : "rounded-full bg-secondary px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
