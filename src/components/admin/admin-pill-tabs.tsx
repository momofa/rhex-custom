"use client"

import Link from "next/link"

import { Button, buttonVariants } from "@/components/ui/rbutton"
import { cn } from "@/lib/utils"

interface AdminPillTabItem {
  key: string
  label: string
  href?: string
  onSelect?: () => void
}

interface AdminPillTabsProps {
  items: readonly AdminPillTabItem[]
  activeKey: string
  containerClassName?: string
  inactiveStyle?: "secondary" | "outlined"
}

export function AdminPillTabs({
  items,
  activeKey,
  containerClassName = "flex flex-wrap gap-2",
  inactiveStyle = "secondary",
}: AdminPillTabsProps) {
  return (
    <div className={containerClassName}>
      {items.map((item) => {
        const active = activeKey === item.key
        const className = active
          ? cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "rounded-full shadow-xs"
            )
          : inactiveStyle === "outlined"
            ? cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "rounded-full"
              )
            : cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "rounded-full"
              )

        if (item.href) {
          return (
            <Link key={item.key} href={item.href} className={className}>
              {item.label}
            </Link>
          )
        }

        return (
          <Button
            key={item.key}
            type="button"
            variant={active ? "default" : inactiveStyle === "outlined" ? "outline" : "secondary"}
            size="sm"
            onClick={item.onSelect}
            className="rounded-full"
          >
            {item.label}
          </Button>
        )
      })}
    </div>
  )
}
