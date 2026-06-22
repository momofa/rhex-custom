# Cache Refresh Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix stale UI after check-in, after publishing a post and navigating back, and after AI background replies create comments.

**Architecture:** Keep write-side cache invalidation on the server, and add a small client refresh layer only for browser history restoration. Normal user writes will invalidate the relevant Next.js tags and paths inside Route Handlers. AI replies run in the background worker, so they will call an internal Route Handler to perform Next.js cache invalidation in a legal server request context.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma, existing `unstable_cache` tags, `revalidateTag`, `revalidatePath`, Node test runner via `pnpm test`.

---

## File Structure

- Modify: `src/lib/content-list-cache.ts`
  - Add immediate-expiry variants for content-list tags.
- Create: `src/lib/content-mutation-revalidation.ts`
  - Centralize post/comment/check-in invalidation paths and tags.
- Modify: `src/app/api/check-in/route.ts`
  - Use shared check-in invalidation after successful check-in or make-up.
- Modify: `src/lib/post-create-execution.ts`
  - Use shared post-create invalidation after approved posts.
- Modify: `src/lib/comment-create-execution.ts`
  - Use shared comment-create invalidation for normal comments.
- Create: `src/app/api/internal/revalidate-content/route.ts`
  - Internal-only route that performs invalidation for background workers.
- Create: `src/lib/internal-revalidation-client.ts`
  - Worker-side helper for calling the internal route.
- Modify: `src/lib/ai-reply.ts`
  - After AI creates a comment, call the internal revalidation route and keep existing notification behavior.
- Modify: `src/components/current-user-provider.tsx`
  - Refresh `/api/auth/me` on browser bfcache restore or tab-visible return.
- Modify: `src/components/post/use-create-post-submit.ts`
  - Use Next router navigation plus a post-create marker instead of `window.location.assign`.
- Create: `src/components/navigation-stale-refresh.tsx`
  - Refresh the current route when a page is restored from browser history after a known mutation.
- Modify: `src/app/root-runtime-providers.tsx`
  - Mount `NavigationStaleRefresh`.
- Create: `test/cache-refresh-consistency.test.ts`
  - Static regression tests for the intended hooks and cache invalidation calls.

---

### Task 1: Add Immediate Content Cache Helpers

**Files:**
- Modify: `src/lib/content-list-cache.ts`
- Test: `test/cache-refresh-consistency.test.ts`

- [ ] **Step 1: Extend content-list invalidation helper**

Replace the current `revalidateContentListTag` helper with profile-aware helpers:

```ts
import { revalidateTag } from "next/cache"

import {
  expireTaxonomyContentCacheImmediately,
  revalidateTaxonomyContentCache,
} from "@/lib/taxonomy-cache"

export const FORUM_FEED_CACHE_TAG = "forum-feed"
export const HOME_SIDEBAR_HOT_TOPICS_CACHE_TAG = "home-sidebar-hot-topics"

type ContentListRevalidateProfile = "max" | { expire: 0 }

function revalidateContentListTag(tag: string, profile: ContentListRevalidateProfile) {
  try {
    revalidateTag(tag, profile)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.startsWith("Invariant: static generation store missing in revalidateTag")
      || message.includes('used "revalidateTag ')
    ) {
      return
    }

    throw error
  }
}

export function revalidateForumFeedCache() {
  revalidateContentListTag(FORUM_FEED_CACHE_TAG, "max")
}

export function expireForumFeedCacheImmediately() {
  revalidateContentListTag(FORUM_FEED_CACHE_TAG, { expire: 0 })
}

export function revalidateHomeSidebarHotTopicsCache() {
  revalidateContentListTag(HOME_SIDEBAR_HOT_TOPICS_CACHE_TAG, "max")
}

export function expireHomeSidebarHotTopicsCacheImmediately() {
  revalidateContentListTag(HOME_SIDEBAR_HOT_TOPICS_CACHE_TAG, { expire: 0 })
}

export function revalidateContentListCaches() {
  revalidateForumFeedCache()
  revalidateHomeSidebarHotTopicsCache()
  revalidateTaxonomyContentCache()
}

export function expireContentListCachesImmediately() {
  expireForumFeedCacheImmediately()
  expireHomeSidebarHotTopicsCacheImmediately()
  expireTaxonomyContentCacheImmediately()
}
```

