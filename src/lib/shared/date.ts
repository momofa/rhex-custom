function addMilliseconds(date: Date, milliseconds: number) {
  return new Date(date.getTime() + milliseconds)
}

export function addMinutes(date: Date, minutes: number) {
  return addMilliseconds(date, minutes * 60_000)
}

export function addSeconds(date: Date, seconds: number) {
  return addMilliseconds(date, seconds * 1_000)
}

export function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  return new Date(value).toISOString()
}
