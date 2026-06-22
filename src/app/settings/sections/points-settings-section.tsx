import Link from "next/link"
import { CalendarDays, ChevronLeft, ChevronRight, PieChart, Receipt, Sparkles, Wallet } from "lucide-react"

import { ChangeType } from "@/db/types"
import { AnimatedNumber } from "@/components/animated-number"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/rbutton"
import { Card, CardContent } from "@/components/ui/card"
import { formatDateTime, formatNumber } from "@/lib/formatters"
import { buildPointEffectChangeSummaryText, buildPointEffectNameText } from "@/lib/point-log-audit"
import { getPointLogEventLabel, POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import { buildSettingsHref } from "@/app/settings/settings-page-loader"
import type { SettingsPageData } from "@/app/settings/settings-page-loader"

type PointLogItem = NonNullable<SettingsPageData["pointLogs"]>["items"][number]
type PointsDashboard = NonNullable<SettingsPageData["pointsDashboard"]>

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function formatSignedValue(value: number) {
  if (value > 0) {
    return `+${formatNumber(value)}`
  }

  if (value < 0) {
    return `-${formatNumber(Math.abs(value))}`
  }

  return formatNumber(value)
}

function buildPointsHistoryPageHref(route: SettingsPageData["route"], cursorKey: "pointsBefore" | "pointsAfter", cursor: string | null) {
  if (!cursor) {
    return "#"
  }

  return buildSettingsHref(route, {
    tab: "points",
    pointsRecordTab: "history",
    pointsMonth: route.pointsMonth,
    [cursorKey]: cursor,
    pointsChangeType: route.pointsChangeType,
    pointsEventType: route.pointsEventType,
  })
}

function buildPointsMonthHref(route: SettingsPageData["route"], month: string) {
  return buildSettingsHref(route, {
    tab: "points",
    pointsMonth: month,
    pointsRecordTab: route.pointsRecordTab,
    pointsChangeType: route.pointsRecordTab === "history" ? route.pointsChangeType : undefined,
    pointsEventType: route.pointsRecordTab === "history" ? route.pointsEventType : undefined,
  })
}

function buildPointsRecordTabHref(route: SettingsPageData["route"], tab: "today" | "history") {
  return buildSettingsHref(route, {
    tab: "points",
    pointsMonth: route.pointsMonth,
    pointsRecordTab: tab,
    pointsChangeType: tab === "history" ? route.pointsChangeType : undefined,
    pointsEventType: tab === "history" ? route.pointsEventType : undefined,
  })
}

function buildPointsPanelHref(route: SettingsPageData["route"], panel: "calendar" | "chart") {
  return buildSettingsHref(route, {
    tab: "points",
    pointsMonth: route.pointsMonth,
    pointsPanel: panel,
    pointsRecordTab: route.pointsRecordTab,
    pointsChangeType: route.pointsRecordTab === "history" ? route.pointsChangeType : undefined,
    pointsEventType: route.pointsRecordTab === "history" ? route.pointsEventType : undefined,
  })
}

function buildPointsHistoryResetHref(route: SettingsPageData["route"]) {
  return buildSettingsHref(route, {
    tab: "points",
    pointsMonth: route.pointsMonth,
    pointsRecordTab: "history",
  })
}

function buildCalendarCells(month: string) {
  const [year, monthValue] = month.split("-").map(Number)
  const firstDay = new Date(year, monthValue - 1, 1)
  const startWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, monthValue, 0).getDate()
  const previousMonthDate = new Date(year, monthValue - 2, 1)
  const previousMonthDays = new Date(year, monthValue - 1, 0).getDate()
  const cells: Array<{
    date: string
    day: number
    inCurrentMonth: boolean
  }> = []

  for (let index = 0; index < startWeekday; index += 1) {
    const day = previousMonthDays - startWeekday + index + 1
    const monthKey = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, "0")}`
    cells.push({
      date: `${monthKey}-${String(day).padStart(2, "0")}`,
      day,
      inCurrentMonth: false,
    })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      date: `${month}-${String(day).padStart(2, "0")}`,
      day,
      inCurrentMonth: true,
    })
  }

  let nextMonthDay = 1
  const nextMonthDate = new Date(year, monthValue, 1)
  while (cells.length % 7 !== 0 || cells.length < 35) {
    const monthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`
    cells.push({
      date: `${monthKey}-${String(nextMonthDay).padStart(2, "0")}`,
      day: nextMonthDay,
      inCurrentMonth: false,
    })
    nextMonthDay += 1
  }

  return cells
}