- [ ] **Step 2: Add static regression test**

Append to `test/cache-refresh-consistency.test.ts` after creating it in Task 8:

```ts
test("content-list cache exposes immediate expiry for read-your-own-write flows", () => {
  const source = readProjectFile("src/lib/content-list-cache.ts")

  assert.match(source, /export function expireContentListCachesImmediately/)
  assert.match(source, /revalidateTag\(tag,\s*profile\)/)
  assert.match(source, /expireTaxonomyContentCacheImmediately/)
})
```

- [ ] **Step 3: Run focused test**

Run: `pnpm exec tsx --test test/cache-refresh-consistency.test.ts`

Expected: PASS.

---

### Task 2: Centralize Mutation Revalidation

**Files:**
- Create: `src/lib/content-mutation-revalidation.ts`
- Test: `test/cache-refresh-consistency.test.ts`

- [ ] **Step 1: Create shared server revalidation module**

Create `src/lib/content-mutation-revalidation.ts`:

```ts
import "server-only"

import { revalidatePath } from "next/cache"

import { expireContentListCachesImmediately } from "@/lib/content-list-cache"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import {
  revalidatePostCommentCache,
  revalidatePostDetailCache,
  revalidatePostViewerCache,
} from "@/lib/post-detail-cache"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"

function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    if (type) {
      revalidatePath(path, type)
      return
    }

    revalidatePath(path)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.startsWith("Invariant: static generation store missing in revalidatePath")
      || message.includes('used "revalidatePath ')
    ) {
      return
    }

    throw error
  }
}

export function revalidateCheckInMutation(input: { userId: number }) {
  revalidateUserSurfaceCache(input.userId)
  safeRevalidatePath("/", "layout")
}

export function revalidateApprovedPostMutation(input: {
  postId: string
  postSlug: string
  boardSlug?: string | null
  authorId: number
}) {
  revalidateUserSurfaceCache(input.authorId)
  expireContentListCachesImmediately()
  revalidateHomeSidebarStatsCache()
  revalidatePostDetailCache({ postId: input.postId, slug: input.postSlug })
  safeRevalidatePath("/")
  safeRevalidatePath("/new")
  safeRevalidatePath("/hot")
  safeRevalidatePath("/following")
  safeRevalidatePath("/posts/[slug]", "page")

  if (input.boardSlug) {
    safeRevalidatePath(`/boards/${input.boardSlug}`)
  }
}

export function revalidateApprovedCommentMutation(input: {
  postId: string
  postSlug?: string | null
  boardSlug?: string | null
  authorId: number
}) {
  revalidateUserSurfaceCache(input.authorId)
  revalidatePostViewerCache(input.authorId)
  revalidatePostCommentCache({ postId: input.postId, slug: input.postSlug })
  expireContentListCachesImmediately()
  revalidateHomeSidebarStatsCache()
  safeRevalidatePath("/")
  safeRevalidatePath("/new")
  safeRevalidatePath("/hot")
  safeRevalidatePath("/following")
  safeRevalidatePath("/posts/[slug]", "page")

  if (input.postSlug) {
    safeRevalidatePath(`/posts/${input.postSlug}`)
  }

  if (input.boardSlug) {
    safeRevalidatePath(`/boards/${input.boardSlug}`)
  }
}
```

- [ ] **Step 2: Add regression coverage for path invalidation**

Add to `test/cache-refresh-consistency.test.ts`:

```ts
test("mutation revalidation invalidates feed, post, board, and user-surface caches", () => {
  const source = readProjectFile("src/lib/content-mutation-revalidation.ts")

  assert.match(source, /revalidateCheckInMutation/)
  assert.match(source, /revalidateApprovedPostMutation/)
  assert.match(source, /revalidateApprovedCommentMutation/)
  assert.match(source, /expireContentListCachesImmediately\(\)/)
  assert.match(source, /revalidatePostCommentCache/)
  assert.match(source, /revalidatePath\("\/posts\/\[slug\]",\s*"page"\)/)
  assert.match(source, /revalidatePath\("\/",\s*"layout"\)/)
})
```

