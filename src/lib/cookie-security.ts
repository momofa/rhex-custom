import { getConfiguredSiteOrigin } from "@/lib/site-origin-config"

const TRUE_VALUES = new Set(["1", "true", "yes", "on"])
const FALSE_VALUES = new Set(["0", "false", "no", "off"])

export interface CookieSecurityContext {
  request?: Pick<Request, "headers" | "url"> | null
  headers?: Headers | null
}

function parseBooleanOverride(value: string | undefined) {
  const normalized = value?.trim().toLowerCase()

  if (!normalized) {
    return null
  }

  if (TRUE_VALUES.has(normalized)) {
    return true
  }

  if (FALSE_VALUES.has(normalized)) {
    return false
  }

  return null
}

function readCookieSecureOverride() {
  return parseBooleanOverride(process.env.COOKIE_SECURE)
}

function readForwardedProto(headers: Headers | null | undefined) {
  const rawValue = headers?.get("x-forwarded-proto") ?? headers?.get("x-forwarded-protocol")
  const protocol = rawValue?.split(",")[0]?.trim().toLowerCase()

  if (!protocol) {
    return null
  }

  if (protocol === "https") {
    return true
  }

  if (protocol === "http") {
    return false
  }

  return null
}

function readProtocolFromUrl(url: string | undefined) {
  if (!url?.trim()) {
    return null
  }

  try {
    return new URL(url).protocol === "https:"
  } catch {
    return null
  }
}

function readConfiguredOriginProtocol() {
  const configuredOrigin = getConfiguredSiteOrigin()

  if (!configuredOrigin) {
    return null
  }

  return readProtocolFromUrl(configuredOrigin)
}

export function shouldUseSecureCookies(context?: CookieSecurityContext) {
  const override = readCookieSecureOverride()

  if (override !== null) {
    return override
  }

  const headers = context?.request?.headers ?? context?.headers
  const forwardedProto = readForwardedProto(headers)

  if (forwardedProto !== null) {
    return forwardedProto
  }

  const requestProtocol = readProtocolFromUrl(context?.request?.url)

  if (requestProtocol !== null) {
    return requestProtocol
  }

  const configuredOriginProtocol = readConfiguredOriginProtocol()

  if (configuredOriginProtocol !== null) {
    return configuredOriginProtocol
  }

  return process.env.NODE_ENV === "production"
}
