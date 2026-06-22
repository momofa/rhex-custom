/**
 * @file build-api-factory.ts
 * @responsibility createAddonBuildApi 工厂 —— register(Slot|Surface|Page|Api|Hook|Provider|...) 家族
 * @scope Phase B.10 抽出自 runtime/loader.ts (原 lines 228-472)
 * @depends-on
 *   - @/addons-host/runtime/fs (normalizeMountedAddonPath)
 *   - @/addons-host/runtime/permissions (assertAddonPermission, resolveAddonSensitivePermissionForSlot, resolveAddonSensitivePermissionForProviderKind)
 *   - @/addons-host/hook-catalog (isKnownAddonActionHookName / isKnownAddonWaterfallHookName / isKnownAddonAsyncWaterfallHookName)
 *   - @/addons-host/surface-modes (getAddonSurfaceExecutionMode)
 *   - @/addons-host/types (Addon*Registration / AddonBuildApi / AddonManifest / AddonSlotProps)
 *   - 禁止 import ../loader (反向依赖)
 * @exports createAddonBuildApi
 */

import { normalizeMountedAddonPath } from "@/addons-host/runtime/fs"
import {
  assertAddonPermission,
  resolveAddonSensitivePermissionForProviderKind,
  resolveAddonSensitivePermissionForSlot,
} from "@/addons-host/runtime/permissions"
import {
  isKnownAddonActionHookName,
  isKnownAddonAsyncWaterfallHookName,
  isKnownAddonSurfaceName,
  isKnownAddonWaterfallHookName,
} from "@/addons-host/hook-catalog"
import { getAddonSurfaceExecutionMode } from "@/addons-host/surface-modes"
import type {
  AddonActionHookRegistration,
  AddonApiRegistration,
  AddonHttpMethod,
  AddonAsyncWaterfallHookRegistration,
  AddonBackgroundJobRegistration,
  AddonBuildApi,
  AddonDataMigrationRegistration,
  AddonManifest,
  AddonPageRegistration,
  AddonProviderRegistration,
  AddonSlotProps,
  AddonSlotRegistration,
  AddonSurfaceRegistration,
  AddonWaterfallHookRegistration,
} from "@/addons-host/types"

function normalizeRegistrationKey(manifest: AddonManifest, kind: string, key: string) {
  const normalizedKey = key.trim()
  if (!normalizedKey) {
    throw new Error(`addon "${manifest.id}" ${kind} registration requires a non-empty key`)
  }

  return normalizedKey
}

function warnAndSkipDuplicate(
  warnings: string[],
  seen: Set<string>,
  message: string,
) {
  if (!seen.has(message)) {
    seen.add(message)
    warnings.push(message)
  }
}

function claimRegistration(
  warnings: string[],
  seenRegistrations: Set<string>,
  seenWarnings: Set<string>,
  identity: string,
  message: string,
) {
  if (!seenRegistrations.has(identity)) {
    seenRegistrations.add(identity)
    return true
  }

  warnAndSkipDuplicate(warnings, seenWarnings, message)
  return false
}

function normalizeAddonHttpMethods(methods?: AddonHttpMethod[]) {
  const normalized = (methods ?? ["GET"])
    .map((item) => item.toUpperCase() as AddonHttpMethod)
  const seen = new Set<AddonHttpMethod>()

  return normalized.filter((method) => {
    if (seen.has(method)) {
      return false
    }

    seen.add(method)
    return true
  })
}