- [ ] **Step 3: Run focused test**

Run: `pnpm exec tsx --test test/cache-refresh-consistency.test.ts`

Expected: PASS.

---

### Task 3: Wire Normal Write APIs to Shared Revalidation

**Files:**
- Modify: `src/app/api/check-in/route.ts`
- Modify: `src/lib/post-create-execution.ts`
- Modify: `src/lib/comment-create-execution.ts`
- Test: `test/cache-refresh-consistency.test.ts`

- [ ] **Step 1: Update check-in route**

In `src/app/api/check-in/route.ts`, replace:

```ts
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
```

with:

```ts
import { revalidateCheckInMutation } from "@/lib/content-mutation-revalidation"
```

Then replace:

```ts
revalidateUserSurfaceCache(user.id)
```

with:

```ts
revalidateCheckInMutation({ userId: user.id })
```

- [ ] **Step 2: Update post create execution**

In `src/lib/post-create-execution.ts`, remove these imports:

```ts
import { revalidateContentListCaches } from "@/lib/content-list-cache"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
```

Add:

```ts
import { revalidateApprovedPostMutation } from "@/lib/content-mutation-revalidation"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
```

Replace:

```ts
revalidateUserSurfaceCache(result.author.id)
if (!result.shouldPending) {
  revalidateContentListCaches()
  revalidateHomeSidebarStatsCache()
  expireTaxonomyCacheImmediately()
  void recordApprovedPostTaskEvent({
```

with:

```ts
if (!result.shouldPending) {
  revalidateApprovedPostMutation({
    postId: result.post.id,
    postSlug: result.post.slug,
    boardSlug: result.post.board?.slug ?? null,
    authorId: result.author.id,
  })
  expireTaxonomyCacheImmediately()
  void recordApprovedPostTaskEvent({
```

Then add a pending-review branch immediately after that block:

```ts
if (result.shouldPending) {
  revalidateUserSurfaceCache(result.author.id)
}
```

If TypeScript shows `result.post.board` is not selected, either use the selected board slug from `createPostFlow` if available, or update `createPostFlow` return selection to include `board: { select: { slug: true } }`.

- [ ] **Step 3: Update comment create execution**

In `src/lib/comment-create-execution.ts`, remove these imports:

```ts
import { revalidateContentListCaches } from "@/lib/content-list-cache"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { revalidatePostCommentCache, revalidatePostViewerCache } from "@/lib/post-detail-cache"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
```

Add:

```ts
import { revalidateApprovedCommentMutation } from "@/lib/content-mutation-revalidation"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
```

Replace:

```ts
revalidateUserSurfaceCache(author.id)
revalidatePostViewerCache(author.id)
revalidatePostCommentCache({ postId: result.postId, slug: result.postSlug })
if (!result.reviewRequired) {
  revalidateContentListCaches()
  revalidateHomeSidebarStatsCache()
  void recordApprovedCommentTaskEvent({
```

with:

```ts
if (result.reviewRequired) {
  revalidateUserSurfaceCache(author.id)
} else {
  revalidateApprovedCommentMutation({
    postId: result.postId,
    postSlug: result.postSlug,
    boardSlug: result.boardSlug,
    authorId: author.id,
  })
  void recordApprovedCommentTaskEvent({
```

- [ ] **Step 4: Add static tests for wiring**

Add to `test/cache-refresh-consistency.test.ts`:

