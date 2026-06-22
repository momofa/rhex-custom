"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export interface SettingsNavItem {
  key: string
  label: string
  description: string
  href?: string
}

interface SettingsSidebarNavProps {
  items: SettingsNavItem[]
  title?: string
  showDescriptions?: boolean
  onItemSelect?: (item: SettingsNavItem) => void
  buildHref?: (item: SettingsNavItem) => string
  className?: string
}

export function SettingsSidebarNav({
  items,
  title = "Account",
  showDescriptions = false,
  onItemSelect,
  buildHref,
  className,
}: SettingsSidebarNavProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get("tab") ?? items[0]?.key ?? "profile"

  return (
    <nav className={cn("rounded-xl border border-border bg-card p-2.5 shadow-soft", className)}>
      <div className="mb-2 px-2.5 pt-1.5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
      </div>
      <div className="space-y-1">

        {items.map((item) => {
          const active = currentTab === item.key

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onItemSelect?.(item)
                router.push(item.href ?? (buildHref ? buildHref(item) : `/settings?tab=${item.key}`))
              }}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors",
                active
                  ? "bg-foreground text-background shadow-xs"
                  : "text-foreground hover:bg-accent/60",
              )}
            >
              <div className="min-w-0">
                <p className={cn("text-sm font-medium leading-5", active ? "text-background" : "text-foreground")}>{item.label}</p>
                {showDescriptions ? (
                  <p className={cn("mt-1 text-xs leading-5", active ? "text-background/70" : "text-muted-foreground")}>{item.description}</p>
                ) : null}
              </div>
              <ChevronRight className={cn("h-3.5 w-3.5 shrink-0", active ? "text-background/75" : "text-muted-foreground")} />

            </button>
          )
        })}
      </div>
    </nav>
  )
}
