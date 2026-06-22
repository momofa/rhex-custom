import writeGuardConfig from "../../write-guard.config"

import type { WriteGuardPolicyConfig } from "@/lib/write-guard-policy-types"
import type { WriteGuardOptions } from "@/lib/write-guard"

type WriteGuardInput = Record<string, unknown> | undefined

type RequestWriteGuardPolicyName = keyof typeof writeGuardConfig

function readPathValue(input: WriteGuardInput, path: string) {
  const segments = path.split(".").filter(Boolean)

  let current: unknown = input

  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

function normalizeDedupeValue(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return ""
  }

  if (typeof value === "string") {
    return value
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value)
  }

  return JSON.stringify(value)
}

function createDedupeKey(policyName: RequestWriteGuardPolicyName, input: WriteGuardInput, context: { userId?: number | null }) {
  const policy = writeGuardConfig[policyName] as WriteGuardPolicyConfig
  const dedupe = policy.dedupe

  if (!dedupe) {
    return null
  }

  const values = dedupe.parts.map((part: string) => {
    if (part === "userId") {
      return normalizeDedupeValue(context.userId ?? "anonymous")
    }

    return normalizeDedupeValue(readPathValue(input, part))
  })

  return values.join(dedupe.separator ?? ":")
}

export function createRequestWriteGuardOptions<Name extends RequestWriteGuardPolicyName>(
  name: Name,
  params: {
    input: WriteGuardInput
    request: Request
    userId?: number | null
  },
): Omit<WriteGuardOptions, "identity"> & { request: Request; userId?: number | null } {
  const options = createWriteGuardOptions(name, {
    input: params.input,
    userId: params.userId ?? null,
  })

  return {
    ...options,
    request: params.request,
    userId: params.userId ?? null,
  }
}

export function createWriteGuardOptions<Name extends RequestWriteGuardPolicyName>(
  name: Name,
  params: {
    input: WriteGuardInput
    userId?: number | null
  },
): Omit<WriteGuardOptions, "identity"> {
  const policy = writeGuardConfig[name] as WriteGuardPolicyConfig

  if (!policy) {
    throw new Error(`Missing write guard policy: ${String(name)}`)
  }

  const dedupeKey = createDedupeKey(name, params.input, {
    userId: params.userId ?? null,
  })

  return {
    scope: policy.scope,
    cooldownMs: policy.cooldownMs,
    cooldownMessage: policy.cooldownMessage,
    dedupeWindowMs: policy.dedupe?.windowMs,
    releaseOnError: policy.releaseOnError,
    ...(dedupeKey ? { dedupeKey } : {}),
  }
}