function describeChartSlices(total: number, slices: PointsDashboard["chart"]["income"]["slices"]) {
  if (total <= 0 || slices.length === 0) {
    return []
  }

  const radius = 66
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return slices.map((slice) => {
    const length = (slice.value / total) * circumference
    const segment = {
      ...slice,
      dashArray: `${length} ${circumference - length}`,
      dashOffset: -offset,
    }
    offset += length
    return segment
  })
}

function renderPointEffectSummary(log: PointLogItem) {
  if (!log.pointEffect && !log.pointTax) {
    return null
  }

  const effectNameText = buildPointEffectNameText(log.pointEffect)
  const effectSummary = buildPointEffectChangeSummaryText(log.pointEffect)

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {log.pointEffect ? (
        <>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
            <Sparkles className="h-3 w-3" />
            勋章特效
          </span>
          {effectNameText ? <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">{effectNameText}</span> : null}
          {effectSummary ? <span>{effectSummary}</span> : null}
        </>
      ) : null}
      {log.pointTax ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-700">
          <Receipt className="h-3 w-3" />
          节点税
        </span>
      ) : null}
    </div>
  )
}

function PointRecordRow({ log }: { log: PointLogItem }) {
  const positive = log.changeType === ChangeType.INCREASE
  const hasBalance = typeof log.beforeBalance === "number" && typeof log.afterBalance === "number"
  const beforeLabel = positive ? "增加前" : "扣除前"
  const afterLabel = positive ? "增加后" : "扣除后"
  const balanceSummary = hasBalance
    ? `${beforeLabel} ${formatNumber(log.beforeBalance!)} · ${afterLabel} ${formatNumber(log.afterBalance!)}`
    : null

  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/70 px-1 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{log.displayReason}</p>
          <Badge variant="secondary" className="h-5 px-2 text-[11px]">
            {getPointLogEventLabel(log.eventType)}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{formatDateTime(log.createdAt)}</span>
          {balanceSummary ? <span>{balanceSummary}</span> : null}
        </div>
        {renderPointEffectSummary(log)}
      </div>
      <div className="shrink-0 text-right">
        <p className={positive ? "text-sm font-semibold text-emerald-600 md:text-base" : "text-sm font-semibold text-rose-500 md:text-base"}>
          {positive ? "+" : "-"}
          {formatNumber(log.changeValue)}
        </p>
      </div>
    </div>
  )
}