```ts
test("check-in API uses shared mutation revalidation", () => {
  const source = readProjectFile("src/app/api/check-in/route.ts")

  assert.match(source, /revalidateCheckInMutation/)
  assert.doesNotMatch(source, /revalidateUserSurfaceCache\(user\.id\)/)
})

test("post creation uses approved post mutation revalidation", () => {
  const source = readProjectFile("src/lib/post-create-execution.ts")

  assert.match(source, /revalidateApprovedPostMutation/)
  assert.match(source, /postSlug:\s*result\.post\.slug/)
})

test("comment creation uses approved comment mutation revalidation", () => {
  const source = readProjectFile("src/lib/comment-create-execution.ts")

  assert.match(source, /revalidateApprovedCommentMutation/)
  assert.match(source, /boardSlug:\s*result\.boardSlug/)
})
```

- [ ] **Step 5: Run tests**

Run: `pnpm exec tsx --test test/cache-refresh-consistency.test.ts`

Expected: PASS.

---

### Task 4: Add Internal Revalidation Route for Worker Writes

**Files:**
- Create: `src/app/api/internal/revalidate-content/route.ts`
- Create: `src/lib/internal-revalidation-client.ts`
- Test: `test/cache-refresh-consistency.test.ts`

- [ ] **Step 1: Create internal route**

Create `src/app/api/internal/revalidate-content/route.ts`:

```ts
import { apiError, apiSuccess, createRouteHandler, readJsonBody } from "@/lib/api-route"
import {
  revalidateApprovedCommentMutation,
  revalidateApprovedPostMutation,
  revalidateCheckInMutation,
} from "@/lib/content-mutation-revalidation"

type InternalRevalidationBody =
  | { type: "check-in"; userId: number }
  | { type: "approved-post"; postId: string; postSlug: string; boardSlug?: string | null; authorId: number }
  | { type: "approved-comment"; postId: string; postSlug?: string | null; boardSlug?: string | null; authorId: number }

function getInternalSecret() {
  return process.env.INTERNAL_REVALIDATION_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || ""
}

function requireInternalSecret(request: Request) {
  const expected = getInternalSecret()
  const received = request.headers.get("x-internal-revalidation-secret")?.trim() ?? ""

  if (!expected || received !== expected) {
    apiError(403, "无权操作")
  }
}

function asSafeNumber(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeBody(body: Record<string, unknown>): InternalRevalidationBody {
  if (body.type === "check-in") {
    const userId = asSafeNumber(body.userId)
    if (!userId) apiError(400, "缺少用户 ID")
    return { type: "check-in", userId }
  }

  if (body.type === "approved-post") {
    const postId = asString(body.postId)
    const postSlug = asString(body.postSlug)
    const authorId = asSafeNumber(body.authorId)
    if (!postId || !postSlug || !authorId) apiError(400, "缺少帖子刷新参数")
    return {
      type: "approved-post",
      postId,
      postSlug,
      authorId,
      boardSlug: asString(body.boardSlug),
    }
  }

  if (body.type === "approved-comment") {
    const postId = asString(body.postId)
    const authorId = asSafeNumber(body.authorId)
    if (!postId || !authorId) apiError(400, "缺少评论刷新参数")
    return {
      type: "approved-comment",
      postId,
      authorId,
      postSlug: asString(body.postSlug),
      boardSlug: asString(body.boardSlug),
    }
  }

  apiError(400, "不支持的刷新类型")
}

export const POST = createRouteHandler(async ({ request }) => {
  requireInternalSecret(request)
  const body = normalizeBody(await readJsonBody(request))

  if (body.type === "check-in") {
    revalidateCheckInMutation(body)
  } else if (body.type === "approved-post") {
    revalidateApprovedPostMutation(body)
  } else {
    revalidateApprovedCommentMutation(body)
  }

  return apiSuccess({ type: body.type }, "ok")
}, {
  errorMessage: "刷新缓存失败",
  logPrefix: "[api/internal/revalidate-content] unexpected error",
})
```

- [ ] **Step 2: Create worker client**

Create `src/lib/internal-revalidation-client.ts`:

```ts
import "server-only"

import { getConfiguredSiteOrigin } from "@/lib/site-origin-config"

type InternalRevalidationPayload =
  | { type: "check-in"; userId: number }
  | { type: "approved-post"; postId: string; postSlug: string; boardSlug?: string | null; authorId: number }
  | { type: "approved-comment"; postId: string; postSlug?: string | null; boardSlug?: string | null; authorId: number }

function getInternalSecret() {
  return process.env.INTERNAL_REVALIDATION_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || ""
}

export async function requestInternalContentRevalidation(payload: InternalRevalidationPayload) {
  const origin = getConfiguredSiteOrigin()
  const secret = getInternalSecret()

  if (!origin || !secret) {
    return false
  }

  const response = await fetch(new URL("/api/internal/revalidate-content", `${origin}/`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-revalidation-secret": secret,
    },
    body: JSON.stringify(payload),
  })

  return response.ok
}
```

- [ ] **Step 3: Add `.env.example` documentation**

Append to `.env.example`:

```dotenv
# Optional. Used by background workers to request Next.js cache invalidation.
# Defaults to SESSION_SECRET when omitted. Set this explicitly if workers and web
# run in separate trust boundaries.
# INTERNAL_REVALIDATION_SECRET="replace-with-a-long-random-secret"
```

- [ ] **Step 4: Add static tests**

Add to `test/cache-refresh-consistency.test.ts`:

```ts
test("internal revalidation route is protected and calls shared mutation invalidators", () => {
  const route = readProjectFile("src/app/api/internal/revalidate-content/route.ts")
  const client = readProjectFile("src/lib/internal-revalidation-client.ts")

  assert.match(route, /x-internal-revalidation-secret/)
  assert.match(route, /revalidateApprovedCommentMutation/)
  assert.match(route, /revalidateApprovedPostMutation/)
  assert.match(route, /revalidateCheckInMutation/)
  assert.match(client, /\/api\/internal\/revalidate-content/)
  assert.match(client, /getConfiguredSiteOrigin/)
})
```

- [ ] **Step 5: Run tests**

Run: `pnpm exec tsx --test test/cache-refresh-consistency.test.ts`

Expected: PASS.

---

### Task 5: Revalidate After AI Background Reply

**Files:**
- Modify: `src/lib/ai-reply.ts`
- Test: `test/cache-refresh-consistency.test.ts`

- [ ] **Step 1: Add import**

In `src/lib/ai-reply.ts`, add:

```ts
import { requestInternalContentRevalidation } from "@/lib/internal-revalidation-client"
```

- [ ] **Step 2: Include post slug and board slug in worker task selection**

Inside `loadAiReplyTaskForWorker`, ensure `post.select` includes:

```ts
slug: true,
board: {
  select: {
    slug: true,
  },
},
```

- [ ] **Step 3: Request invalidation after AI comment succeeds**

Immediately after:

```ts
await markAiReplyTaskSucceeded(task.id, createdComment.id, createdComment.content)
```

add:

```ts
await requestInternalContentRevalidation({
  type: "approved-comment",
  postId: task.postId,
  postSlug: task.post.slug,
  boardSlug: task.post.board.slug,
  authorId: task.agentUserId,
}).catch((error) => {
  logError({
    scope: "ai-reply",
    action: "revalidate-cache",
    userId: task.agentUserId,
    targetId: createdComment.id,
    metadata: {
      postId: task.postId,
      sourceType: task.sourceType,
    },
  }, error)
})
```

- [ ] **Step 4: Add static test**

Add to `test/cache-refresh-consistency.test.ts`:

```ts
test("AI reply worker requests content revalidation after generated comment succeeds", () => {
  const source = readProjectFile("src/lib/ai-reply.ts")

  assert.match(source, /requestInternalContentRevalidation/)
  assert.match(source, /type:\s*"approved-comment"/)
  assert.match(source, /postSlug:\s*task\.post\.slug/)
  assert.match(source, /boardSlug:\s*task\.post\.board\.slug/)
})
```

- [ ] **Step 5: Run tests**

Run: `pnpm exec tsx --test test/cache-refresh-consistency.test.ts`

Expected: PASS.

---

### Task 6: Make Check-In UI Refresh User Surface Reliably

