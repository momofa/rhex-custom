import { Eye, MessageCircle, ThumbsUp } from "lucide-react"

import { PostListLink } from "@/components/post/post-list-link"
import { TimeTooltip } from "@/components/time-tooltip"
import { UserDisplayedBadges } from "@/components/user/user-displayed-badges"
import { formatCompactNumber, formatCompactPointValue, formatNumber } from "@/lib/formatters"
import { getPostPath } from "@/lib/post-links"
import type { SitePostItem } from "@/lib/posts"


interface PostCardListProps {
  posts: SitePostItem[]
  pointName?: string
  compact?: boolean
  showBoard?: boolean
  postLinkDisplayMode?: "SLUG" | "ID"
}

export function PostCardList({ posts, pointName = "积分", compact = false, showBoard = true, postLinkDisplayMode = "SLUG" }: PostCardListProps) {


  return (
    <>
      {posts.map((post) => {
        const postPath = getPostPath(post, { mode: postLinkDisplayMode })

        return (
          <div key={post.id} className="rounded-xl bg-secondary/60 p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="rounded-full bg-background px-3 py-1 text-xs">{post.typeLabel}</span>
              {showBoard ? (
                <>
                  <span>{post.board}</span>
                  <span>·</span>
                </>
              ) : null}
              <span>{post.author}</span>
              <UserDisplayedBadges badges={post.authorDisplayedBadges} compact />
              <span>·</span>

              <TimeTooltip value={post.publishedAtRaw}>
                <span>{post.publishedAt}</span>
              </TimeTooltip>
              {post.bounty ? (
                <>
                  <span>·</span>
                  <span>悬赏 {formatCompactPointValue(post.bounty.points)} {pointName}</span>

                </>
              ) : null}
            </div>

            <PostListLink href={postPath} visitedPath={postPath} dimWhenRead>
              <h2 className="text-xl font-semibold leading-8 transition-colors hover:text-primary">{post.title}</h2>
            </PostListLink>
            {compact ? null : <p className="mt-3 text-sm leading-7 text-muted-foreground">{post.excerpt}</p>}
            <div className={`${compact ? "mt-3" : "mt-4"} flex flex-wrap items-center gap-4 text-sm text-muted-foreground`}>
              <span className="flex items-center gap-1" title={`${formatNumber(post.stats.comments)} 回复`}><MessageCircle className="h-4 w-4" />{formatCompactNumber(post.stats.comments)}</span>
              <span className="flex items-center gap-1" title={`${formatNumber(post.stats.likes)} 点赞`}><ThumbsUp className="h-4 w-4" />{formatCompactNumber(post.stats.likes)}</span>
              <span className="flex items-center gap-1" title={`${formatNumber(post.stats.views)} 浏览`}><Eye className="h-4 w-4" />{formatCompactNumber(post.stats.views)}</span>
            </div>
          </div>
        )
      })}
    </>
  )
}
