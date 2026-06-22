import { BarChart3 } from "lucide-react"

import type { HomeSidebarStatsData } from "@/lib/home-sidebar-stats"
import { formatCompactNumber, formatNumber } from "@/lib/formatters"

interface HomeSiteStatsCardProps {
  stats: HomeSidebarStatsData
}

export function HomeSiteStatsCard({ stats }: HomeSiteStatsCardProps) {
  const items = [
    { label: "帖子", value: stats.postCount },
    { label: "回复", value: stats.replyCount },
    { label: "用户", value: stats.userCount },
  ]

  return (
    <section className="mobile-sidebar-section rounded-xl border border-border bg-card p-4 shadow-xs shadow-black/5 dark:shadow-black/30">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-slate-500 dark:text-slate-300" />
        <h3 className="font-semibold">社区统计</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-[18px] bg-secondary/40 px-3 py-3 text-center">
            <p className="text-[11px] text-muted-foreground">{item.label}</p>
            <p className="mt-1 whitespace-nowrap text-base font-semibold tabular-nums text-foreground sm:text-lg" title={formatNumber(item.value)}>
              {formatCompactNumber(item.value)}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
