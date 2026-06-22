import { requireActiveCurrentUserRecord } from "@/db/current-user"

import { apiError, apiSuccess, createCustomRouteHandler, readJsonBody } from "@/lib/api-route"
import { getCheckInOverview, submitCheckInAction } from "@/lib/check-in-service"
import { revalidateCheckInMutation } from "@/lib/content-mutation-revalidation"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

async function buildCheckInContext(): Promise<Awaited<ReturnType<typeof requireActiveCurrentUserRecord>>> {
  try {
    return await requireActiveCurrentUserRecord()
  } catch (error) {
    const message = error instanceof Error ? error.message : "请先登录"
    const status = message === "当前登录用户不存在" ? 401 : 403
    apiError(status, status === 401 ? "请先登录" : message)
  }
}

export const GET = createCustomRouteHandler(async ({ request, context: user }) => {
  const month = new URL(request.url).searchParams.get("month")?.trim() || undefined
  const data = await getCheckInOverview(user, month)

  return apiSuccess(data)
}, {
  buildContext: buildCheckInContext,
  errorMessage: "获取签到日历失败",
  logPrefix: "[api/check-in:GET] unexpected error",
})

export const POST = createCustomRouteHandler(async ({ request, context: user }) => {
  let body: Record<string, unknown> | undefined

  try {
    body = await readJsonBody(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求体格式不正确"

    if (message !== "请求体必须为 JSON" && message !== "请求体格式不正确") {
      throw error
    }
  }

  const writeGuardInput = !body || typeof body !== "object" || Array.isArray(body)
    ? {
        action: "check-in",
        date: "",
      }
    : {
        action: body.action === "make-up" ? "make-up" : "check-in",
        date: typeof body.date === "string" ? body.date.trim() : "",
      }

  return withRequestWriteGuard(createRequestWriteGuardOptions("check-in-submit", {
    request,
    userId: user.id,
    input: writeGuardInput,
  }), async () => {
    const result = await submitCheckInAction(user, body)

    if (!result.alreadyCheckedIn) {
      logRouteWriteSuccess({
        scope: "check-in",
        action: result.makeUpCost !== undefined ? "make-up" : "check-in",
      }, {
        userId: user.id,
        targetId: result.date,
        extra: {
          makeUpCost: result.makeUpCost ?? 0,
          alreadyCheckedIn: false,
        },
      })

      revalidateCheckInMutation({ userId: user.id })
    }

    return apiSuccess({
      points: result.points,
      reward: result.reward,
      alreadyCheckedIn: result.alreadyCheckedIn,
      date: result.date,
      currentStreak: result.currentStreak,
      maxStreak: result.maxStreak,
      ...(typeof result.makeUpCost === "number" ? { makeUpCost: result.makeUpCost } : {}),
    }, result.message)
  })
}, {
  buildContext: buildCheckInContext,
  errorMessage: "签到失败",
  logPrefix: "[api/check-in:POST] unexpected error",
})
