"use client"

import { useRouter } from "next/navigation"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface AdminSettingsSubTabItem {
  key: string
  label: string
  href?: string
  onSelect?: () => void
}

interface AdminSettingsSubTabsProps {
  items: readonly AdminSettingsSubTabItem[]
  activeKey: string
  className?: string
}

export function AdminSettingsSubTabs({
  items,
  activeKey,
  className,
}: AdminSettingsSubTabsProps) {
  const router = useRouter()

  return (
    <Tabs
      value={activeKey}
      onValueChange={(nextKey) => {
        const item = items.find((entry) => entry.key === nextKey)
        if (!item) {
          return
        }

        if (item.href) {
          router.push(item.href)
        } else {
          item.onSelect?.()
        }
      }}
      className={cn("w-full", className)}
    >
      <TabsList>
        {items.map((item) => (
          <TabsTrigger
            key={item.key}
            value={item.key}
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
