"use client"

import type { ReactNode } from "react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatNumber } from "@/lib/formatters"
import { cn } from "@/lib/utils"

export type AdminSummaryTone =
  | "default"
  | "amber"
  | "emerald"
  | "orange"
  | "rose"
  | "sky"
  | "slate"

export interface AdminSummaryItem {
  key?: string
  label: string
  value: number | string
  hint?: string
  icon?: ReactNode
  tone?: AdminSummaryTone
  badgeLabel?: string
  href?: string
  active?: boolean
}

interface AdminSummaryStripProps {
  items: AdminSummaryItem[]
  className?: string
}

export function AdminSummaryStrip({ items, className }: AdminSummaryStripProps) {
  return (
    <section className={cn("flex flex-wrap gap-2 xl:flex-nowrap", className)}>
      {items.map(({ key, ...item }) => (
        <AdminSummaryCard key={key ?? item.label} {...item} />
      ))}
    </section>
  )
}

function AdminSummaryCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  badgeLabel,
  href,
  active = false,
}: AdminSummaryItem) {
  const formattedValue = typeof value === "number" ? formatNumber(value) : value
  const accent = icon ? (
    <Badge className={cn("h-8 w-8 shrink-0 justify-center rounded-lg border-transparent p-0", getSummaryToneClassName(tone))}>
      {icon}
    </Badge>
  ) : badgeLabel ? (
    <Badge className={cn("shrink-0 rounded-full border-transparent px-2 py-0.5 text-[10px]", getSummaryToneClassName(tone))}>
      {badgeLabel}
    </Badge>
  ) : null

  const card = (
    <Card
      size="sm"
      className={cn(
        "min-w-[116px] flex-1",
        href ? "h-full transition-colors hover:bg-muted/35" : null,
        active ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : null
      )}
    >
      <CardContent className="flex items-start justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] leading-4 text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold leading-none tracking-tight">{formattedValue}</p>
          {hint ? <p className="mt-1 line-clamp-1 text-[10px] leading-4 text-muted-foreground">{hint}</p> : null}
        </div>
        {accent}
      </CardContent>
    </Card>
  )

  if (!href) {
    return card
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="min-w-[116px] flex-1 rounded-xl outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {card}
    </Link>
  )
}

function getSummaryToneClassName(tone: AdminSummaryTone) {
  return {
    default: "bg-accent text-foreground",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200",
  }[tone]
}
