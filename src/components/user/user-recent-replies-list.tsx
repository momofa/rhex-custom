import { InlineTokenContent } from "@/components/inline-token-content"
import { PostListLink } from "@/components/post/post-list-link"
import { formatMonthDayTime, parseBusinessDateTime, serializeDate, serializeDateTime } from "@/lib/formatters"
import { getPostCommentPath } from "@/lib/post-links"
import type { PostLinkDisplayMode } from "@/lib/site-settings"
import { cn } from "@/lib/utils"

interface UserRecentReplyItem {
  id: string | number
  content: string
  createdAt: string
  postId: string | number
  postTitle: string
  postSlug: string
  boardName: string
  likeCount: number
  replyToUsername?: string | null
}

interface UserRecentRepliesListProps {
  replies: UserRecentReplyItem[]
  postLinkDisplayMode: PostLinkDisplayMode
  emptyText?: string
}

export function UserRecentRepliesList({
  replies,
  postLinkDisplayMode,
  emptyText = "最近还没有回复记录。",
}: UserRecentRepliesListProps) {
  if (replies.length === 0) {
    return (
      <div className="rounded-xl border border-dashed  px-4 py-12 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/2">
        {emptyText}
      </div>
    )
  }

  const referenceDate = new Date()

  return (
    <div className="flex flex-col">
      {replies.map((reply, index) => {
        const commentPath = getPostCommentPath(
          { id: String(reply.postId), slug: reply.postSlug, title: reply.postTitle },
          String(reply.id),
          { mode: postLinkDisplayMode },
        )

        return (
          <article
            key={reply.id}
            className={cn(
              "flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-accent/20 sm:px-5 sm:py-4",
              index > 0 && "border-t border-border/70",
            )}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5 text-muted-foreground sm:text-xs">
              <span className="shrink-0">{formatReplyActivityTime(reply.createdAt, referenceDate)}</span>
              <span className="shrink-0">评论帖子</span>
              <PostListLink
                href={commentPath}
                visitedPath={commentPath}
                dimWhenRead
                className="inline-block max-w-full truncate font-semibold text-foreground underline decoration-foreground/30 underline-offset-3 transition-colors hover:text-foreground/70"
              >
                {reply.postTitle}
              </PostListLink>
              {reply.replyToUsername ? <span className="shrink-0">回复 @{reply.replyToUsername}</span> : null}
            </div>
            <p className="line-clamp-3 break-words text-[13px] leading-6 text-foreground sm:text-sm sm:leading-6">
              <InlineTokenContent content={reply.content} />
            </p>
          </article>
        )
      })}
    </div>
  )
}

function formatReplyActivityTime(value: string, referenceDate: Date) {
  const date = parseBusinessDateTime(value) ?? new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  const dayDifference = getBusinessDayDifference(date, referenceDate)
  if (dayDifference === null || dayDifference < 0) {
    return formatMonthDayTime(date)
  }

  if (dayDifference === 0) {
    const diffMinutes = Math.floor((referenceDate.getTime() - date.getTime()) / (60 * 1000))

    if (diffMinutes <= 0) {
      return "刚刚"
    }

    if (diffMinutes < 60) {
      return `${diffMinutes} 分钟前`
    }

    return `${Math.floor(diffMinutes / 60)} 小时前`
  }

  if (dayDifference === 1) {
    const preciseDateTime = serializeDateTime(date)
    return preciseDateTime ? `昨天 ${preciseDateTime.slice(11, 16)}` : "昨天"
  }

  if (dayDifference < 7) {
    return `${dayDifference} 天前`
  }

  return formatMonthDayTime(date)
}

function getBusinessDayDifference(startDate: Date, endDate: Date) {
  const startDayKey = serializeDate(startDate)
  const endDayKey = serializeDate(endDate)

  if (!startDayKey || !endDayKey) {
    return null
  }

  const startDay = parseBusinessDateTime(`${startDayKey} 00:00:00`)
  const endDay = parseBusinessDateTime(`${endDayKey} 00:00:00`)

  if (!startDay || !endDay) {
    return null
  }

  return Math.round((endDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000))
}
