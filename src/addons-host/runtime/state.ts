import {
  deleteAddonRegistryRecord,
  listAddonRegistryRecords,
  patchAddonRegistryStateRecord,
} from "@/db/addon-registry-queries"
import { promises as fs } from "node:fs"
import path from "node:path"
import {
  ensureDirectory,
  fileExists,
  getAddonsStateDirectory,
  readJsonFile,
} from "@/addons-host/runtime/fs"
import type { AddonStateRecord } from "@/addons-host/types"

export type AddonStateMap = Record<string, AddonStateRecord>

const ADDON_STATE_FILE_NAME = "addon-registry-state.json"

type AddonRegistryStateRecord = {
  addonId: string
  enabled: boolean
  installedAt: Date | null
  disabledAt: Date | null
  uninstalledAt: Date | null
  lastErrorAt: Date | null
  lastErrorMessage: string | null
}

let addonStateMutationQueue: Promise<void> = Promise.resolve()

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function getAddonStateFilePath() {
  return path.join(getAddonsStateDirectory(), ADDON_STATE_FILE_NAME)
}

function mapAddonRegistryRecordToStateRecord(record: AddonRegistryStateRecord): AddonStateRecord {
  return {
    enabled: record.enabled,
    installedAt: record.installedAt?.toISOString() ?? null,
    disabledAt: record.disabledAt?.toISOString() ?? null,
    uninstalledAt: record.uninstalledAt?.toISOString() ?? null,
    lastErrorAt: record.lastErrorAt?.toISOString() ?? null,
    lastErrorMessage: record.lastErrorMessage ?? null,
  }
}

function normalizeStoredOptionalString(value: unknown) {
  return typeof value === "string" ? value : value === null ? null : undefined
}

function normalizeStoredAddonStateRecord(value: unknown): AddonStateRecord | null {
  if (!isRecord(value)) {
    return null
  }

  return {
    ...(typeof value.enabled === "boolean" ? { enabled: value.enabled } : {}),
    ...("installedAt" in value ? { installedAt: normalizeStoredOptionalString(value.installedAt) } : {}),
    ...("disabledAt" in value ? { disabledAt: normalizeStoredOptionalString(value.disabledAt) } : {}),
    ...("uninstalledAt" in value ? { uninstalledAt: normalizeStoredOptionalString(value.uninstalledAt) } : {}),
    ...("lastErrorAt" in value ? { lastErrorAt: normalizeStoredOptionalString(value.lastErrorAt) } : {}),
    ...("lastErrorMessage" in value ? { lastErrorMessage: normalizeStoredOptionalString(value.lastErrorMessage) } : {}),
  }
}

function normalizeAddonStateSnapshot(value: AddonStateRecord): AddonStateRecord {
  return {
    ...(typeof value.enabled === "boolean" ? { enabled: value.enabled } : {}),
    installedAt: value.installedAt ?? null,
    disabledAt: value.disabledAt ?? null,
    uninstalledAt: value.uninstalledAt ?? null,
    lastErrorAt: value.lastErrorAt ?? null,
    lastErrorMessage: value.lastErrorMessage ?? null,
  }
}

function readAddonStateMapFromDatabaseRecords(records: AddonRegistryStateRecord[]) {
  return Object.fromEntries(
    records.map((record) => [
      record.addonId,
      mapAddonRegistryRecordToStateRecord(record),
    ]),
  ) satisfies AddonStateMap
}

function readAddonStateMapFromUnknown(value: unknown) {
  const rawRecords = isRecord(value) && isRecord(value.records)
    ? value.records
    : isRecord(value)
      ? value
      : {}
  const records: AddonStateMap = {}

  for (const [addonId, rawState] of Object.entries(rawRecords)) {
    const normalized = normalizeStoredAddonStateRecord(rawState)
    if (normalized) {
      records[addonId] = normalized
    }
  }

  return records
}

async function readAddonStateMapFromFile(): Promise<AddonStateMap> {
  const filePath = getAddonStateFilePath()
  if (!(await fileExists(filePath))) {
    return {}
  }

  try {
    return readAddonStateMapFromUnknown(await readJsonFile<unknown>(filePath))
  } catch {
    return {}
  }
}

async function writeAddonStateMapToFile(records: AddonStateMap) {
  await ensureDirectory(getAddonsStateDirectory())
  await fs.writeFile(
    getAddonStateFilePath(),
    JSON.stringify({
      schemaVersion: 1,
      records,
    }, null, 2),
    "utf8",
  )
}

