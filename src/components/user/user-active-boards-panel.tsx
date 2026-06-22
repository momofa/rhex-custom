import Link from "next/link"
import { TrendingUp } from "lucide-react"

import { LevelIcon } from "@/components/level-icon"
import { formatCompactNumber, formatNumber } from "@/lib/formatters"

interface UserActiveBoardItem {
  slug: string
  name: string
  iconPath?: string | null
  lastRepliedAt: string
  activityCount: number
}

interface UserActiveBoardsPanelProps {
  boards: UserActiveBoardItem[]
  emptyText?: string
}

export function UserActiveBoardsPanel({
  boards,
  emptyText = "最近还没有回复活跃记录。",
}: UserActiveBoardsPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-foreground">
        <TrendingUp className="h-4 w-4" />
        <h2 className="text-[15px] font-semibold text-foreground">活跃节点</h2>
      </div>

      {boards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background/50 px-3 py-4 text-xs leading-6 text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <div className="flex flex-col">
          {boards.map((board) => (
            <Link
              key={board.slug}
              href={`/boards/${board.slug}`}
              className="group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-accent/30"
            >
              <div className="flex size-8 shrink-0 items-center justify-center text-base text-foreground">
                <LevelIcon icon={board.iconPath ?? "💬"} className="size-4 text-[16px]" svgClassName="[&>svg]:block" />
              </div>
              <div className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
                {board.name}
              </div>
              <div className="shrink-0 text-[12px] font-medium tabular-nums text-muted-foreground" title={`${formatNumber(board.activityCount)} 活跃`}>
                {formatCompactNumber(board.activityCount)} 活跃
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
