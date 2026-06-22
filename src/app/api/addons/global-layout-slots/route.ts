import { apiSuccess, createRouteHandler } from "@/lib/api-route"
import {
  getCachedGlobalLayoutAddonSlotsPayload,
  normalizeGlobalLayoutAddonPathname,
  resolveGlobalLayoutAddonDevice,
} from "@/addons-host/runtime/global-layout-slots"

export const GET = createRouteHandler(async ({ request }) => {
  const url = new URL(request.url)
  const pathname = normalizeGlobalLayoutAddonPathname(url.searchParams.get("pathname"))
  const device = resolveGlobalLayoutAddonDevice(request.headers.get("user-agent"))

  return apiSuccess(await getCachedGlobalLayoutAddonSlotsPayload(pathname, device))
}, {
  errorMessage: "获取全局插件插槽失败",
  logPrefix: "[api/addons/global-layout-slots:GET] unexpected error",
})