export function createAddonBuildApi(manifest: AddonManifest, warnings: string[]) {
  const slots: AddonSlotRegistration[] = []
  const surfaces: AddonSurfaceRegistration[] = []
  const publicPages: AddonPageRegistration[] = []
  const adminPages: AddonPageRegistration[] = []
  const publicApis: AddonApiRegistration[] = []
  const adminApis: AddonApiRegistration[] = []
  const backgroundJobs: AddonBackgroundJobRegistration[] = []
  const providers: AddonProviderRegistration[] = []
  const actionHooks: AddonActionHookRegistration[] = []
  const waterfallHooks: AddonWaterfallHookRegistration[] = []
  const asyncWaterfallHooks: AddonAsyncWaterfallHookRegistration[] = []
  const dataMigrations: AddonDataMigrationRegistration[] = []
  const seenWarnings = new Set<string>()
  const seenSlotRegistrations = new Set<string>()
  const seenSurfaceRegistrations = new Set<string>()
  const seenPublicPageRoutes = new Set<string>()
  const seenAdminPageRoutes = new Set<string>()
  const seenPublicApiRoutes = new Set<string>()
  const seenAdminApiRoutes = new Set<string>()
  const seenBackgroundJobRegistrations = new Set<string>()
  const seenProviderRegistrations = new Set<string>()
  const seenActionHookRegistrations = new Set<string>()
  const seenWaterfallHookRegistrations = new Set<string>()
  const seenAsyncWaterfallHookRegistrations = new Set<string>()
  const seenDataMigrationVersions = new Set<number>()

  const api: AddonBuildApi = {
    registerSlot<TProps extends AddonSlotProps = AddonSlotProps>(
      registration: AddonSlotRegistration<TProps>,
    ) {
      assertAddonPermission(
        manifest,
        "slot:register",
        `addon "${manifest.id}" is not allowed to register slots`,
      )
      const normalizedSlot = registration.slot.trim()
      const sensitivePermission = resolveAddonSensitivePermissionForSlot(
        normalizedSlot,
      )
      if (sensitivePermission) {
        assertAddonPermission(
          manifest,
          sensitivePermission,
          `addon "${manifest.id}" is not allowed to attach to slot "${normalizedSlot}"`,
        )
      }

      const normalizedKey = normalizeRegistrationKey(manifest, "slot", registration.key)
      if (!claimRegistration(
        warnings,
        seenSlotRegistrations,
        seenWarnings,
        `${normalizedSlot}:${normalizedKey}`,
        `duplicate slot registration "${normalizedSlot}:${normalizedKey}" in addon "${manifest.id}" ignored`,
      )) {
        return
      }

      slots.push({
        ...registration,
        key: normalizedKey,
        slot: normalizedSlot,
        order: registration.order ?? 0,
      } as AddonSlotRegistration)
    },
    registerSurface(registration) {
      assertAddonPermission(
        manifest,
        "surface:register",
        `addon "${manifest.id}" is not allowed to register surfaces`,
      )
      const normalizedSurface = registration.surface.trim()
      const normalizedClientModule = typeof registration.clientModule === "string"
        ? registration.clientModule.trim()
        : ""
      const hasRender = typeof registration.render === "function"
      const surfaceMode = getAddonSurfaceExecutionMode(normalizedSurface)

      if (!normalizedSurface) {
        throw new Error(`addon "${manifest.id}" surface registration requires a non-empty surface`)
      }

      if (!isKnownAddonSurfaceName(normalizedSurface)) {
        warnAndSkipDuplicate(
          warnings,
          seenWarnings,
          `unknown surface "${normalizedSurface}" in addon "${manifest.id}"; registration kept for compatibility but no built-in host surface currently declares this key`,
        )
      }

      if (surfaceMode === "client" && hasRender && !normalizedClientModule) {
        throw new Error(
          `addon "${manifest.id}" surface "${normalizedSurface}" is client-only and requires clientModule`,
        )
      }

      if (!hasRender && !normalizedClientModule) {
        throw new Error(`addon "${manifest.id}" surface "${normalizedSurface}" requires render() or clientModule`)
      }

      if (surfaceMode === "client" && hasRender && normalizedClientModule) {
        warnings.push(
          `surface "${normalizedSurface}" is client-only; addon "${manifest.id}" render() will be ignored and clientModule will be used instead`,
        )
      }

      const normalizedKey = normalizeRegistrationKey(manifest, "surface", registration.key)
      if (!claimRegistration(
        warnings,
        seenSurfaceRegistrations,
        seenWarnings,
        `${normalizedSurface}:${normalizedKey}`,
        `duplicate surface registration "${normalizedSurface}:${normalizedKey}" in addon "${manifest.id}" ignored`,
      )) {
        return
      }

      surfaces.push({
        ...registration,
        key: normalizedKey,
        surface: normalizedSurface,
        render: surfaceMode === "client" ? undefined : registration.render,
        clientModule: normalizedClientModule || undefined,
        priority: registration.priority ?? 0,
      } as AddonSurfaceRegistration)
    },
    registerPublicPage(registration) {
      assertAddonPermission(
        manifest,
        "page:public",
        `addon "${manifest.id}" is not allowed to register public pages`,
      )
      const normalizedPath = normalizeMountedAddonPath(registration.path)
      const normalizedKey = normalizeRegistrationKey(manifest, "public page", registration.key)
      if (!claimRegistration(
        warnings,
        seenPublicPageRoutes,
        seenWarnings,
        normalizedPath,
        `duplicate public page route "${normalizedPath}" in addon "${manifest.id}" ignored`,
      )) {
        return
      }

      publicPages.push({
        ...registration,
        key: normalizedKey,
        path: normalizedPath,
      })
    },
    registerAdminPage(registration) {
      assertAddonPermission(
        manifest,
        "page:admin",
        `addon "${manifest.id}" is not allowed to register admin pages`,
      )
      const normalizedPath = normalizeMountedAddonPath(registration.path)
      const normalizedKey = normalizeRegistrationKey(manifest, "admin page", registration.key)
      if (!claimRegistration(
        warnings,
        seenAdminPageRoutes,
        seenWarnings,
        normalizedPath,
        `duplicate admin page route "${normalizedPath}" in addon "${manifest.id}" ignored`,
      )) {
        return
      }

      adminPages.push({
        ...registration,
        key: normalizedKey,
        path: normalizedPath,
      })
    },
    registerPublicApi(registration) {
      assertAddonPermission(
        manifest,
        "api:public",
        `addon "${manifest.id}" is not allowed to register public APIs`,
      )
      const normalizedPath = normalizeMountedAddonPath(registration.path)
      const normalizedKey = normalizeRegistrationKey(manifest, "public API", registration.key)
      const methods = normalizeAddonHttpMethods(registration.methods)
        .filter((method) => claimRegistration(
          warnings,
          seenPublicApiRoutes,
          seenWarnings,
          `${normalizedPath}:${method}`,
          `duplicate public API route "${method} ${normalizedPath}" in addon "${manifest.id}" ignored`,
        ))

      if (methods.length === 0) {
        return
      }

      publicApis.push({
        ...registration,
        key: normalizedKey,
        path: normalizedPath,
        methods,
      })
    },
    registerAdminApi(registration) {
      assertAddonPermission(
        manifest,
        "api:admin",
        `addon "${manifest.id}" is not allowed to register admin APIs`,
      )
      const normalizedPath = normalizeMountedAddonPath(registration.path)
      const normalizedKey = normalizeRegistrationKey(manifest, "admin API", registration.key)
      const methods = normalizeAddonHttpMethods(registration.methods)
        .filter((method) => claimRegistration(
          warnings,
          seenAdminApiRoutes,
          seenWarnings,
          `${normalizedPath}:${method}`,
          `duplicate admin API route "${method} ${normalizedPath}" in addon "${manifest.id}" ignored`,
        ))

      if (methods.length === 0) {
        return
      }

      adminApis.push({
        ...registration,
        key: normalizedKey,
        path: normalizedPath,
        methods,
      })
    },
    registerBackgroundJob(registration) {
      assertAddonPermission(
        manifest,
        "background-job:register",
        `addon "${manifest.id}" is not allowed to register background jobs`,
      )

      const normalizedKey = normalizeRegistrationKey(manifest, "background job", registration.key)
      if (!claimRegistration(
        warnings,
        seenBackgroundJobRegistrations,
        seenWarnings,
        normalizedKey,
        `duplicate background job registration "${normalizedKey}" in addon "${manifest.id}" ignored`,
      )) {
        return
      }

      backgroundJobs.push({
        ...registration,
        key: normalizedKey,
      } as AddonBackgroundJobRegistration)
    },
    registerProvider(registration) {
      assertAddonPermission(
        manifest,
        "provider:register",
        `addon "${manifest.id}" is not allowed to register providers`,
      )
      const normalizedKind = registration.kind.trim()
      const normalizedCode = registration.code.trim()
      const sensitivePermission = resolveAddonSensitivePermissionForProviderKind(
        normalizedKind,
      )
      if (sensitivePermission) {
        assertAddonPermission(
          manifest,
          sensitivePermission,
          `addon "${manifest.id}" is not allowed to register provider kind "${normalizedKind}"`,
        )
      }

      if (!claimRegistration(
        warnings,
        seenProviderRegistrations,
        seenWarnings,
        `${normalizedKind}:${normalizedCode}`,
        `duplicate provider registration "${normalizedKind}:${normalizedCode}" in addon "${manifest.id}" ignored`,
      )) {
        return
      }

      providers.push({
        ...registration,
        kind: normalizedKind,
        code: normalizedCode,
        label: registration.label.trim(),
        order: registration.order ?? 0,
      })
    },
    registerActionHook(registration) {
      assertAddonPermission(
        manifest,
        "hook:register",
        `addon "${manifest.id}" is not allowed to register action hooks`,
      )
      if (!isKnownAddonActionHookName(registration.hook)) {
        throw new Error(`unknown addon action hook "${registration.hook}"`)
      }

      const normalizedKey = normalizeRegistrationKey(manifest, "action hook", registration.key)
      if (!claimRegistration(
        warnings,
        seenActionHookRegistrations,
        seenWarnings,
        `${registration.hook}:${normalizedKey}`,
        `duplicate action hook registration "${registration.hook}:${normalizedKey}" in addon "${manifest.id}" ignored`,
      )) {
        return
      }

      actionHooks.push({
        ...registration,
        key: normalizedKey,
        order: registration.order ?? 0,
      })
    },
    registerWaterfallHook(registration) {
      assertAddonPermission(
        manifest,
        "hook:register",
        `addon "${manifest.id}" is not allowed to register waterfall hooks`,
      )
      if (!isKnownAddonWaterfallHookName(registration.hook)) {
        throw new Error(`unknown addon waterfall hook "${registration.hook}"`)
      }

      const normalizedKey = normalizeRegistrationKey(manifest, "waterfall hook", registration.key)
      if (!claimRegistration(
        warnings,
        seenWaterfallHookRegistrations,
        seenWarnings,
        `${registration.hook}:${normalizedKey}`,
        `duplicate waterfall hook registration "${registration.hook}:${normalizedKey}" in addon "${manifest.id}" ignored`,
      )) {
        return
      }

      waterfallHooks.push({
        ...registration,
        key: normalizedKey,
        order: registration.order ?? 0,
      })
    },
    registerAsyncWaterfallHook(registration) {
      assertAddonPermission(
        manifest,
        "hook:register",
        `addon "${manifest.id}" is not allowed to register async waterfall hooks`,
      )
      if (!isKnownAddonAsyncWaterfallHookName(registration.hook)) {
        throw new Error(`unknown addon async waterfall hook "${registration.hook}"`)
      }

      const normalizedKey = normalizeRegistrationKey(manifest, "async waterfall hook", registration.key)
      if (!claimRegistration(
        warnings,
        seenAsyncWaterfallHookRegistrations,
        seenWarnings,
        `${registration.hook}:${normalizedKey}`,
        `duplicate async waterfall hook registration "${registration.hook}:${normalizedKey}" in addon "${manifest.id}" ignored`,
      )) {
        return
      }

      asyncWaterfallHooks.push({
        ...registration,
        key: normalizedKey,
        order: registration.order ?? 0,
      })
    },
    registerDataMigration(registration) {
      assertAddonPermission(
        manifest,
        "data:migrate",
        `addon "${manifest.id}" is not allowed to register data migrations`,
      )

      const version = Math.max(1, Math.floor(registration.version))
      if (seenDataMigrationVersions.has(version)) {
        warnAndSkipDuplicate(
          warnings,
          seenWarnings,
          `duplicate data migration version "${version}" in addon "${manifest.id}" ignored`,
        )
        return
      }

      seenDataMigrationVersions.add(version)
      dataMigrations.push({
        ...registration,
        version,
      })
    },
  }

  return {
    api,
    snapshot: {
      slots,
      surfaces,
      publicPages,
      adminPages,
      publicApis,
      adminApis,
      backgroundJobs,
      providers,
      actionHooks,
      waterfallHooks,
      asyncWaterfallHooks,
      dataMigrations,
    },
  }
}
