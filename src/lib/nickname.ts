export function normalizeNickname(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function nicknameContainsWhitespace(value: unknown) {
  return typeof value === "string" && /\s/u.test(value)
}

export function normalizeNicknameForComparison(value: string) {
  return value.trim().toLocaleLowerCase()
}

export function isEquivalentNickname(left: string, right: string) {
  return normalizeNicknameForComparison(left) === normalizeNicknameForComparison(right)
}
