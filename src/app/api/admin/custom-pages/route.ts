import { revalidatePath } from "next/cache"

import { findCustomPageById } from "@/db/custom-page-queries"
import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { revalidateCustomPagesCache } from "@/lib/custom-pages"
import {
  getAdminCustomPageList,
  removeAdminCustomPage,
  saveAdminCustomPage,
  updateAdminCustomPageStatus,
} from "@/lib/admin-custom-pages"

export const GET = createAdminRouteHandler(async () => {
  const items = await getAdminCustomPageList()
  return apiSuccess(items)
}, {
  errorMessage: "获取自定义页面失败",
  logPrefix: "[api/admin/custom-pages:GET] unexpected error",
  unauthorizedMessage: "无权访问",
  permission: "admin.operations.manage",
})

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const action = String(body.action ?? "save")
  const input = {
    id: typeof body.id === "string" ? body.id : undefined,
    title: typeof body.title === "string" ? body.title : "",
    routePath: typeof body.routePath === "string" ? body.routePath : undefined,
    htmlContent: typeof body.htmlContent === "string" ? body.htmlContent : undefined,
    status: typeof body.status === "string" ? body.status : "DRAFT",
    includeHeader: typeof body.includeHeader === "boolean" ? body.includeHeader : undefined,
    includeFooter: typeof body.includeFooter === "boolean" ? body.includeFooter : undefined,
    includeLeftSidebar: typeof body.includeLeftSidebar === "boolean" ? body.includeLeftSidebar : undefined,
    includeRightSidebar: typeof body.includeRightSidebar === "boolean" ? body.includeRightSidebar : undefined,
  }

  const currentRecord = input.id ? await findCustomPageById(input.id) : null

  if (action === "delete") {
    await removeAdminCustomPage(String(input.id ?? ""))
    revalidateCustomPagesCache()
    if (currentRecord?.routePath) {
      revalidatePath(currentRecord.routePath)
    }
    revalidatePath("/admin")
    return apiSuccess(undefined, "自定义页面已删除")
  }

  if (action === "update-status") {
    const result = await updateAdminCustomPageStatus(String(input.id ?? ""), input.status)
    revalidateCustomPagesCache()
    revalidatePath(result.routePath)
    revalidatePath("/admin")
    return apiSuccess(undefined, "自定义页面状态已更新")
  }

  const result = await saveAdminCustomPage(input)
  revalidateCustomPagesCache()

  if (currentRecord?.routePath && currentRecord.routePath !== result.routePath) {
    revalidatePath(currentRecord.routePath)
  }

  revalidatePath(result.routePath)
  revalidatePath("/admin")
  return apiSuccess(undefined, input.id ? "自定义页面已更新" : "自定义页面已创建")
}, {
  errorMessage: "自定义页面操作失败",
  logPrefix: "[api/admin/custom-pages:POST] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.operations.manage",
})
