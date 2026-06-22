import { apiError, apiSuccess, createAdminRouteHandler } from "@/lib/api-route"
import type { AddonInstallPreviewData, AddonsAdminData } from "@/addons-host/admin-types"
import { inspectAddonZip, installAddonFromZip } from "@/addons-host/installer"
import { getAddonsAdminData } from "@/addons-host/management"

export const dynamic = "force-dynamic"

function parseBooleanField(value: FormDataEntryValue | null, fallback: boolean) {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (["true", "1", "on", "yes"].includes(normalized)) {
    return true
  }
  if (["false", "0", "off", "no"].includes(normalized)) {
    return false
  }

  return fallback
}

export const POST = createAdminRouteHandler<AddonsAdminData | AddonInstallPreviewData>(async ({ request }) => {
  const formData = await request.formData()
  const file = formData.get("file")
  const intent = typeof formData.get("intent") === "string"
    ? String(formData.get("intent")).trim().toLowerCase()
    : "install"

  if (!(file instanceof File)) {
    apiError(400, "请上传插件 zip 文件")
  }

  if (!file.name.toLowerCase().endsWith(".zip")) {
    apiError(400, "只支持上传 .zip 插件包")
  }

  const zipBuffer = Buffer.from(await file.arrayBuffer())
  const replaceExisting = parseBooleanField(formData.get("replaceExisting"), false)
  const enableAfterInstall = parseBooleanField(formData.get("enableAfterInstall"), true)

  if (intent === "inspect") {
    return apiSuccess(await inspectAddonZip({
      zipBuffer,
      enableAfterInstall,
    }))
  }

  const installed = await installAddonFromZip({
    zipBuffer,
    originalName: file.name,
    replaceExisting,
    enableAfterInstall,
  })

  return apiSuccess(
    await getAddonsAdminData(),
    installed.action === "upgraded"
      ? `已升级插件 ${installed.name}`
      : installed.action === "overwritten"
        ? `已覆盖安装插件 ${installed.name}`
      : `已安装插件 ${installed.name}`,
  )
}, {
  errorMessage: "插件安装失败",
  logPrefix: "[api/admin/addons/install:POST] unexpected error",
  unauthorizedMessage: "无权安装插件",
  permission: "admin.addons.manage",
})
