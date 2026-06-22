"use client"

import type { ReactNode } from "react"
import { ArrowRight, Flame, Sparkles, Trophy, Zap } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AddonSurfaceClientRenderer } from "@/addons-host/client/addon-surface-client-renderer"
import { TaskCategory } from "@/db/types"
import type { TaskCenterPageData } from "@/lib/task-center-page"
import { cn } from "@/lib/utils"
import { TaskCard } from "@/components/tasks/task-card"

function renderTaskList(items: TaskCenterPageData["tasksByCategory"][TaskCategory], pointName: string) {
  if (items.length === 0) {
    return (
      <Card className="border border-dashed border-border/70 bg-card/80">
        <CardContent className="flex flex-col gap-2 p-6 text-center">
          <p className="text-sm font-medium">这一组暂时没有任务</p>
          <p className="text-sm text-muted-foreground">你可以先切到其他分类，或者回后台继续补充任务定义。</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => <TaskCard key={item.id} item={item} pointName={pointName} />)}
    </div>
  )
}

interface TaskCenterPageProps {
  data: TaskCenterPageData
  headerBefore?: ReactNode
  headerAfter?: ReactNode
  contentBefore?: ReactNode
  contentAfter?: ReactNode
}

export function TaskCenterPage({ data, headerBefore, headerAfter, contentBefore, contentAfter }: TaskCenterPageProps) {
  return (
    <Tabs defaultValue={TaskCategory.NEWBIE} className="flex flex-col gap-3">
      <div className="rounded-xl border border-border/70 bg-card/95 p-2.5 shadow-sm">
        {headerBefore}
        <AddonSurfaceClientRenderer
          surface="tasks.header"
          surfaceProps={{ data }}
          fallback={(
            <>
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">任务中心</h2>
                    <Badge variant="outline" className="rounded-full px-2.5 py-0.5">已完成 {data.totalCompleted}/{data.totalTasks}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">把新手、日常和挑战任务压成同一页处理。</p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="rounded-2xl border border-border/70 bg-background px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      <Zap className="size-3.5" />
                      今日完成
                    </div>
                    <div className="mt-0.5 text-sm font-semibold">{data.todayCompleted}</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      <Trophy className="size-3.5" />
                      连续签到
                    </div>
                    <div className="mt-0.5 text-sm font-semibold">{data.currentStreak}</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      <Flame className="size-3.5" />
                      本周挑战
                    </div>
                    <div className="mt-0.5 text-sm font-semibold">{data.challengeCompleted}</div>
                  </div>
                  <Link href="/latest" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    去逛最新
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                  <Link href="/write" className={buttonVariants({ variant: "default", size: "sm" })}>
                    <Sparkles data-icon="inline-start" />
                    发主题
                  </Link>
                </div>
              </div>

              <div className="mt-2.5 border-t border-border/60 pt-2.5">
                <TabsList className="flex h-auto flex-wrap gap-2 bg-transparent p-0">
                  <TabsTrigger value={TaskCategory.NEWBIE} className={cn("rounded-full border border-border bg-background px-3 py-1.5 text-sm", "data-[selected]:bg-foreground data-[selected]:text-background")}>新手任务</TabsTrigger>
                  <TabsTrigger value={TaskCategory.DAILY} className={cn("rounded-full border border-border bg-background px-3 py-1.5 text-sm", "data-[selected]:bg-foreground data-[selected]:text-background")}>日常任务</TabsTrigger>
                  <TabsTrigger value={TaskCategory.CHALLENGE} className={cn("rounded-full border border-border bg-background px-3 py-1.5 text-sm", "data-[selected]:bg-foreground data-[selected]:text-background")}>挑战任务</TabsTrigger>
                </TabsList>
              </div>
            </>
          )}
        />
        {headerAfter}
      </div>

      {contentBefore}
      <AddonSurfaceClientRenderer
        surface="tasks.content"
        surfaceProps={{ data }}
        fallback={(
          <>
            <TabsContent value={TaskCategory.NEWBIE}>
              {renderTaskList(data.tasksByCategory[TaskCategory.NEWBIE], data.pointName)}
            </TabsContent>
            <TabsContent value={TaskCategory.DAILY}>
              {renderTaskList(data.tasksByCategory[TaskCategory.DAILY], data.pointName)}
            </TabsContent>
            <TabsContent value={TaskCategory.CHALLENGE}>
              {renderTaskList(data.tasksByCategory[TaskCategory.CHALLENGE], data.pointName)}
            </TabsContent>
          </>
        )}
      />
      {contentAfter}
    </Tabs>
  )
}
