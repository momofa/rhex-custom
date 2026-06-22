import { revalidatePath } from "next/cache"

import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { revalidateSiteSettingsCache } from "@/lib/admin-site-settings-shared"

export const dynamic = "force-dynamic"

import { updateSelfServeAdsAppConfig } from "@/lib/app-config"
import { getSelfServeAdsAdminData, revalidateSelfServeAdsCache, reviewSelfServeAdOrder } from "@/lib/self-serve-ads"

function revalidateSelfServeAdsDisplayPaths() {
  revalidateSelfServeAdsCache()
  revalidatePath("/", "layout")
  revalidatePath("/posts/[slug]", "page")
  revalidatePath("/admin/apps/self-serve-ads")
}

export const GET = createAdminRouteHandler(async () => {
  const data = await getSelfServeAdsAdminData()
  return apiSuccess(data)
}, {
  errorMessage: "广告后台数据加载失败",
  logPrefix: "[api/admin/apps/self-serve-ads:GET] unexpected error",
  unauthorizedMessage: "无权访问",
  permission: "admin.apps.manage",
})

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)

  if (body.action === "save-config") {
    const config = body.config && typeof body.config === "object" ? body.config as Record<string, unknown> : {}
    const data = await updateSelfServeAdsAppConfig(config)
    revalidateSiteSettingsCache()
    revalidateSelfServeAdsDisplayPaths()
    return apiSuccess(data, "应用配置已保存")
  }

  await reviewSelfServeAdOrder({
    id: String(body.id ?? ""),
    action: body.action === "approve" || body.action === "reject" || body.action === "expire" || body.action === "update" ? body.action : "update",

    reviewNote: typeof body.reviewNote === "string" ? body.reviewNote : undefined,
    slotIndex: typeof body.slotIndex === "number" ? body.slotIndex : Number(body.slotIndex ?? 0),
    title: typeof body.title === "string" ? body.title : undefined,
    linkUrl: typeof body.linkUrl === "string" ? body.linkUrl : undefined,
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
    textColor: typeof body.textColor === "string" ? body.textColor : undefined,
    backgroundColor: typeof body.backgroundColor === "string" ? body.backgroundColor : undefined,
    durationMonths: typeof body.durationMonths === "number" ? body.durationMonths : undefined,
  })


  revalidateSelfServeAdsDisplayPaths()
  revalidatePath("/admin")
  return apiSuccess(undefined, "广告订单已更新")
}, {
  errorMessage: "广告订单更新失败",
  logPrefix: "[api/admin/apps/self-serve-ads:POST] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.apps.manage",
})
