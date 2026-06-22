import BigNumber from "bignumber.js"

const MAX_SAFE_INTEGER = new BigNumber(Number.MAX_SAFE_INTEGER)

function toBigNumber(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim()
    return normalized ? new BigNumber(normalized) : new BigNumber(NaN)
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? new BigNumber(value) : new BigNumber(NaN)
  }

  if (typeof value === "bigint") {
    return new BigNumber(value.toString())
  }

  return new BigNumber(NaN)
}

export function parseSafeInteger(value: unknown) {
  const parsed = toBigNumber(value)
  if (!parsed.isFinite() || !parsed.isInteger() || parsed.gt(MAX_SAFE_INTEGER) || parsed.lt(MAX_SAFE_INTEGER.negated())) {
    return null
  }

  return parsed.toNumber()
}

export function parseNonNegativeSafeInteger(value: unknown) {
  const parsed = parseSafeInteger(value)
  if (parsed === null || parsed < 0) {
    return null
  }

  return parsed
}

export function parsePositiveSafeInteger(value: unknown) {
  const parsed = parseSafeInteger(value)
  if (parsed === null || parsed <= 0) {
    return null
  }

  return parsed
}

export function multiplyPositiveSafeIntegers(left: unknown, right: unknown) {

  const normalizedLeft = parsePositiveSafeInteger(left)
  const normalizedRight = parsePositiveSafeInteger(right)

  if (!normalizedLeft || !normalizedRight) {
    return null
  }

  const result = new BigNumber(normalizedLeft).multipliedBy(normalizedRight)
  if (!result.isInteger() || result.lte(0) || result.gt(MAX_SAFE_INTEGER)) {
    return null
  }

  return result.toNumber()
}

export function addSafeIntegers(left: unknown, right: unknown) {
  const normalizedLeft = parseSafeInteger(left)
  const normalizedRight = parseSafeInteger(right)

  if (normalizedLeft === null || normalizedRight === null) {
    return null
  }

  const result = new BigNumber(normalizedLeft).plus(normalizedRight)
  if (!result.isInteger() || result.gt(MAX_SAFE_INTEGER) || result.lt(MAX_SAFE_INTEGER.negated())) {
    return null
  }

  return result.toNumber()
}

export function subtractSafeIntegers(left: unknown, right: unknown) {
  const normalizedLeft = parseSafeInteger(left)
  const normalizedRight = parseSafeInteger(right)

  if (normalizedLeft === null || normalizedRight === null) {
    return null
  }

  const result = new BigNumber(normalizedLeft).minus(normalizedRight)
  if (!result.isInteger() || result.gt(MAX_SAFE_INTEGER) || result.lt(MAX_SAFE_INTEGER.negated())) {
    return null
  }

  return result.toNumber()
}

export function dividePositiveSafeIntegers(dividend: unknown, divisor: unknown, rounding: "floor" | "ceil" = "floor") {
  const normalizedDividend = parsePositiveSafeInteger(dividend)
  const normalizedDivisor = parsePositiveSafeInteger(divisor)

  if (!normalizedDividend || !normalizedDivisor) {
    return null
  }

  const result = new BigNumber(normalizedDividend)
    .dividedBy(normalizedDivisor)
    .integerValue(rounding === "ceil" ? BigNumber.ROUND_CEIL : BigNumber.ROUND_FLOOR)

  if (!result.isInteger() || result.lte(0) || result.gt(MAX_SAFE_INTEGER)) {
    return null
  }

  return result.toNumber()
}

export function floorSafeInteger(value: unknown) {
  const parsed = toBigNumber(value).integerValue(BigNumber.ROUND_FLOOR)
  if (!parsed.isFinite() || !parsed.isInteger() || parsed.gt(MAX_SAFE_INTEGER) || parsed.lt(MAX_SAFE_INTEGER.negated())) {
    return null
  }

  return parsed.toNumber()
}

export function clampSafeInteger(value: unknown, minimum: number, maximum?: number) {
  const parsed = parseSafeInteger(value)
  const normalizedMinimum = parseSafeInteger(minimum)
  const normalizedMaximum = typeof maximum === "number" ? parseSafeInteger(maximum) : null

  if (parsed === null || normalizedMinimum === null) {
    return null
  }

  if (normalizedMaximum !== null && normalizedMaximum < normalizedMinimum) {
    return null
  }

  if (parsed < normalizedMinimum) {
    return normalizedMinimum
  }

  if (normalizedMaximum !== null && parsed > normalizedMaximum) {
    return normalizedMaximum
  }

  return parsed
}
