export interface ParseBoundedIntegerOptions {
  min: number
  max: number
}

export function parseBoundedInteger(
  value: string | number | null | undefined,
  fallback: number,
  options: ParseBoundedIntegerOptions,
) {
  const parsed = Number.parseInt(String(value ?? ""), 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(options.max, Math.max(options.min, parsed))
}
