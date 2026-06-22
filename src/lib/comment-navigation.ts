import { COMMENT_LOAD_MODE_INFINITE, COMMENT_LOAD_MODE_PAGINATION, type CommentLoadMode } from "@/lib/comment-load-mode"

export interface CommentNavigationTarget {
  page?: number
  sort?: string
  view?: string
  anchor?: string
}

export function buildCommentNavigationUrl(params: {
  pathname: string
  searchParams: { toString(): string } | string
  navigation: CommentNavigationTarget
  commentLoadMode?: CommentLoadMode
}) {
  const nextSearchParams = new URLSearchParams(params.searchParams.toString())
  const commentLoadMode = params.commentLoadMode ?? COMMENT_LOAD_MODE_PAGINATION

  if (params.navigation.page && commentLoadMode !== COMMENT_LOAD_MODE_INFINITE) {
    nextSearchParams.set("page", String(params.navigation.page))
  } else if (commentLoadMode === COMMENT_LOAD_MODE_INFINITE) {
    nextSearchParams.delete("page")
  }

  if (params.navigation.sort) {
    nextSearchParams.set("sort", params.navigation.sort)
  }
  if (params.navigation.view) {
    nextSearchParams.set("view", params.navigation.view)
  }

  const nextSearch = nextSearchParams.toString()
  return `${params.pathname}${nextSearch ? `?${nextSearch}` : ""}#${params.navigation.anchor || "comments"}`
}
