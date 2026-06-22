import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from "@simplewebauthn/server"

import type { PendingPasskeyCredential } from "@/lib/external-auth-types"
import type { StoredPasskeyCredential } from "@/lib/external-auth-store"
import type { ServerSiteSettingsData } from "@/lib/site-settings"

type PasskeyConfigSettings = Pick<ServerSiteSettingsData, "passkeyRpId" | "passkeyRpName" | "passkeyOrigin">

function getRequiredPasskeyValue(fieldLabel: string, value: string | null | undefined) {
  const normalizedValue = typeof value === "string" ? value.trim() : ""

  if (!normalizedValue) {
    throw new Error(`已开启 Passkey 登录，但后台未填写 ${fieldLabel}`)
  }

  return normalizedValue
}

export function getPasskeyConfig(settings: PasskeyConfigSettings) {
  const origin = getRequiredPasskeyValue("Passkey Origin", settings.passkeyOrigin)
  const rpID = getRequiredPasskeyValue("Passkey RP ID", settings.passkeyRpId)
  const rpName = getRequiredPasskeyValue("Passkey RP Name", settings.passkeyRpName)

  try {
    const originUrl = new URL(origin)

    return {
      origin: originUrl.origin,
      rpID,
      rpName,
    }
  } catch {
    throw new Error("Passkey Origin 配置格式不正确，必须是完整的 http(s) 地址")
  }
}

function decodeBase64Url(value: string) {
  return Uint8Array.from(Buffer.from(value, "base64url"))
}

function encodeBase64Url(value: string | Uint8Array | ArrayBuffer) {
  if (typeof value === "string") {
    return value
  }

  return Buffer.from(value instanceof Uint8Array ? value : new Uint8Array(value)).toString("base64url")
}

export async function createPasskeyRegistrationOptions(settings: PasskeyConfigSettings, input: {
  username: string
  displayName?: string | null
}) {
  const config = getPasskeyConfig(settings)

  return generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userName: input.username,
    userDisplayName: input.displayName ?? input.username,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  })
}

export async function verifyPasskeyRegistration(settings: PasskeyConfigSettings, response: RegistrationResponseJSON, expectedChallenge: string) {
  const config = getPasskeyConfig(settings)

  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpID,
    requireUserVerification: true,
  })
}

export async function createPasskeyAuthenticationOptions(settings: PasskeyConfigSettings, input?: {
  credentials?: StoredPasskeyCredential[]
}) {
  const config = getPasskeyConfig(settings)

  return generateAuthenticationOptions({
    rpID: config.rpID,
    allowCredentials: input?.credentials?.length
      ? input.credentials.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports as AuthenticatorTransportFuture[],
      }))
      : undefined,
    userVerification: "required",
  })
}

function createStoredWebAuthnCredential(credential: StoredPasskeyCredential): WebAuthnCredential {
  return {
    id: credential.credentialId,
    publicKey: decodeBase64Url(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports as AuthenticatorTransportFuture[],
  }
}

export async function verifyPasskeyAuthentication(
  settings: PasskeyConfigSettings,
  response: AuthenticationResponseJSON,
  credential: StoredPasskeyCredential,
  expectedChallenge: string,
) {
  const config = getPasskeyConfig(settings)

  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpID,
    credential: createStoredWebAuthnCredential(credential),
    requireUserVerification: true,
  })
}

export function buildPendingPasskeyCredential(input: {
  credentialId: string | Uint8Array | ArrayBuffer
  publicKey: string | Uint8Array | ArrayBuffer
  counter: number
  deviceType: string
  backedUp: boolean
  transports?: AuthenticatorTransportFuture[]
}): PendingPasskeyCredential {
  return {
    credentialId: encodeBase64Url(input.credentialId),
    publicKey: encodeBase64Url(input.publicKey),
    counter: input.counter,
    deviceType: input.deviceType,
    backedUp: input.backedUp,
    transports: input.transports?.map((item) => String(item)) ?? [],
  }
}
