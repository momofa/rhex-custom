export const USER_STATUS_EXPIRATION_PRESETS = [
  { label: "3 天", days: 3 },
  { label: "7 天", days: 7 },
  { label: "30 天", days: 30 },
] as const

export function formatDateTimeLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("")
}

export function buildUserStatusExpirationDraft(days: number) {
  return formatDateTimeLocalInput(new Date(Date.now() + days * 24 * 60 * 60 * 1000))
}
