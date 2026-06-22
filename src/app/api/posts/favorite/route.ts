import { togglePostFavorite } from "@/db/interaction-queries"
import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { handlePostFavoriteSideEffects } from "@/lib/interaction-side-effects"
import { revalidatePostDataCache, revalidatePostViewerCache } from "@/lib/post-detail-cache"
import { logRequestSucceeded } from "@/lib/request-log"
import { recordFavoritePostTaskEvent } from "@/lib/task-center-service"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少帖子参数")
  const requestUrl = new URL(request.url)

  await executeAddonActionHook("post.favorite.toggle.before", {
    postId,
    userId: currentUser.id,
  }, { request, pathname: requestUrl.pathname, searchParams: requestUrl.searchParams })

  const result = await togglePostFavorite({
    userId: currentUser.id,
    postId,
  })

  await handlePostFavoriteSideEffects({
    favored: result.favored,
    postId,
    userId: currentUser.id,
  })

  if (result.favored) {
    void recordFavoritePostTaskEvent({
      type: "FAVORITE_POST",
      userId: currentUser.id,
      postId,
    }).catch((error) => {
      console.error("[api/posts/favorite] record favorite task event failed", error)
    })
  }

  revalidateUserSurfaceCache(currentUser.id)
  revalidatePostDataCache({ postId })
  revalidatePostViewerCache(currentUser.id)

  logRequestSucceeded({
    scope: "posts-favorite",
    action: "toggle-post-favorite",
    userId: currentUser.id,
    targetId: postId,
  }, {
    favored: result.favored,
  })

  await executeAddonActionHook("post.favorite.toggle.after", {
    postId,
    userId: currentUser.id,
    favorited: result.favored,
  }, { request, pathname: requestUrl.pathname, searchParams: requestUrl.searchParams })

  return apiSuccess({ favored: result.favored }, result.favored ? "收藏成功" : "已取消收藏")
}, {
  errorMessage: "帖子收藏失败",
  logPrefix: "[api/posts/favorite] unexpected error",
  unauthorizedMessage: "请先登录后再收藏",
  allowStatuses: ["ACTIVE", "MUTED"],
})

