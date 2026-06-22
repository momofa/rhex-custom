import "server-only"

import { buildAddonExecutionContext } from "@/addons-host/runtime/internal/execution-context"
import { runWithAddonExecutionScope } from "@/addons-host/runtime/execution-scope"
import {
  ADDON_RUNTIME_LOG_DEDUPE_WINDOW_MS,
  createAddonLifecycleLog,
  upsertAddonRegistryRecord,
} from "@/db/addon-registry-queries"
import type { LoadedAddonRuntime } from "@/addons-host/types"

/**
 * @file render-executor.ts
 * @responsibility 统一 execute.ts 四路(slot/surface/page/api) 渲染执行的公共壳
 *   (runWithAddonExecutionScope + buildAddonExecutionContext + 失败日志 + registry 回写)
 * @scope Phase D 抽出自 runtime/execute.ts；execute.ts 四路经此封装
 * @exports AddonRenderExecutionInput, runAddonRenderCall, logRenderFailure, persistAddonRenderFailure
 *
 * 非目标：
 *   - 不吞 Api/Page 路由查找逻辑（仍在 execute.ts 主流程），仅下沉 try-catch 样板。
 *   - 不处理 Response 序列化（normalizeAddonApiResult 留 execute.ts）。
 */

export interface AddonRenderExecutionInput {
  request?: Request
  pathname?: string
  searchParams?: URLSearchParams
}

/**
 * 组合 runWithAddonExecutionScope + buildAddonExecutionContext。
 * 业务 `call` 回调收到拼好的 AddonExecutionContext（通过解构注入到具体 scope）。
 *
 * 注意：buildAddonExecutionContext 第 2 参数在 page/api 两路原本没传；这里统一
 * 通过 input 可选传入，未传则保持不传（零行为变化）。
 */
export async function runAddonRenderCall<TResult>(options: {
  addon: LoadedAddonRuntime
  action: string
  request?: Request
  input?: AddonRenderExecutionInput
  call: (ctx: ReturnType<typeof buildAddonExecutionContext>) => Promise<TResult | undefined> | TResult | undefined
}): Promise<TResult | undefined> {
  const { addon, action, request, input, call } = options
  return runWithAddonExecutionScope(addon, {
    action,
    request: request ?? input?.request,
  }, async () => {
    const ctx = input
      ? buildAddonExecutionContext(addon, {
          request: input.request,
          pathname: input.pathname,
          searchParams: input.searchParams,
        })
      : buildAddonExecutionContext(addon)
    return call(ctx)
  })
}

type RenderFailureKind = "SLOT_RENDER" | "SURFACE_RENDER"

/**
 * 渲染失败统一 lifecycle 日志。上游捕获到 error 时调用；日志本身入库失败仅 console.error，
 * 不向外抛出（与原 logSlotFailure/logSurfaceFailure 等价）。
 */
export async function logRenderFailure(input: {
  addon: LoadedAddonRuntime
  kind: RenderFailureKind
  /** slot 名 或 surface 名；用于默认错误消息 */
  target: string
  key: string
  metadataJson: Record<string, unknown>
  error: unknown
}) {
  const fallbackLabel = input.kind === "SLOT_RENDER" ? "slot" : "surface"
  try {
    await createAddonLifecycleLog({
      addonId: input.addon.manifest.id,
      action: input.kind,
      status: "FAILED",
      message:
        input.error instanceof Error
          ? input.error.message
          : `addon ${fallbackLabel} "${input.target}" failed`,
      dedupeWindowMs: ADDON_RUNTIME_LOG_DEDUPE_WINDOW_MS,
      metadataJson: input.metadataJson,
    })
  } catch (logError) {
    console.error(
      `[addons-host:${fallbackLabel}:${input.target}] failed to persist lifecycle log`,
      input.addon.manifest.id,
      input.key,
      logError,
    )
  }
}

function parseOptionalIsoDate(value?: string | null) {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function buildAddonRegistryState(addon: LoadedAddonRuntime, lastErrorMessage: string) {
  if (addon.state.uninstalledAt) {
    return "UNINSTALLED" as const
  }
  if (lastErrorMessage) {
    return "ERROR" as const
  }
  return addon.enabled ? "ENABLED" as const : "DISABLED" as const
}

/**
 * 将 addon 最近一次渲染失败持久化到 addon_registry 表（幂等：相同 message 且已有 lastErrorAt 时跳过）。
 * 本函数自身的 DB 错误被 swallow —— 避免单个 addon 崩溃污染整个页面请求。
 */
export async function persistAddonRenderFailure(addon: LoadedAddonRuntime, error: unknown) {
  const message = error instanceof Error
    ? error.message
    : `addon "${addon.manifest.id}" render failed`

  if (addon.state.lastErrorMessage === message && addon.state.lastErrorAt) {
    return
  }

  const failedAt = new Date()

  try {
    await upsertAddonRegistryRecord({
      addonId: addon.manifest.id,
      name: addon.manifest.name,
      version: addon.manifest.version,
      description: addon.manifest.description ?? null,
      sourceDir: addon.rootDir,
      state: buildAddonRegistryState(addon, message),
      enabled: addon.enabled,
      manifestJson: addon.manifest,
      permissionsJson: addon.manifest.permissions ?? [],
      installedAt: parseOptionalIsoDate(addon.state.installedAt),
      disabledAt: parseOptionalIsoDate(addon.state.disabledAt),
      uninstalledAt: parseOptionalIsoDate(addon.state.uninstalledAt),
      lastErrorAt: failedAt,
      lastErrorMessage: message,
    })
  } catch {
    // Ignore persistence failures so addon crashes remain isolated from the page request.
  }
}
