export const COMMENT_LOAD_MODE_PAGINATION = "PAGINATION"
export const COMMENT_LOAD_MODE_INFINITE = "INFINITE"

export type CommentLoadMode = typeof COMMENT_LOAD_MODE_PAGINATION | typeof COMMENT_LOAD_MODE_INFINITE

export function normalizeCommentLoadMode(
  value: unknown,
  fallback: CommentLoadMode = COMMENT_LOAD_MODE_PAGINATION,
): CommentLoadMode {
  if (value === COMMENT_LOAD_MODE_PAGINATION || value === COMMENT_LOAD_MODE_INFINITE) {
    return value
  }

  return fallback
}
