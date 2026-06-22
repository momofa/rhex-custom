export interface RenewableLease {
  renew: (ttlMs: number) => Promise<boolean>
  release: () => Promise<boolean>
}

type Clock = {
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export interface AcquireLeaseWithRetryOptions<TLease> extends Clock {
  acquireLease: () => Promise<TLease | null>
  maxWaitMs: number
  retryDelayMs: number
}

export interface RenewLeaseWithRecoveryOptions<TLease extends RenewableLease> extends Clock {
  lease: TLease
  ttlMs: number
  recoveryMaxWaitMs: number
  recoveryRetryDelayMs: number
  acquireLease: () => Promise<TLease | null>
}

function resolveNow(now?: () => number) {
  return now ?? Date.now
}

function resolveSleep(sleep?: (ms: number) => Promise<void>) {
  return sleep ?? ((ms: number) => new Promise((resolve) => {
    setTimeout(resolve, ms)
  }))
}

export async function acquireLeaseWithRetry<TLease>(options: AcquireLeaseWithRetryOptions<TLease>): Promise<TLease | null> {
  const now = resolveNow(options.now)
  const sleep = resolveSleep(options.sleep)
  const maxWaitMs = Math.max(0, Math.floor(options.maxWaitMs))
  const retryDelayMs = Math.max(1, Math.floor(options.retryDelayMs))
  const startedAt = now()

  while (now() - startedAt <= maxWaitMs) {
    const lease = await options.acquireLease()
    if (lease) {
      return lease
    }

    if (now() - startedAt >= maxWaitMs) {
      break
    }

    await sleep(retryDelayMs)
  }

  return null
}

export async function renewLeaseWithRecovery<TLease extends RenewableLease>(
  options: RenewLeaseWithRecoveryOptions<TLease>,
): Promise<TLease | null> {
  const renewed = await options.lease.renew(options.ttlMs)
  if (renewed) {
    return options.lease
  }

  return acquireLeaseWithRetry({
    acquireLease: options.acquireLease,
    maxWaitMs: options.recoveryMaxWaitMs,
    retryDelayMs: options.recoveryRetryDelayMs,
    now: options.now,
    sleep: options.sleep,
  })
}
