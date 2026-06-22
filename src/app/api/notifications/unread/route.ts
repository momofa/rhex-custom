import { apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { getUserNotifications, getUserUnreadNotificationCount } from "@/lib/notifications"

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 10

function readLimit(request: Request) {
  const rawLimit = new URL(request.url).searchParams.get("limit")
  const parsedLimit = rawLimit ? Number(rawLimit) : DEFAULT_LIMIT

  if (!Number.isFinite(parsedLimit)) {
    return DEFAULT_LIMIT
  }

  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsedLimit)))
}

export const GET = createUserRouteHandler(async ({ request, currentUser }) => {
  const limit = readLimit(request)
  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(currentUser.id, {
      pageSize: limit,
      unreadOnly: true,
    }),
    getUserUnreadNotificationCount(currentUser.id),
  ])

  return apiSuccess({
    items: notifications.items,
    unreadCount,
  }, "success")
}, {
  errorMessage: "获取未读通知失败",
  logPrefix: "[api/notifications/unread] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
