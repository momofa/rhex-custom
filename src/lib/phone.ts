export function normalizePhoneNumber(value: string) {
  return value.trim().replace(/[\s-]/g, "")
}

export function isValidMainlandPhone(value: string) {
  return /^1\d{10}$/.test(normalizePhoneNumber(value))
}
