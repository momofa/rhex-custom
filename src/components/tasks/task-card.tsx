"use client"

import Link from "next/link"
import { CheckCircle2, ChevronRight, Flame, Gem, PenSquare, Sparkles, ThumbsUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TaskCategory } from "@/db/types"
import type { TaskCenterPageTaskItem } from "@/lib/task-center-page"
import { cn } from "@/lib/utils"

function TaskIcon({ item, className }: { item: TaskCenterPageTaskItem; className?: string }) {
  if (item.completed) {
    return <CheckCircle2 className={className} />
  }

  if (item.actionHref === "/write") {
    return <PenSquare className={className} />
  }

  if (item.actionLabel.includes("点赞")) {
    return <ThumbsUp className={className} />
  }

  if (item.category === TaskCategory.CHALLENGE) {
    return <Flame className={className} />
  }

  if (item.category === TaskCategory.NEWBIE) {
    return <Sparkles className={className} />
  }

  return <Gem className={className} />
}

function resolveCategoryBadgeVariant(category: TaskCategory) {
  switch (category) {
    case TaskCategory.NEWBIE:
      return "poll" as const
    case TaskCategory.CHALLENGE:
      return "auction" as const
    case TaskCategory.DAILY:
    default:
      return "bounty" as const
  }
}

export function TaskCard({ item, pointName }: { item: TaskCenterPageTaskItem; pointName: string }) {
  return (
    <Card className={cn(
      "overflow-hidden border border-border/80 bg-card/95 shadow-[0_10px_24px_hsl(var(--foreground)/0.05)] backdrop-blur-sm",
      item.completed && "ring-1 ring-emerald-500/25",
    )}>
      <CardHeader className="gap-2 border-b border-border/60 bg-linear-to-r from-background via-background to-secondary/20 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background shadow-sm",
              item.completed && "border-emerald-500/30 bg-emerald-500/10",
            )}>
              <TaskIcon
                item={item}
                className={cn("size-4 text-foreground/80", item.completed && "text-emerald-600 dark:text-emerald-300")}
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm">{item.title}</CardTitle>
                <Badge variant={resolveCategoryBadgeVariant(item.category)}>{item.categoryLabel}</Badge>
                <Badge variant="outline">{item.cycleTypeLabel}</Badge>
              </div>
              <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">{item.description || item.conditionSummary}</p>
            </div>
          </div>

          <Badge variant="secondary" className="shrink-0 rounded-full px-2 py-0.5">+{item.rewardText} {pointName}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2.5 px-3 py-2.5">
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_190px]">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="line-clamp-1 text-[13px] text-muted-foreground">{item.conditionSummary}</p>
              <span className={cn("shrink-0 font-medium", item.completed ? "text-emerald-600 dark:text-emerald-300" : "text-foreground")}>
                {item.completed ? "已完成" : `${item.progressCount}/${item.targetCount}`}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary/80">
              <div
                className={cn(
                  "h-full rounded-full bg-linear-to-r from-primary via-primary to-primary/70 transition-[width]",
                  item.completed && "from-emerald-500 via-emerald-400 to-emerald-300",
                )}
                style={{ width: `${item.progressPercent}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-2.5 py-1.5">
            <p className="line-clamp-1 text-[13px] text-foreground/80">{item.actionHint}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
          <div className="text-[13px] text-muted-foreground">
            {item.completed ? "奖励已自动发放" : "完成后自动结算"}
          </div>
          {item.completed ? (
            <span className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "pointer-events-none")}>
              <CheckCircle2 data-icon="inline-start" />
              已完成
            </span>
          ) : (
            <Link href={item.actionHref} className={buttonVariants({ variant: "default", size: "sm" })}>
              {item.actionLabel}
              <ChevronRight data-icon="inline-end" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
