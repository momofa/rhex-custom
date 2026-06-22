/**
 * @file data-migrations.ts
 * @responsibility addon 数据迁移钩子调度：按 version 升序应用未执行的 migration 并更新 schema version
 * @scope Phase B.8 抽自 runtime/loader.ts: applyAddonDataMigrations
 * @depends-on @/addons-host/runtime/data, @/addons-host/runtime/execution-scope, @/addons-host/runtime/internal/execution-context, @/addons-host/types  (禁止 import ../loader)
 * @exports applyAddonDataMigrations
 */

import {
  getAddonDataSchemaVersion,
  setAddonDataSchemaVersion,
} from "@/addons-host/runtime/data"
import { runWithAddonExecutionScope } from "@/addons-host/runtime/execution-scope"
import { buildAddonExecutionContext } from "@/addons-host/runtime/internal/execution-context"
import type { LoadedAddonRuntime } from "@/addons-host/types"

export async function applyAddonDataMigrations(addon: LoadedAddonRuntime) {
  if (addon.dataMigrations.length === 0) {
    return
  }

  const sortedMigrations = [...addon.dataMigrations].sort(
    (left, right) => left.version - right.version,
  )
  let currentVersion = await getAddonDataSchemaVersion(addon.manifest.id)

  for (const migration of sortedMigrations) {
    if (migration.version <= currentVersion) {
      continue
    }

    await runWithAddonExecutionScope(addon, {
      action: `data:migration:${migration.version}`,
    }, async () => {
      await migration.migrate(buildAddonExecutionContext(addon))
    })
    await setAddonDataSchemaVersion(addon.manifest.id, migration.version)
    currentVersion = migration.version
  }
}