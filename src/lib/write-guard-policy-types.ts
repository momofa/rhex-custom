export interface WriteGuardPolicyDedupeConfig {
  parts: string[]
  separator?: string
  windowMs?: number
}

export interface WriteGuardPolicyConfig {
  description: string
  scope: string
  cooldownMs?: number
  cooldownMessage?: string
  releaseOnError?: boolean
  dedupe?: WriteGuardPolicyDedupeConfig
}

export type WriteGuardPolicyConfigMap = Record<string, WriteGuardPolicyConfig>
