export const POST_LIST_DISPLAY_MODE_DEFAULT = "DEFAULT"
export const POST_LIST_DISPLAY_MODE_GALLERY = "GALLERY"
export const POST_LIST_DISPLAY_MODE_WEIBO = "WEIBO"

export type PostListDisplayMode =
  | typeof POST_LIST_DISPLAY_MODE_DEFAULT
  | typeof POST_LIST_DISPLAY_MODE_GALLERY
  | typeof POST_LIST_DISPLAY_MODE_WEIBO

const POST_LIST_DISPLAY_MODES = [
  POST_LIST_DISPLAY_MODE_DEFAULT,
  POST_LIST_DISPLAY_MODE_GALLERY,
  POST_LIST_DISPLAY_MODE_WEIBO,
] as const

export function normalizePostListDisplayMode(value: unknown, fallback: PostListDisplayMode = POST_LIST_DISPLAY_MODE_DEFAULT): PostListDisplayMode {
  return POST_LIST_DISPLAY_MODES.some((mode) => mode === value) ? value as PostListDisplayMode : fallback
}

export function normalizeNullablePostListDisplayMode(value: unknown): PostListDisplayMode | null {
  return POST_LIST_DISPLAY_MODES.some((mode) => mode === value) ? value as PostListDisplayMode : null
}

export function resolvePostListDisplayMode(parent?: unknown, child?: unknown) {
  return normalizePostListDisplayMode(child, normalizePostListDisplayMode(parent))
}
