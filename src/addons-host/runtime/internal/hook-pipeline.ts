import "server-only"

import {
  ADDON_RUNTIME_LOG_DEDUPE_WINDOW_MS,
  createAddonLifecycleLog,
} from "@/db/addon-registry-queries"
import type { LoadedAddonRuntime } from "@/addons-host/types"

/**
 * @file hook-pipeline.ts
 * @responsibility 统一 action/waterfall/asyncWaterfall 三类 Hook 的执行骨架
 *   (错误捕获 + lifecycle 日志 + 候选累积回调)
 * @scope Phase C 抽出自 runtime/hooks.ts；hooks.ts 中三类 API 经此 runner 编排
 * @exports runHookPipeline
 *
 * 抽象动机：原 hooks.ts 中三段 for-try-catch-logHookFailure-console.error-continue
 * 逻辑重复，唯一差异是 (a) kind 名 (b) 错误日志里的动词(handler/transform) (c) 每次循环成功后
 * 调用方对候选结果的收集/串值方式。抽象出 runHookPipeline<TCandidate> 承担 (a)(b) 与
 * 错误处理/日志闭环，通过 run/onSuccess 回调把 (c) 留给调用方，使调用方回到"线性脚本"形态。
 *
 * 取舍：增加 1 层回调间接，纳秒级开销；换来三份相似代码合并为一份，可读性与可测试性显著提升。
 */

export type AddonHookKind = "action" | "waterfall" | "asyncWaterfall"

const DEFAULT_HOOK_TIMEOUT_MS = 2_000
const MIN_HOOK_TIMEOUT_MS = 100
const MAX_HOOK_TIMEOUT_MS = 30_000

class AddonHookTimeoutError extends Error {
  constructor(input: {
    kind: AddonHookKind
    hook: string
    key: string
    timeoutMs: number
  }) {
    super(`addon hook "${input.hook}" (${input.kind}:${input.key}) timed out after ${input.timeoutMs}ms`)
    this.name = "AddonHookTimeoutError"
  }
}

function getAddonHookTimeoutMs() {
  const rawValue = Number.parseInt(process.env.ADDON_HOOK_TIMEOUT_MS?.trim() ?? "", 10)
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return DEFAULT_HOOK_TIMEOUT_MS
  }

  return Math.min(MAX_HOOK_TIMEOUT_MS, Math.max(MIN_HOOK_TIMEOUT_MS, rawValue))
}

async function runWithHookTimeout<T>(
  task: Promise<T>,
  input: {
    kind: AddonHookKind
    hook: string
    key: string
  },
) {
  const timeoutMs = getAddonHookTimeoutMs()
  let timer: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new AddonHookTimeoutError({
            ...input,
            timeoutMs,
          }))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

/** 记录单次 hook 执行失败到 addon lifecycle 日志（DB）。 */
export async function logHookFailure(input: {
  addon: LoadedAddonRuntime
  kind: AddonHookKind
  hook: string
  key: string
  error: unknown
}) {
  await createAddonLifecycleLog({
    addonId: input.addon.manifest.id,
    action: `HOOK_${input.kind.toUpperCase()}`,
    status: "FAILED",
    message:
      input.error instanceof Error
        ? input.error.message
        : `addon hook "${input.hook}" failed`,
    dedupeWindowMs: ADDON_RUNTIME_LOG_DEDUPE_WINDOW_MS,
    metadataJson: {
      kind: input.kind,
      hook: input.hook,
      key: input.key,
    },
  })
}

export interface HookPipelineOptions<TCandidate> {
  candidates: readonly TCandidate[]
  kind: AddonHookKind
  hook: string
  throwOnError?: boolean
  getAddon: (candidate: TCandidate) => LoadedAddonRuntime
  getKey: (candidate: TCandidate) => string
  /** 执行单个候选项（可能抛错）。失败时由 pipeline 记录日志与控制台，并按 throwOnError 决定透传。 */
  run: (candidate: TCandidate) => Promise<void>
  /** 成功回调：用于调用方自有的结果收集 / waterfall 串值（currentValue）。 */
  onSuccess: (candidate: TCandidate) => void
}

/**
 * 按序遍历候选项并执行，错误时：logHookFailure + console.error + (throwOnError?throw:continue)。
 * 成功时调用 onSuccess，调用方自行决定收集/串值语义。
 */
export async function runHookPipeline<TCandidate>(
  options: HookPipelineOptions<TCandidate>,
): Promise<void> {
  const verb = options.kind === "action" ? "handler" : "transform"

  for (const candidate of options.candidates) {
    try {
      await runWithHookTimeout(options.run(candidate), {
        kind: options.kind,
        hook: options.hook,
        key: options.getKey(candidate),
      })
    } catch (error) {
      await logHookFailure({
        addon: options.getAddon(candidate),
        kind: options.kind,
        hook: options.hook,
        key: options.getKey(candidate),
        error,
      })

      if (options.throwOnError) {
        throw error
      }

      console.error(
        `[addons-host:hook:${options.kind}:${options.hook}] ${verb} failed`,
        options.getAddon(candidate).manifest.id,
        options.getKey(candidate),
        error,
      )
      continue
    }

    options.onSuccess(candidate)
  }
}