**Files:**
- Modify: `src/components/user/sidebar-user-card.tsx`
- Modify: `src/components/home/auto-check-in-on-home-enter.tsx`
- Test: `test/cache-refresh-consistency.test.ts`

- [ ] **Step 1: Let SidebarUserCard refresh current-user context**

In `src/components/user/sidebar-user-card.tsx`, import:

```ts
import { useCurrentUser } from "@/components/current-user-provider"
```

Inside `SidebarUserCard`, add:

```ts
const { refresh: refreshCurrentUser } = useCurrentUser()
```

After successful check-in and successful make-up, call:

```ts
void refreshCurrentUser()
```

Place it beside existing `router.refresh()` calls.

- [ ] **Step 2: Let auto check-in refresh current-user context**

In `src/components/home/auto-check-in-on-home-enter.tsx`, import:

```ts
import { useCurrentUser } from "@/components/current-user-provider"
```

Inside `AutoCheckInOnHomeEnter`, add:

```ts
const { refresh: refreshCurrentUser } = useCurrentUser()
```

After the successful non-duplicate check-in branch sets session storage to `done`, add:

```ts
void refreshCurrentUser()
```

- [ ] **Step 3: Add static test**

Add to `test/cache-refresh-consistency.test.ts`:

```ts
test("check-in client surfaces refresh current-user context after success", () => {
  const sidebar = readProjectFile("src/components/user/sidebar-user-card.tsx")
  const auto = readProjectFile("src/components/home/auto-check-in-on-home-enter.tsx")

  assert.match(sidebar, /refreshCurrentUser/)
  assert.match(auto, /refreshCurrentUser/)
})
```

- [ ] **Step 4: Run tests**

Run: `pnpm exec tsx --test test/cache-refresh-consistency.test.ts`

Expected: PASS.

---

### Task 7: Refresh Restored Pages After Mutations

**Files:**
- Modify: `src/components/current-user-provider.tsx`
- Modify: `src/components/post/use-create-post-submit.ts`
- Create: `src/components/navigation-stale-refresh.tsx`
- Modify: `src/app/root-runtime-providers.tsx`
- Test: `test/cache-refresh-consistency.test.ts`

- [ ] **Step 1: Refresh current-user context on bfcache restore**

In `src/components/current-user-provider.tsx`, add this effect inside `CurrentUserProvider`:

```ts
useEffect(() => {
  function handlePageShow(event: PageTransitionEvent) {
    if (event.persisted) {
      void refresh()
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      void refresh()
    }
  }

  window.addEventListener("pageshow", handlePageShow)
  document.addEventListener("visibilitychange", handleVisibilityChange)

  return () => {
    window.removeEventListener("pageshow", handlePageShow)
    document.removeEventListener("visibilitychange", handleVisibilityChange)
  }
}, [refresh])
```

- [ ] **Step 2: Switch post publish navigation to router navigation and mark mutation**

In `src/components/post/use-create-post-submit.ts`, import:

```ts
import { useRouter } from "next/navigation"
```

Inside `useCreatePostSubmit`, add:

```ts
const router = useRouter()
```

Replace:

```ts
window.location.assign(targetPath)
return
```

with:

```ts
window.sessionStorage.setItem("rhex:content-mutated-at", String(Date.now()))
router.push(targetPath)
router.refresh()
return
```

Keep the `window.location.reload()` fallback for missing target paths.

- [ ] **Step 3: Add navigation stale refresh component**

Create `src/components/navigation-stale-refresh.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

const MUTATION_MARKER_KEY = "rhex:content-mutated-at"

function readMutationMarker() {
  const raw = window.sessionStorage.getItem(MUTATION_MARKER_KEY)
  const value = raw ? Number(raw) : 0
  return Number.isFinite(value) ? value : 0
}

export function NavigationStaleRefresh() {
  const router = useRouter()
  const lastHandledMarkerRef = useRef(0)

  useEffect(() => {
    function refreshIfNeeded(force = false) {
      const marker = readMutationMarker()
      if (!marker || (!force && marker === lastHandledMarkerRef.current)) {
        return
      }

      lastHandledMarkerRef.current = marker
      router.refresh()
    }

    function handlePageShow(event: PageTransitionEvent) {
      refreshIfNeeded(event.persisted)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshIfNeeded()
      }
    }

    window.addEventListener("pageshow", handlePageShow)
    window.addEventListener("focus", refreshIfNeeded)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("pageshow", handlePageShow)
      window.removeEventListener("focus", refreshIfNeeded)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [router])

  return null
}
```

