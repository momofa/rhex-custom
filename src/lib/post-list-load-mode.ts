export const POST_LIST_LOAD_MODE_PAGINATION = "PAGINATION"
export const POST_LIST_LOAD_MODE_INFINITE = "INFINITE"

export type PostListLoadMode = typeof POST_LIST_LOAD_MODE_PAGINATION | typeof POST_LIST_LOAD_MODE_INFINITE

export function normalizePostListLoadMode(
  value: unknown,
  fallback: PostListLoadMode = POST_LIST_LOAD_MODE_PAGINATION,
): PostListLoadMode {
  if (value === POST_LIST_LOAD_MODE_PAGINATION || value === POST_LIST_LOAD_MODE_INFINITE) {
    return value
  }

  return fallback
}

export function normalizeNullablePostListLoadMode(value: unknown): PostListLoadMode | null {
  if (value === POST_LIST_LOAD_MODE_PAGINATION || value === POST_LIST_LOAD_MODE_INFINITE) {
    return value
  }

  return null
}

export function resolvePostListLoadMode(parent?: unknown, child?: unknown) {
  return normalizePostListLoadMode(child, normalizePostListLoadMode(parent))
}
