export function resolveHookedStringValue(
  currentValue: string,
  hookedValue: unknown,
) {
  if (typeof hookedValue !== "string") {
    return {
      value: currentValue,
      changed: false,
    }
  }

  const nextValue = hookedValue.trim() ? hookedValue : currentValue

  return {
    value: nextValue,
    changed: nextValue !== currentValue,
  }
}

export function resolveHookedOptionalStringValue(
  currentValue: string,
  hookedValue: unknown,
) {
  if (typeof hookedValue !== "string") {
    return {
      value: currentValue,
      changed: false,
    }
  }

  return {
    value: hookedValue,
    changed: hookedValue !== currentValue,
  }
}
