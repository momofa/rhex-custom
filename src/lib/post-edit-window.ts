const PERMANENT_EDIT_WINDOW_MINUTES = -1

export function isPermanentPostEditWindow(editableMinutes: number) {
  return editableMinutes === PERMANENT_EDIT_WINDOW_MINUTES
}

export function normalizePostEditableMinutes(value: unknown, fallback: number) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  const minutes = Math.floor(numericValue)
  return minutes < 0 ? PERMANENT_EDIT_WINDOW_MINUTES : minutes
}

export function resolvePostEditableUntil(createdAt: Date | string, editableMinutes: number) {
  if (isPermanentPostEditWindow(editableMinutes)) {
    return null
  }

  const createdAtTime = new Date(createdAt).getTime()
  if (!Number.isFinite(createdAtTime) || createdAtTime <= 0) {
    return null
  }

  return new Date(createdAtTime + Math.max(0, editableMinutes) * 60 * 1000)
}

export function isPostStillEditable(createdAt: Date | string, editableMinutes: number, now = Date.now()) {
  if (isPermanentPostEditWindow(editableMinutes)) {
    return true
  }

  const editableUntil = resolvePostEditableUntil(createdAt, editableMinutes)
  return editableUntil ? editableUntil.getTime() > now : false
}

export function formatPostEditWindowLabel(editableMinutes: number) {
  return isPermanentPostEditWindow(editableMinutes)
    ? "永久"
    : `${Math.max(0, editableMinutes)} 分钟`
}
