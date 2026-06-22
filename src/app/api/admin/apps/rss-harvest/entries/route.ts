import { revalidatePath } from "next/cache"

import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { getRequestIp, writeAdminLog } from "@/lib/admin"
import {
  batchDeleteRssEntries,
  batchReviewRssEntries,
  deleteRssEntry,
  getRssEntryAdminPageData,
  reviewRssEntry,
  updateRssEntry,
} from "@/lib/rss-entry-admin"

export const dynamic = "force-dynamic"

export const GET = createAdminRouteHandler<unknown>(async ({ request }) => {
  const url = new URL(request.url)
  const data = await getRssEntryAdminPageData({
    keyword: url.searchParams.get("keyword") ?? "",
    sourceId: url.searchParams.get("sourceId") ?? "",
    reviewStatus: url.searchParams.get("reviewStatus") ?? "ALL",
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "20",
  })
  return apiSuccess(data)
}, {
  errorMessage: "RSS 采集数据加载失败",
  logPrefix: "[api/admin/apps/rss-harvest/entries:GET] unexpected error",
  unauthorizedMessage: "无权访问",
  permission: "admin.apps.manage",
})

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const action = typeof body.action === "string" ? body.action.trim() : ""
  const requestIp = getRequestIp(request)

  if (action === "update-entry") {
    const updated = await updateRssEntry({
      entryId: body.entryId,
      title: body.title,
      linkUrl: body.linkUrl,
      author: body.author,
      summary: body.summary,
      contentHtml: body.contentHtml,
      contentText: body.contentText,
      publishedAt: body.publishedAt,
      reviewStatus: body.reviewStatus,
      reviewNote: body.reviewNote,
      adminUserId: adminUser.id,
    })
    await writeAdminLog(adminUser.id, "rss.entry.update", "RSS_ENTRY", updated.id, `更新采集数据 ${updated.title}`, requestIp)
    revalidatePath("/admin/apps/rss-harvest")
    revalidatePath("/admin/apps/rss-harvest/entries")
    return apiSuccess(undefined, "采集数据已更新")
  }

  if (action === "review-entry") {
    const updated = await reviewRssEntry({
      entryId: body.entryId,
      reviewStatus: body.reviewStatus,
      reviewNote: body.reviewNote,
      adminUserId: adminUser.id,
    })
    await writeAdminLog(adminUser.id, `rss.entry.review.${String(body.reviewStatus ?? "").toLowerCase()}`, "RSS_ENTRY", updated.id, `审核采集数据 ${updated.title}`, requestIp)
    revalidatePath("/admin/apps/rss-harvest")
    revalidatePath("/admin/apps/rss-harvest/entries")
    return apiSuccess(undefined, "采集数据审核状态已更新")
  }

  if (action === "delete-entry") {
    const deleted = await deleteRssEntry(typeof body.entryId === "string" ? body.entryId : "")
    await writeAdminLog(adminUser.id, "rss.entry.delete", "RSS_ENTRY", deleted.id, `删除采集数据 ${deleted.title}`, requestIp)
    revalidatePath("/admin/apps/rss-harvest")
    revalidatePath("/admin/apps/rss-harvest/entries")
    return apiSuccess(undefined, "采集数据已删除")
  }

  if (action === "batch-review") {
    const result = await batchReviewRssEntries({
      entryIds: body.entryIds,
      reviewStatus: body.reviewStatus,
      reviewNote: body.reviewNote,
      adminUserId: adminUser.id,
    })
    await writeAdminLog(adminUser.id, `rss.entry.batch-review.${String(body.reviewStatus ?? "").toLowerCase()}`, "RSS_ENTRY", "batch", `批量审核 RSS 采集数据 ${result.count} 条`, requestIp)
    revalidatePath("/admin/apps/rss-harvest")
    revalidatePath("/admin/apps/rss-harvest/entries")
    return apiSuccess(undefined, result.count > 0 ? `已处理 ${result.count} 条采集数据` : "未处理任何采集数据")
  }

  if (action === "batch-delete") {
    const result = await batchDeleteRssEntries(body.entryIds)
    await writeAdminLog(adminUser.id, "rss.entry.batch-delete", "RSS_ENTRY", "batch", `批量删除 RSS 采集数据 ${result.count} 条`, requestIp)
    revalidatePath("/admin/apps/rss-harvest")
    revalidatePath("/admin/apps/rss-harvest/entries")
    return apiSuccess(undefined, result.count > 0 ? `已删除 ${result.count} 条采集数据` : "未删除任何采集数据")
  }

  return apiSuccess(undefined, "未执行任何变更")
}, {
  errorMessage: "RSS 采集数据操作失败",
  logPrefix: "[api/admin/apps/rss-harvest/entries:POST] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.apps.manage",
})
