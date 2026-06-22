import { promises as fs } from "node:fs"
import path from "node:path"

import type { PrismaClient } from "@prisma/client"

import {
  ADDON_ADMIN_API_PREFIX,
  ADDON_ADMIN_PAGE_PREFIX,
  ADDON_ASSET_PUBLIC_PREFIX,
  ADDON_PUBLIC_API_PREFIX,
  ADDON_PUBLIC_PAGE_PREFIX,
} from "@/addons-host/runtime/constants"
import {
  DEFAULT_SERVER_ENTRY_RELATIVE_PATH,
  importAddonDefinition,
} from "@/addons-host/runtime/internal/manifest-loader"
import { runWithAddonExecutionScope } from "@/addons-host/runtime/execution-scope"
import { buildAddonDatabaseApi } from "@/addons-host/runtime/database"
import {
  fileExists,
  readJsonFile,
  resolveSafeAddonChildPath,
} from "@/addons-host/runtime/fs"
import { buildAddonExecutionContext } from "@/addons-host/runtime/loader"
import { normalizeAddonManifest } from "@/addons-host/runtime/manifest"
import { resolveAddonPermissionSet } from "@/addons-host/runtime/permissions"
import { createAddonLifecycleLog } from "@/db/addon-registry-queries"
import { prisma } from "@/db/client"
import type {
  AddonDefinition,
  AddonInstallLifecycleContext,
  AddonLifecycleDatabaseApi,
  AddonManifest,
  AddonStateRecord,
  AddonUninstallLifecycleContext,
  AddonUpgradeLifecycleContext,
  LoadedAddonRuntime,
} from "@/addons-host/types"

type AddonLifecycleTarget = {
  definition: AddonDefinition
  entryServerPath: string
  manifest: AddonManifest
  runtime: LoadedAddonRuntime
}

type LifecycleRunInput =
  | {
      action: "install"
      logAddonId?: string | null
      logMetadata?: Record<string, unknown>
    }
  | {
      action: "upgrade"
      previousManifest: AddonManifest
      previousVersion: string
      previousRootDir: string
      logAddonId?: string | null
      logMetadata?: Record<string, unknown>
    }
  | {
      action: "uninstall"
      currentVersion: string
      logAddonId?: string | null
      logMetadata?: Record<string, unknown>
    }

function buildLifecycleRuntime(manifest: AddonManifest, rootDir: string, state?: AddonStateRecord): LoadedAddonRuntime {
  const permissionSet = resolveAddonPermissionSet(manifest.permissions)
  const resolvedPermissions = Object.freeze(
    [...permissionSet.values()].sort((left, right) => left.localeCompare(right, "zh-CN")),
  )
  const normalizedState = state ?? {}

  return {
    manifest,
    state: normalizedState,
    enabled: !normalizedState.uninstalledAt && (normalizedState.enabled ?? manifest.enabled ?? true),
    rootDir,
    assetRootDir: path.join(rootDir, "assets"),
    assetBaseUrl: `${ADDON_ASSET_PUBLIC_PREFIX}/${manifest.id}`,
    publicBaseUrl: `${ADDON_PUBLIC_PAGE_PREFIX}/${manifest.id}`,
    adminBaseUrl: `${ADDON_ADMIN_PAGE_PREFIX}/${manifest.id}`,
    publicApiBaseUrl: `${ADDON_PUBLIC_API_PREFIX}/${manifest.id}`,
    adminApiBaseUrl: `${ADDON_ADMIN_API_PREFIX}/${manifest.id}`,
    entryServerPath: null,
    warnings: [],
    permissionSet,
    resolvedPermissions,
    slots: [],
    surfaces: [],
    publicPages: [],
    adminPages: [],
    publicApis: [],
    adminApis: [],
    backgroundJobs: [],
    providers: [],
    actionHooks: [],
    waterfallHooks: [],
    asyncWaterfallHooks: [],
    dataMigrations: [],
    loadError: null,
  }
}

