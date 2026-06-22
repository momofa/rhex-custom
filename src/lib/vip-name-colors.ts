export interface VipNameColors {
  normal: string
  vip1: string
  vip2: string
  vip3: string
}

export const DEFAULT_VIP_NAME_COLORS: VipNameColors = {
  normal: "",
  vip1: "",
  vip2: "",
  vip3: "",
}

export const VIP_NAME_COLOR_FALLBACKS: Record<keyof VipNameColors, string> = {
  normal: "#0F172A",
  vip1: "#6D28D9",
  vip2: "#BE123C",
  vip3: "#B45309",
}

export const VIP_NAME_COLOR_PRESETS = [
  "#0F172A",
  "#334155",
  "#475569",
  "#6D28D9",
  "#7C3AED",
  "#BE123C",
  "#E11D48",
  "#B45309",
  "#D97706",
  "#15803D",
  "#0284C7",
] as const

export function normalizeVipNameColorValue(value: string | null | undefined, fallback = "") {
  if (value === undefined || value === null) {
    return fallback
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return ""
  }

  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toUpperCase() : fallback
}

export function normalizeVipNameColors(input?: Partial<VipNameColors> | null, fallback: Partial<VipNameColors> = DEFAULT_VIP_NAME_COLORS): VipNameColors {
  const normalizedFallback = {
    normal: normalizeVipNameColorValue(fallback.normal, DEFAULT_VIP_NAME_COLORS.normal),
    vip1: normalizeVipNameColorValue(fallback.vip1, DEFAULT_VIP_NAME_COLORS.vip1),
    vip2: normalizeVipNameColorValue(fallback.vip2, DEFAULT_VIP_NAME_COLORS.vip2),
    vip3: normalizeVipNameColorValue(fallback.vip3, DEFAULT_VIP_NAME_COLORS.vip3),
  }

  return {
    normal: normalizeVipNameColorValue(input?.normal, normalizedFallback.normal),
    vip1: normalizeVipNameColorValue(input?.vip1, normalizedFallback.vip1),
    vip2: normalizeVipNameColorValue(input?.vip2, normalizedFallback.vip2),
    vip3: normalizeVipNameColorValue(input?.vip3, normalizedFallback.vip3),
  }
}

export function buildVipNameColorStyleVariables(colors?: Partial<VipNameColors> | null) {
  const normalized = normalizeVipNameColors(colors)
  const styleVariables: Record<`--${string}`, string> = {}

  if (normalized.normal) {
    styleVariables["--vip-name-color-normal"] = normalized.normal
  }

  if (normalized.vip1) {
    styleVariables["--vip-name-color-vip1"] = normalized.vip1
  }

  if (normalized.vip2) {
    styleVariables["--vip-name-color-vip2"] = normalized.vip2
  }

  if (normalized.vip3) {
    styleVariables["--vip-name-color-vip3"] = normalized.vip3
  }

  return styleVariables
}
