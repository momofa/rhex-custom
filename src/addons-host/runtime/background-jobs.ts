import "server-only"

import type {
  AddonBackgroundJobDeleteResult,
  AddonBackgroundJobEnqueueOptions,
  AddonBackgroundJobHandle,
  AddonBackgroundJobRegistration,
  LoadedAddonRuntime,
} from "@/addons-host/types"
import { runWithAddonExecutionScope } from "@/addons-host/runtime/execution-scope"
import {
  BackgroundJobPermanentError,
  deleteBackgroundJobById,
  enqueueBackgroundJob,
  listBackgroundJobs,
  registerBackgroundJobHandler,
  type BackgroundJobEnvelope,
} from "@/lib/background-jobs"

export const ADDON_BACKGROUND_JOB_NAME = "addon.background-job.run" as const

interface AddonBackgroundJobPayload {
  addonId: string
  jobKey: string
  payload: unknown
}

function isAddonBackgroundJobPayload(value: unknown): value is AddonBackgroundJobPayload {
  return Boolean(value)
    && typeof value === "object"
    && typeof (value as { addonId?: unknown }).addonId === "string"
    && typeof (value as { jobKey?: unknown }).jobKey === "string"
    && "payload" in (value as Record<string, unknown>)
}

function findAddonBackgroundJobRegistration(
  addon: LoadedAddonRuntime,
  jobKey: string,
) {
  const normalizedJobKey = jobKey.trim()
  return addon.backgroundJobs.find((item) => item.key === normalizedJobKey) ?? null
}

function addonOwnsBackgroundJob(
  job: BackgroundJobEnvelope,
  addonId: string,
): job is BackgroundJobEnvelope<typeof ADDON_BACKGROUND_JOB_NAME> {
  return job.name === ADDON_BACKGROUND_JOB_NAME
    && isAddonBackgroundJobPayload(job.payload)
    && job.payload.addonId === addonId
}

function createAddonBackgroundJobMatcher(addonId: string) {
  return (job: BackgroundJobEnvelope) => addonOwnsBackgroundJob(job, addonId)
}

export function addonMayUseBackgroundJobs(addon: Pick<LoadedAddonRuntime, "backgroundJobs" | "manifest">) {
  return addon.backgroundJobs.length > 0
    || (addon.manifest.provides?.backgroundJobs?.length ?? 0) > 0
}

function createAddonBackgroundJobHandle<TPayload = unknown>(
  job: BackgroundJobEnvelope<typeof ADDON_BACKGROUND_JOB_NAME>,
): AddonBackgroundJobHandle<TPayload> {
  const payload = job.payload
  if (!isAddonBackgroundJobPayload(payload)) {
    throw new BackgroundJobPermanentError("Invalid addon background job payload")
  }

  return {
    id: job.id,
    key: payload.jobKey,
    payload: payload.payload as TPayload,
    enqueuedAt: job.enqueuedAt,
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
    availableAt: job.availableAt ?? null,
  }
}

export async function enqueueAddonBackgroundJob<TPayload = unknown>(
  addon: LoadedAddonRuntime,
  jobKey: string,
  payload: TPayload,
  options?: AddonBackgroundJobEnqueueOptions,
) {
  const registration = findAddonBackgroundJobRegistration(addon, jobKey)
  if (!registration) {
    throw new Error(
      `addon "${addon.manifest.id}" background job "${jobKey}" is not registered`,
    )
  }

  const result = await enqueueBackgroundJob(
    ADDON_BACKGROUND_JOB_NAME,
    {
      addonId: addon.manifest.id,
      jobKey: registration.key,
      payload,
    },
    options,
  )

  return createAddonBackgroundJobHandle<TPayload>(result.job)
}

export async function removeAddonBackgroundJob(
  addon: LoadedAddonRuntime,
  jobId: string,
): Promise<AddonBackgroundJobDeleteResult> {
  const match = createAddonBackgroundJobMatcher(addon.manifest.id)
  const result = await deleteBackgroundJobById(jobId, {
    match,
  })

  return {
    id: result.id,
    removed: result.removed,
    removedFrom: result.removedFrom,
  }
}

export async function cleanupAddonBackgroundJobs(addonId: string) {
  const match = createAddonBackgroundJobMatcher(addonId)
  const jobs = await listBackgroundJobs({
    match,
  })
  const removedFrom = new Set<AddonBackgroundJobDeleteResult["removedFrom"][number]>()
  const removedJobIds: string[] = []

  for (const job of jobs) {
    const result = await deleteBackgroundJobById(job.id, {
      match,
    })
    if (!result.removed) {
      continue
    }

    removedJobIds.push(result.id)
    for (const location of result.removedFrom) {
      removedFrom.add(location)
    }
  }

  return {
    matchedJobCount: jobs.length,
    removedJobCount: removedJobIds.length,
    removedJobIds,
    removedFrom: [...removedFrom.values()],
  }
}

async function runAddonBackgroundJob(
  registration: AddonBackgroundJobRegistration,
  addon: LoadedAddonRuntime,
  job: BackgroundJobEnvelope<typeof ADDON_BACKGROUND_JOB_NAME>,
) {
  await runWithAddonExecutionScope(addon, {
    action: `background-job:${registration.key}`,
  }, async () => {
    const { buildAddonExecutionContext } = await import("@/addons-host/runtime/loader")

    await registration.handle({
      ...buildAddonExecutionContext(addon, {
        pathname: `/__background-jobs/${addon.manifest.id}/${registration.key}`,
      }),
      job: createAddonBackgroundJobHandle(job),
      payload: isAddonBackgroundJobPayload(job.payload) ? job.payload.payload : undefined,
    })
  })
}

async function dispatchAddonBackgroundJob(
  payload: AddonBackgroundJobPayload,
  job: BackgroundJobEnvelope<typeof ADDON_BACKGROUND_JOB_NAME>,
) {
  const { findLoadedAddonByIdFresh } = await import("@/addons-host/runtime/loader")
  const addon = await findLoadedAddonByIdFresh(payload.addonId)

  if (!addon || !addon.enabled || addon.loadError) {
    throw new BackgroundJobPermanentError(
      `Addon background job target "${payload.addonId}" is unavailable`,
    )
  }

  const registration = findAddonBackgroundJobRegistration(addon, payload.jobKey)
  if (!registration) {
    throw new BackgroundJobPermanentError(
      `Addon background job "${payload.addonId}:${payload.jobKey}" is not registered`,
    )
  }

  await runAddonBackgroundJob(registration, addon, job)
}

registerBackgroundJobHandler(
  ADDON_BACKGROUND_JOB_NAME,
  async (payload, job) => {
    if (!isAddonBackgroundJobPayload(payload)) {
      throw new BackgroundJobPermanentError("Invalid addon background job payload")
    }

    await dispatchAddonBackgroundJob(payload, job)
  },
)
