import { NextResponse } from "next/server"

import { executeAddonApi, normalizeAddonApiResult } from "@/addons-host/runtime/execute"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { requireAdminUser } from "@/lib/admin"
import type { AddonApiScope, AddonHttpMethod } from "@/addons-host/types"

interface AddonApiRouteContext {
  params: Promise<{
    addonId: string
    slug?: string[]
  }>
}

function normalizeHttpMethod(method: string): AddonHttpMethod {
  switch (method.toUpperCase()) {
    case "GET":
    case "POST":
    case "PUT":
    case "PATCH":
    case "DELETE":
    case "OPTIONS":
    case "HEAD":
      return method.toUpperCase() as AddonHttpMethod
    default:
      return "GET"
  }
}

export async function handleAddonApiRoute(scope: AddonApiScope, request: Request, routeContext: AddonApiRouteContext) {
  const requestUrl = new URL(request.url)
  const method = normalizeHttpMethod(request.method)

  if (scope === "admin") {
    const admin = await requireAdminUser("admin.addons.manage")
    if (!admin) {
      const response = NextResponse.json({ code: 403, message: "无权访问插件后台 API" }, { status: 403 })
      await emitAddonApiAfterHook({
        scope,
        addonId: "",
        routePath: "",
        routeSegments: [],
        method,
        pathname: requestUrl.pathname,
        status: response.status,
        matched: false,
      }, request, requestUrl)
      return response
    }
  }

  const params = await routeContext.params
  const routeSegments = params.slug ?? []
  const routePath = routeSegments.filter(Boolean).join("/")
  const afterHookBasePayload = {
    scope,
    addonId: params.addonId,
    routePath,
    routeSegments,
    method,
    pathname: requestUrl.pathname,
  }
  let resolved: Awaited<ReturnType<typeof executeAddonApi>>
  try {
    resolved = await executeAddonApi(
      scope,
      params.addonId,
      routeSegments,
      method,
      request,
    )
  } catch (error) {
    console.error(`[addons-host:${scope}-api] unexpected error`, error)
    const response = NextResponse.json({ code: 500, message: "插件 API 执行失败" }, { status: 500 })
    await emitAddonApiAfterHook({
      ...afterHookBasePayload,
      status: response.status,
      matched: true,
      errorMessage: error instanceof Error ? error.message : "addon api request failed",
    }, request, requestUrl)
    return response
  }

  if (!resolved) {
    const response = NextResponse.json({ code: 404, message: "插件 API 不存在" }, { status: 404 })
    await emitAddonApiAfterHook({
      ...afterHookBasePayload,
      status: response.status,
      matched: false,
    }, request, requestUrl)
    return response
  }

  try {
    const response = normalizeAddonApiResult(resolved.result)
    await emitAddonApiAfterHook({
      ...afterHookBasePayload,
      status: response.status,
      matched: true,
    }, request, requestUrl)
    return response
  } catch (error) {
    console.error(`[addons-host:${scope}-api] unexpected error`, error)
    const response = NextResponse.json({ code: 500, message: "插件 API 执行失败" }, { status: 500 })
    await emitAddonApiAfterHook({
      ...afterHookBasePayload,
      status: response.status,
      matched: true,
      errorMessage: error instanceof Error ? error.message : "addon api request failed",
    }, request, requestUrl)
    return response
  }
}

async function emitAddonApiAfterHook(
  payload: {
    scope: AddonApiScope
    addonId: string
    routePath: string
    routeSegments: string[]
    method: AddonHttpMethod
    pathname: string
    status: number
    matched: boolean
    errorMessage?: string
  },
  request: Request,
  requestUrl: URL,
) {
  await executeAddonActionHook("addon.api.request.after", payload, {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
  })
}