export async function importAddonLifecycleTargetFromDirectory(
  rootDir: string,
  state?: AddonStateRecord,
): Promise<AddonLifecycleTarget> {
  const manifestPath = await resolveSafeAddonChildPath(rootDir, "addon.json")
  const manifest = normalizeAddonManifest(await readJsonFile<unknown>(manifestPath))
  const entryServerPath = await resolveSafeAddonChildPath(
    rootDir,
    manifest.entry?.server?.trim() || DEFAULT_SERVER_ENTRY_RELATIVE_PATH,
  )

  if (!(await fileExists(entryServerPath))) {
    throw new Error("插件服务端入口不存在")
  }

  const definition = await importAddonDefinition(rootDir, entryServerPath)
  const runtime = buildLifecycleRuntime(manifest, rootDir, state)
  runtime.entryServerPath = entryServerPath

  return {
    definition,
    entryServerPath,
    manifest,
    runtime,
  }
}

function buildLifecycleLogPayload(
  runtime: LoadedAddonRuntime,
  input: LifecycleRunInput,
  status: "SUCCEEDED" | "FAILED",
  error?: unknown,
) {
  const metadata = {
    action: input.action,
    version: runtime.manifest.version,
    ...(input.action === "upgrade"
      ? {
          previousVersion: input.previousVersion,
          nextVersion: runtime.manifest.version,
        }
      : {}),
    ...(input.logMetadata ?? {}),
    ...(error instanceof Error
      ? {
          errorName: error.name,
          errorMessage: error.message,
        }
      : {}),
  }

  return {
    action: `LIFECYCLE_${input.action.toUpperCase()}`,
    status,
    message: status === "SUCCEEDED"
      ? `插件 ${runtime.manifest.name} 生命周期 ${input.action} 已完成`
      : `插件 ${runtime.manifest.name} 生命周期 ${input.action} 执行失败`,
    metadataJson: metadata,
  }
}

function buildLifecycleContext(
  target: AddonLifecycleTarget,
  input: LifecycleRunInput,
) {
  const baseContext = buildAddonExecutionContext(target.runtime)
  const database = buildAddonDatabaseApi(
    target.runtime,
    baseContext.assertPermission,
    prisma as unknown as PrismaClient,
  ) as AddonLifecycleDatabaseApi
  const shared = {
    ...baseContext,
    readFileText: async (targetPath: string) => {
      const filePath = await resolveSafeAddonChildPath(target.runtime.rootDir, targetPath)
      return fs.readFile(filePath, "utf8")
    },
    readFileJson: async <T = unknown>(targetPath: string) => {
      const filePath = await resolveSafeAddonChildPath(target.runtime.rootDir, targetPath)
      return readJsonFile<T>(filePath)
    },
    database,
  }

  if (input.action === "install") {
    return {
      ...shared,
      action: "install" as const,
    } satisfies AddonInstallLifecycleContext
  }

  if (input.action === "upgrade") {
    return {
      ...shared,
      action: "upgrade" as const,
      previousManifest: input.previousManifest,
      previousVersion: input.previousVersion,
      nextVersion: target.runtime.manifest.version,
      previousRootDir: input.previousRootDir,
    } satisfies AddonUpgradeLifecycleContext
  }

  return {
    ...shared,
    action: "uninstall" as const,
    currentVersion: input.currentVersion,
  } satisfies AddonUninstallLifecycleContext
}

export async function runAddonLifecycle(
  target: AddonLifecycleTarget,
  input: LifecycleRunInput,
) {
  const hook = target.definition.lifecycle?.[input.action]

  if (typeof hook !== "function") {
    return {
      executed: false,
    }
  }

  const context = buildLifecycleContext(target, input)

  try {
    await runWithAddonExecutionScope(target.runtime, {
      action: `lifecycle:${input.action}`,
    }, async () => {
      await hook(context as never)
    })

    if (input.logAddonId) {
      const payload = buildLifecycleLogPayload(target.runtime, input, "SUCCEEDED")
      await createAddonLifecycleLog({
        addonId: input.logAddonId,
        action: payload.action,
        status: payload.status,
        message: payload.message,
        metadataJson: payload.metadataJson,
      })
    }

    return {
      executed: true,
    }
  } catch (error) {
    if (input.logAddonId) {
      const payload = buildLifecycleLogPayload(target.runtime, input, "FAILED", error)
      await createAddonLifecycleLog({
        addonId: input.logAddonId,
        action: payload.action,
        status: payload.status,
        message: payload.message,
        metadataJson: payload.metadataJson,
      })
    }

    throw error
  }
}
