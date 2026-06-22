export type PasswordStrength = "LOW" | "MEDIUM" | "HIGH"

export interface PasswordPolicySettings {
  minLength: number
  strength: PasswordStrength
}

export const PASSWORD_STRENGTH_VALUES: PasswordStrength[] = ["LOW", "MEDIUM", "HIGH"]
export const DEFAULT_PASSWORD_MIN_LENGTH = 6
export const DEFAULT_PASSWORD_STRENGTH: PasswordStrength = "LOW"
export const MAX_PASSWORD_LENGTH = 64

export function normalizePasswordMinLength(value: unknown, fallback = DEFAULT_PASSWORD_MIN_LENGTH) {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number(value)
      : Number.NaN

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(MAX_PASSWORD_LENGTH, Math.max(6, Math.floor(parsed)))
}

export function normalizePasswordStrength(value: unknown, fallback: PasswordStrength = DEFAULT_PASSWORD_STRENGTH): PasswordStrength {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH" ? value : fallback
}

export function normalizePasswordPolicySettings(input: Partial<PasswordPolicySettings> = {}): PasswordPolicySettings {
  return {
    minLength: normalizePasswordMinLength(input.minLength),
    strength: normalizePasswordStrength(input.strength),
  }
}

export function getPasswordStrengthLabel(strength: PasswordStrength) {
  switch (strength) {
    case "HIGH":
      return "\u9ad8\u5f3a\u5ea6"
    case "MEDIUM":
      return "\u4e2d\u7b49\u5f3a\u5ea6"
    default:
      return "\u57fa\u7840\u5f3a\u5ea6"
  }
}

export function getPasswordStrengthDescription(strength: PasswordStrength) {
  switch (strength) {
    case "HIGH":
      return "\u9700\u540c\u65f6\u5305\u542b\u5927\u5199\u5b57\u6bcd\u3001\u5c0f\u5199\u5b57\u6bcd\u3001\u6570\u5b57\u548c\u7279\u6b8a\u5b57\u7b26"
    case "MEDIUM":
      return "\u9700\u540c\u65f6\u5305\u542b\u5b57\u6bcd\u548c\u6570\u5b57"
    default:
      return "\u4ec5\u6821\u9a8c\u5bc6\u7801\u957f\u5ea6"
  }
}

export function validatePasswordPolicy(password: string, policy: PasswordPolicySettings) {
  const normalizedPolicy = normalizePasswordPolicySettings(policy)

  if (password.length < normalizedPolicy.minLength || password.length > MAX_PASSWORD_LENGTH) {
    return {
      success: false,
      message: `\u5bc6\u7801\u957f\u5ea6\u9700\u4e3a ${normalizedPolicy.minLength}-${MAX_PASSWORD_LENGTH} \u4f4d`,
    }
  }

  if (normalizedPolicy.strength === "MEDIUM") {
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return {
        success: false,
        message: "\u5bc6\u7801\u9700\u540c\u65f6\u5305\u542b\u5b57\u6bcd\u548c\u6570\u5b57",
      }
    }
  }

  if (normalizedPolicy.strength === "HIGH") {
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return {
        success: false,
        message: "\u5bc6\u7801\u9700\u540c\u65f6\u5305\u542b\u5927\u5199\u5b57\u6bcd\u3001\u5c0f\u5199\u5b57\u6bcd\u3001\u6570\u5b57\u548c\u7279\u6b8a\u5b57\u7b26",
      }
    }
  }

  return { success: true, message: "" }
}
