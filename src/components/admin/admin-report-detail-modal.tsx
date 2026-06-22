"use client"

import Link from "next/link"
import { useState } from "react"

import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDateTime } from "@/lib/formatters"
import type { AdminReportItem } from "@/lib/admin-report-management"

interface AdminReportDetailModalProps {
  report: AdminReportItem
}

export function AdminReportDetailModal({ report }: AdminReportDetailModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-xs" onClick={() => setOpen(true)}>
        详情
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={report.reasonType}
        description={`举报对象：${report.targetSummary.title}`}
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Info label="举报状态" value={<Badge className={getReportStatusBadgeClassName(report.status)}>{getReportStatusLabel(report.status)}</Badge>} />
            <Info label="举报类型" value={report.targetType} />
            <Info label="举报人" value={`@${report.reporter.username}`} />
            <Info label="提交时间" value={formatDateTime(report.createdAt)} />
          </div>
          <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">举报说明</p><p className="mt-2 text-sm leading-7 text-foreground/90">{report.reasonDetail ?? "举报人未补充额外说明。"}</p></CardContent></Card>
          <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">举报目标</p><Link href={report.targetSummary.href} className="mt-2 block text-sm font-medium hover:underline">{report.targetSummary.title}</Link><p className="mt-2 text-sm text-muted-foreground">{report.targetSummary.description}</p></CardContent></Card>
          {report.handledNote ? (
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">处理记录</p><p className="mt-2 text-sm text-foreground/90">{report.handledNote}</p><p className="mt-2 text-xs text-muted-foreground">{report.handler ? `处理人 @${report.handler.username}` : "未记录处理人"} · {report.handledAt ? formatDateTime(report.handledAt) : "未记录处理时间"}</p></CardContent></Card>
          ) : null}
        </div>
      </Modal>
    </>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-2 text-sm font-medium break-all">{value}</div>
      </CardContent>
    </Card>
  )
}

function getReportStatusLabel(status: AdminReportItem["status"]) {
  if (status === "PENDING") return "待处理"
  if (status === "PROCESSING") return "处理中"
  if (status === "RESOLVED") return "已成立"
  return "已驳回"
}

function getReportStatusBadgeClassName(status: AdminReportItem["status"]) {
  if (status === "PENDING") {
    return "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
  }
  if (status === "PROCESSING") {
    return "border-transparent bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200"
  }
  if (status === "RESOLVED") {
    return "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
  }
  return "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200"
}

