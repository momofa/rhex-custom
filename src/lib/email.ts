const EMAIL_DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase()
}

export function normalizeOptionalEmailAddress(value?: string | null) {
  const normalized = typeof value === "string" ? normalizeEmailAddress(value) : ""
  return normalized || null
}

function normalizeEmailWhitelistDomain(value: string) {
  return value.trim().toLowerCase().replace(/^@+/, "").replace(/^\.+/, "").replace(/\.+$/, "")
}

export function parseEmailWhitelistDomains(value: string | string[]) {
  const rawItems = Array.isArray(value) ? value : value.split(/[，,\r\n\s]+/)
  const domains: string[] = []
  const invalidDomains: string[] = []

  for (const rawItem of rawItems) {
    const trimmed = typeof rawItem === "string" ? rawItem.trim() : ""
    const normalized = normalizeEmailWhitelistDomain(trimmed)

    if (!normalized) {
      continue
    }

    if (EMAIL_DOMAIN_PATTERN.test(normalized)) {
      domains.push(normalized)
      continue
    }

    invalidDomains.push(trimmed)
  }

  return {
    domains: Array.from(new Set(domains)),
    invalidDomains: Array.from(new Set(invalidDomains)),
  }
}

export function isEmailInWhitelist(email: string, whitelistDomains: string[]) {
  const normalizedEmail = normalizeEmailAddress(email)
  const atIndex = normalizedEmail.lastIndexOf("@")

  if (atIndex < 0 || atIndex === normalizedEmail.length - 1) {
    return false
  }

  const emailDomain = normalizedEmail.slice(atIndex + 1)
  const { domains } = parseEmailWhitelistDomains(whitelistDomains)

  return domains.some((domain) => emailDomain === domain || emailDomain.endsWith(`.${domain}`))
}