export function PointsSettingsSection({ data }: { data: SettingsPageData }) {
  const { pointLogs, pointsDashboard, route, settings } = data

  if (!pointsDashboard) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载积分明细，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  const calendarEntryMap = new Map(pointsDashboard.calendarEntries.map((entry) => [entry.date, entry]))
  const calendarCells = buildCalendarCells(pointsDashboard.month)
  const currentMonthDate = new Date(`${pointsDashboard.month}-01T00:00:00`)
  const previousMonthHref = buildPointsMonthHref(route, `${addMonths(currentMonthDate, -1).getFullYear()}-${String(addMonths(currentMonthDate, -1).getMonth() + 1).padStart(2, "0")}`)
  const nextMonthKey = `${addMonths(currentMonthDate, 1).getFullYear()}-${String(addMonths(currentMonthDate, 1).getMonth() + 1).padStart(2, "0")}`
  const nextMonthHref = buildPointsMonthHref(route, nextMonthKey)
  const canGoNextMonth = nextMonthKey <= pointsDashboard.todayKey.slice(0, 7)
  const activeLogs = route.pointsRecordTab === "today" ? pointsDashboard.todayRecords : (pointLogs?.items ?? [])
  const chartBreakdownMode: "income" | "expense" = (route.pointsChangeType === ChangeType.DECREASE ? "expense" : "income")
  const activeChart = pointsDashboard.chart[chartBreakdownMode]
  const chartSegments = describeChartSlices(activeChart.total, activeChart.slices)

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden rounded-[24px] border-border/80 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:rounded-[28px]">
        <CardContent className="p-0">
          <div className="flex flex-col gap-6 border-b border-border/80 px-4 py-5 md:px-6 md:py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_470px] lg:gap-8">
            <div className="flex flex-col gap-6">
              <Breadcrumb>
                <BreadcrumbList className="text-sm md:text-base">
                  <BreadcrumbItem>
                    <BreadcrumbLink render={<Link href="/" />}>首页</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{settings.pointName}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <div className="space-y-4">
                <p className="text-sm font-medium text-muted-foreground md:text-[15px]">当前余额</p>
                <div className="flex flex-wrap items-end gap-3">
                  <AnimatedNumber
                    value={pointsDashboard.currentBalance}
                    className="text-4xl font-semibold tracking-tight md:text-5xl"
                  />
                  <Link href="/topup" className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    <Wallet className="h-3.5 w-3.5" />
                    充值 / 兑换
                  </Link>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:gap-3 md:text-sm">
                <span>
                  站内{settings.pointName}排名：
                  <span className="ml-1 text-lg font-semibold text-indigo-500 md:text-xl">
                    {pointsDashboard.rank ? formatNumber(pointsDashboard.rank) : "未上榜"}
                  </span>
                </span>
                <span className="text-border">|</span>
                <Link href="/leaderboards/points" className="transition-colors hover:text-foreground">
                  查看排行榜
                </Link>
              </div>

              <div className="flex flex-wrap items-end gap-2 text-sm md:gap-3">
                <span className="font-semibold text-muted-foreground">今日变动：</span>
                <AnimatedNumber
                  value={pointsDashboard.todayChange}
                  signDisplay="exceptZero"
                  className={pointsDashboard.todayChange >= 0 ? "text-4xl/none font-semibold tracking-tight text-emerald-500 md:text-5xl/none" : "text-4xl/none font-semibold tracking-tight text-rose-500 md:text-5xl/none"}
                />
                {typeof pointsDashboard.todayChangeRate === "number" && Number.isFinite(pointsDashboard.todayChangeRate) ? (
                  <AnimatedNumber
                    value={pointsDashboard.todayChangeRate}
                    decimals={2}
                    signDisplay="exceptZero"
                    suffix="%"
                    className={pointsDashboard.todayChange >= 0 ? "pb-0.5 text-lg font-semibold text-emerald-500 md:pb-1 md:text-2xl" : "pb-0.5 text-lg font-semibold text-rose-500 md:pb-1 md:text-2xl"}
                  />
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] md:gap-3 md:text-sm">
                <div className="inline-flex items-center gap-2 whitespace-nowrap md:hidden">
                  <span className="font-semibold text-muted-foreground">本月：</span>
                  <span className="text-emerald-500">收 {formatSignedValue(pointsDashboard.monthIncome)}</span>
                  <span className="text-border">|</span>
                  <span className="text-rose-500">支 -{formatNumber(pointsDashboard.monthExpense)}</span>
                  <span className="text-border">|</span>
                  <span className="text-emerald-500">净 {formatSignedValue(pointsDashboard.monthNet)}</span>
                </div>
                <div className="hidden items-center gap-3 whitespace-nowrap md:inline-flex">
                  <span className="font-semibold text-muted-foreground">本月统计：</span>
                  <span className="text-emerald-500">收入 {formatSignedValue(pointsDashboard.monthIncome)}</span>
                  <span className="text-border">|</span>
                  <span className="text-rose-500">支出 -{formatNumber(pointsDashboard.monthExpense)}</span>
                  <span className="text-border">|</span>
                  <span className="text-emerald-500">净收入 {formatSignedValue(pointsDashboard.monthNet)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 md:gap-3">
              <div className="hidden pt-14 lg:flex lg:flex-col lg:items-center lg:gap-2.5">
                <Link
                  href={buildPointsPanelHref(route, "calendar")}
                  className={route.pointsPanel === "calendar"
                    ? "inline-flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "inline-flex size-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={buildPointsPanelHref(route, "chart")}
                  className={route.pointsPanel === "chart"
                    ? "inline-flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "inline-flex size-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"}
                >
                  <PieChart className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <Link href={previousMonthHref} className="inline-flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent md:size-9">
                    <ChevronLeft className="h-4 w-4" />
                  </Link>
                  <div className="text-lg font-semibold tracking-tight md:text-2xl">{pointsDashboard.monthTitle}</div>
                  {canGoNextMonth ? (
                    <Link href={nextMonthHref} className="inline-flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent md:size-9">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground opacity-40 md:size-9">
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  )}
                </div>

                {route.pointsPanel === "calendar" ? (
                  <>
                    <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground md:gap-1.5 md:text-[13px]">
                      {["日", "一", "二", "三", "四", "五", "六"].map((label) => (
                        <div key={label}>{label}</div>
                      ))}
                    </div>

                    <div className="mt-2.5 grid grid-cols-7 gap-1 md:mt-3 md:gap-1.5">
                      {calendarCells.map((cell) => {
                        const entry = calendarEntryMap.get(cell.date)
                        const isToday = cell.date === pointsDashboard.todayKey
                        const hasPositive = (entry?.netChange ?? 0) > 0
                        const hasNegative = (entry?.netChange ?? 0) < 0

                        return (
                          <div
                            key={cell.date}
                            className={cell.inCurrentMonth
                              ? hasPositive
                                ? "relative min-h-[46px] rounded-[10px] border border-emerald-200/70 bg-emerald-50 px-1.5 py-1 text-emerald-600 dark:border-emerald-400/15 dark:bg-emerald-500/12 dark:text-emerald-200 md:min-h-[54px] md:rounded-[12px] md:px-1.5 md:py-1.5"
                                : hasNegative
                                  ? "relative min-h-[46px] rounded-[10px] border border-rose-200/70 bg-rose-50 px-1.5 py-1 text-rose-500 dark:border-rose-400/15 dark:bg-rose-500/10 dark:text-rose-200 md:min-h-[54px] md:rounded-[12px] md:px-1.5 md:py-1.5"
                                  : "relative min-h-[46px] rounded-[10px] border border-border/70 bg-background px-1.5 py-1 text-muted-foreground dark:border-white/8 dark:bg-white/[0.03] dark:text-slate-300 md:min-h-[54px] md:rounded-[12px] md:px-1.5 md:py-1.5"
                              : "relative min-h-[46px] rounded-[10px] border border-border/40 bg-muted/20 px-1.5 py-1 text-muted-foreground opacity-60 dark:border-white/6 dark:bg-white/[0.02] dark:text-slate-500 md:min-h-[54px] md:rounded-[12px] md:px-1.5 md:py-1.5"}
                          >
                            <div className="text-center text-[11px] font-semibold md:text-[12px]">{cell.day}</div>
                            <div className={cell.inCurrentMonth
                              ? hasPositive
                                ? "mt-0.5 text-center text-[10px] font-medium text-emerald-500 dark:text-emerald-200 md:text-[11px]"
                                : hasNegative
                                  ? "mt-0.5 text-center text-[10px] font-medium text-rose-500 dark:text-rose-200 md:text-[11px]"
                                  : "mt-0.5 text-center text-[10px] font-medium text-muted-foreground dark:text-slate-400 md:text-[11px]"
                              : "mt-0.5 text-center text-[10px] font-medium text-muted-foreground dark:text-slate-500 md:text-[11px]"}
                            >
                              {entry ? formatSignedValue(entry.netChange) : "+0"}
                            </div>
                            {isToday ? <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-indigo-500 md:bottom-1.5 md:size-1.5" /> : null}
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="mt-5 flex flex-col gap-5 md:mt-6">
                    <div className="flex items-start justify-center gap-4 sm:gap-6">
                      <svg viewBox="0 0 180 180" className="h-[180px] w-[180px] shrink-0">
                        <circle cx="90" cy="90" r="66" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="32" />
                        {chartSegments.map((segment) => (
                          <circle
                            key={segment.key}
                            cx="90"
                            cy="90"
                            r="66"
                            fill="none"
                            stroke={segment.color}
                            strokeWidth="32"
                            strokeDasharray={segment.dashArray}
                            strokeDashoffset={segment.dashOffset}
                            strokeLinecap="butt"
                            transform="rotate(-90 90 90)"
                          />
                        ))}
                        <circle cx="90" cy="90" r="43" className="fill-background dark:fill-slate-900" />
                        <text x="90" y="82" textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium">
                          {chartBreakdownMode === "income" ? "收入" : "支出"}
                        </text>
                        <text x="90" y="102" textAnchor="middle" className="fill-foreground text-[16px] font-semibold">
                          {formatNumber(activeChart.total)}
                        </text>
                      </svg>

                      <div className="min-w-0 flex-1 space-y-2 pt-2">
                        {activeChart.slices.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                            本月暂时没有{chartBreakdownMode === "income" ? "收入" : "支出"}分布数据。
                          </div>
                        ) : activeChart.slices.map((slice) => (
                          <div key={slice.key} className="flex items-center justify-between gap-3 text-sm">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                              <span className="truncate text-foreground">{slice.label}</span>
                            </div>
                            <span className="shrink-0 font-medium text-muted-foreground">
                              {formatNumber(slice.value)} ({slice.percentage.toFixed(1)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-2">
                      <Link
                        href={buildSettingsHref(route, {
                          tab: "points",
                          pointsMonth: route.pointsMonth,
                          pointsPanel: "chart",
                          pointsRecordTab: route.pointsRecordTab,
                          pointsChangeType: ChangeType.DECREASE,
                          pointsEventType: route.pointsRecordTab === "history" ? route.pointsEventType : undefined,
                        })}
                        className={chartBreakdownMode === "expense"
                          ? "inline-flex h-10 items-center justify-center rounded-xl border border-rose-400 bg-rose-50 px-5 text-sm font-semibold text-rose-500 shadow-sm dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
                          : "inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"}
                      >
                        支出
                      </Link>
                      <Link
                        href={buildSettingsHref(route, {
                          tab: "points",
                          pointsMonth: route.pointsMonth,
                          pointsPanel: "chart",
                          pointsRecordTab: route.pointsRecordTab,
                          pointsChangeType: ChangeType.INCREASE,
                          pointsEventType: route.pointsRecordTab === "history" ? route.pointsEventType : undefined,
                        })}
                        className={chartBreakdownMode === "income"
                          ? "inline-flex h-10 items-center justify-center rounded-xl border border-emerald-400 bg-emerald-50 px-5 text-sm font-semibold text-emerald-600 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-500/12 dark:text-emerald-200"
                          : "inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"}
                      >
                        收入
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div id="points-records" className="px-4 py-5 md:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/80">
              <div className="flex items-center gap-5 md:gap-8">
                <Link
                  href={buildPointsRecordTabHref(route, "today")}
                  className={route.pointsRecordTab === "today"
                    ? "border-b-4 border-foreground px-0 pb-3 text-lg font-semibold text-foreground md:text-2xl"
                    : "px-0 pb-3 text-lg font-medium text-muted-foreground transition-colors hover:text-foreground md:text-2xl"}
                >
                  今日记录
                </Link>
                <Link
                  href={buildPointsRecordTabHref(route, "history")}
                  className={route.pointsRecordTab === "history"
                    ? "border-b-4 border-foreground px-0 pb-3 text-lg font-semibold text-foreground md:text-2xl"
                    : "px-0 pb-3 text-lg font-medium text-muted-foreground transition-colors hover:text-foreground md:text-2xl"}
                >
                  历史记录
                </Link>
              </div>

              {route.pointsRecordTab === "history" ? (
                <form action="/settings" className="mb-3 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end">
                  <input type="hidden" name="tab" value="points" />
                  <input type="hidden" name="pointsRecordTab" value="history" />
                  <input type="hidden" name="pointsMonth" value={route.pointsMonth} />
                  {route.mobileView === "detail" ? <input type="hidden" name="mobile" value="detail" /> : null}
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">收支类型</span>
                    <select
                      name="pointsChangeType"
                      defaultValue={pointLogs?.filters.changeType ?? "ALL"}
                      className="h-9 rounded-full border border-border bg-background px-3 text-xs outline-hidden sm:min-w-[110px]"
                    >
                      <option value="ALL">全部</option>
                      <option value="INCREASE">收入</option>
                      <option value="DECREASE">支出</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">变动场景</span>
                    <select
                      name="pointsEventType"
                      defaultValue={pointLogs?.filters.eventType ?? "ALL"}
                      className="h-9 rounded-full border border-border bg-background px-3 text-xs outline-hidden sm:min-w-[132px]"
                    >
                      <option value="ALL">全部</option>
                      {Object.values(POINT_LOG_EVENT_TYPES).map((eventType) => (
                        <option key={eventType} value={eventType}>
                          {getPointLogEventLabel(eventType)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button type="submit" variant="outline" className="h-9 rounded-full px-4 text-xs sm:self-end">
                    筛选
                  </Button>
                  <Link href={buildPointsHistoryResetHref(route)} className="inline-flex h-9 items-center justify-center rounded-full border border-border px-4 text-xs transition-colors hover:bg-accent hover:text-foreground sm:self-end">
                    重置
                  </Link>
                </form>
              ) : null}

              {route.pointsRecordTab === "history" && pointLogs && pointLogs.total > 0 ? (
                <div className="mb-3 flex items-center gap-2">
                  <Link
                    href={pointLogs.hasPrevPage ? buildPointsHistoryPageHref(route, "pointsBefore", pointLogs.prevCursor) : "#"}
                    aria-disabled={!pointLogs.hasPrevPage}
                    className={pointLogs.hasPrevPage ? "inline-flex h-9 items-center justify-center rounded-full border border-border px-4 text-sm transition-colors hover:bg-accent hover:text-foreground" : "pointer-events-none inline-flex h-9 items-center justify-center rounded-full border border-border px-4 text-sm text-muted-foreground opacity-50"}
                  >
                    上一页
                  </Link>
                  <Link
                    href={pointLogs.hasNextPage ? buildPointsHistoryPageHref(route, "pointsAfter", pointLogs.nextCursor) : "#"}
                    aria-disabled={!pointLogs.hasNextPage}
                    className={pointLogs.hasNextPage ? "inline-flex h-9 items-center justify-center rounded-full border border-border px-4 text-sm transition-colors hover:bg-accent hover:text-foreground" : "pointer-events-none inline-flex h-9 items-center justify-center rounded-full border border-border px-4 text-sm text-muted-foreground opacity-50"}
                  >
                    下一页
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="pt-4">
              {activeLogs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">
                  {route.pointsRecordTab === "today" ? "今天还没有积分变动记录。" : "当前还没有历史积分记录。"}
                </div>
              ) : (
                <div className="flex flex-col">
                  {activeLogs.map((log) => (
                    <PointRecordRow key={log.id} log={log} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