- [ ] **Step 4: Mount stale refresh component**

In `src/app/root-runtime-providers.tsx`, import:

```ts
import { NavigationStaleRefresh } from "@/components/navigation-stale-refresh"
```

Render it near `RootBootstrap`:

```tsx
<RootBootstrap />
<NavigationStaleRefresh />
```

- [ ] **Step 5: Add static test**

Add to `test/cache-refresh-consistency.test.ts`:

```ts
test("post publish marks mutation and restored pages refresh", () => {
  const submit = readProjectFile("src/components/post/use-create-post-submit.ts")
  const refresh = readProjectFile("src/components/navigation-stale-refresh.tsx")
  const root = readProjectFile("src/app/root-runtime-providers.tsx")

  assert.match(submit, /rhex:content-mutated-at/)
  assert.match(submit, /router\.push\(targetPath\)/)
  assert.match(refresh, /pageshow/)
  assert.match(refresh, /router\.refresh\(\)/)
  assert.match(root, /<NavigationStaleRefresh \/>/)
})
```

- [ ] **Step 6: Run tests**

Run: `pnpm exec tsx --test test/cache-refresh-consistency.test.ts`

Expected: PASS.

---

### Task 8: Create Regression Test File

**Files:**
- Create: `test/cache-refresh-consistency.test.ts`

- [ ] **Step 1: Create test scaffold**

Create `test/cache-refresh-consistency.test.ts`:

```ts
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}
```

- [ ] **Step 2: Add all tests from Tasks 1-7**

Append the test blocks listed in Tasks 1-7.

- [ ] **Step 3: Run focused test**

Run: `pnpm exec tsx --test test/cache-refresh-consistency.test.ts`

Expected: PASS.

---

### Task 9: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Type-check with Next build**

Run: `pnpm build`

Expected: Build completes. If unrelated existing production `ignoreBuildErrors` hides TypeScript issues, still inspect terminal output for errors from touched files.

- [ ] **Step 2: Run unit tests**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 3: Browser verification**

Start dev server:

```powershell
pnpm dev
```

Open the app and verify:

1. Sign in, trigger check-in from home sidebar and mobile quick actions.
2. Confirm header/sidebar immediately show "今日已签到" and updated points without manual hard refresh.
3. Publish a normal visible post.
4. Return to `/`, `/new`, and the target `/boards/<slug>` using browser Back.
5. Confirm the new post appears without manual hard refresh.
6. Trigger AI reply and wait for the background job to create the comment.
7. Open or refresh the post route normally; confirm comment count and comment list include the AI reply.

- [ ] **Step 4: Production configuration check**

For deployments where `scripts/worker.ts` runs separately from the web process, ensure:

```dotenv
SITE_URL="https://your-site.example"
INTERNAL_REVALIDATION_SECRET="same-secret-in-web-and-worker"
```

`INTERNAL_REVALIDATION_SECRET` can be omitted only if web and worker share `SESSION_SECRET` and the same trust boundary.

---

## Self-Review

- Spec coverage: check-in stale UI is covered by `revalidateCheckInMutation`, current-user context refresh, and bfcache restore refresh. Post publish back-navigation stale list is covered by immediate content tag expiry, path invalidation, router navigation, and mutation marker refresh. AI reply stale cache is covered by the internal revalidation route called after worker-created comments.
- Placeholder scan: no `TBD`, `TODO`, or unresolved placeholders remain.
- Type consistency: shared invalidator names match all imports; internal route payload type matches worker client payload type; `boardSlug` and `postSlug` are consistently optional for comments and required for approved posts.