function runAddonStateMutation<T>(task: () => Promise<T>) {
  const run = addonStateMutationQueue.then(task, task)
  addonStateMutationQueue = run.then(() => undefined, () => undefined)
  return run
}

async function patchAddonStateFileRecord(addonId: string, patch: Partial<AddonStateRecord>) {
  return runAddonStateMutation(async () => {
    const records = await readAddonStateMapFromFile()
    const current = records[addonId] ?? {}
    const next = normalizeAddonStateSnapshot({
      ...current,
      ...("enabled" in patch ? { enabled: typeof patch.enabled === "boolean" ? patch.enabled : current.enabled } : {}),
      ...("installedAt" in patch ? { installedAt: typeof patch.installedAt === "string" || patch.installedAt === null ? patch.installedAt : current.installedAt } : {}),
      ...("disabledAt" in patch ? { disabledAt: typeof patch.disabledAt === "string" || patch.disabledAt === null ? patch.disabledAt : current.disabledAt } : {}),
      ...("uninstalledAt" in patch ? { uninstalledAt: typeof patch.uninstalledAt === "string" || patch.uninstalledAt === null ? patch.uninstalledAt : current.uninstalledAt } : {}),
      ...("lastErrorAt" in patch ? { lastErrorAt: typeof patch.lastErrorAt === "string" || patch.lastErrorAt === null ? patch.lastErrorAt : current.lastErrorAt } : {}),
      ...("lastErrorMessage" in patch ? { lastErrorMessage: typeof patch.lastErrorMessage === "string" || patch.lastErrorMessage === null ? patch.lastErrorMessage : current.lastErrorMessage } : {}),
    })

    await writeAddonStateMapToFile({
      ...records,
      [addonId]: next,
    })

    return next
  })
}

export async function writeAddonStateSnapshot(addonId: string, state: AddonStateRecord) {
  return runAddonStateMutation(async () => {
    const records = await readAddonStateMapFromFile()
    const next = normalizeAddonStateSnapshot(state)

    await writeAddonStateMapToFile({
      ...records,
      [addonId]: next,
    })

    return next
  })
}

export async function readAddonStateMap(): Promise<AddonStateMap> {
  const [databaseRecords, fileRecords] = await Promise.all([
    listAddonRegistryRecords(),
    readAddonStateMapFromFile(),
  ])

  if (!databaseRecords) {
    return fileRecords
  }

  return {
    ...fileRecords,
    ...readAddonStateMapFromDatabaseRecords(databaseRecords),
  }
}

export async function updateAddonState(addonId: string, patch: Partial<AddonStateRecord>) {
  const updatedRecord = await patchAddonRegistryStateRecord({
    addonId,
    ...("enabled" in patch ? { enabled: typeof patch.enabled === "boolean" ? patch.enabled : undefined } : {}),
    ...("installedAt" in patch ? { installedAt: parseOptionalIsoDate(patch.installedAt) } : {}),
    ...("disabledAt" in patch ? { disabledAt: parseOptionalIsoDate(patch.disabledAt) } : {}),
    ...("uninstalledAt" in patch ? { uninstalledAt: parseOptionalIsoDate(patch.uninstalledAt) } : {}),
    ...("lastErrorAt" in patch ? { lastErrorAt: parseOptionalIsoDate(patch.lastErrorAt) } : {}),
    ...("lastErrorMessage" in patch
      ? { lastErrorMessage: typeof patch.lastErrorMessage === "string" ? patch.lastErrorMessage : null }
      : {}),
  })

  if (updatedRecord) {
    const nextState = mapAddonRegistryRecordToStateRecord(updatedRecord)
    await writeAddonStateSnapshot(addonId, nextState)
    return nextState
  }

  return patchAddonStateFileRecord(addonId, patch)
}

export async function deleteAddonState(addonId: string) {
  const deletedRecord = await deleteAddonRegistryRecord(addonId)
  const deletedFileRecord = await runAddonStateMutation(async () => {
    const records = await readAddonStateMapFromFile()
    if (!(addonId in records)) {
      return false
    }

    const nextRecords = {
      ...records,
    }
    delete nextRecords[addonId]
    await writeAddonStateMapToFile(nextRecords)
    return true
  })

  return Boolean(deletedRecord) || deletedFileRecord
}

function parseOptionalIsoDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
