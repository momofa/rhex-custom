import "server-only"

import { prisma } from "@/db/client"
import { sendSms } from "@/lib/sms"
import type {
  AddonSmsSendInput,
  AddonSmsSendResult,
} from "@/addons-host/types"

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizePositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null
}

async function resolveAddonSmsRecipient(input: AddonSmsSendInput) {
  const explicitPhone = normalizeOptionalString(input.phone)

  if (explicitPhone) {
    return {
      id: null,
      username: null,
      phone: explicitPhone,
    }
  }

  const userId = normalizePositiveInteger(input.recipientId)
  const username = normalizeOptionalString(input.recipientUsername)

  if (!userId && !username) {
    throw new Error("短信接收对象需要提供 phone、recipientId 或 recipientUsername")
  }

  const recipient = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          phone: true,
          phoneVerifiedAt: true,
        },
      })
    : await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          phone: true,
          phoneVerifiedAt: true,
        },
      })

  if (!recipient) {
    throw new Error(
      username
        ? `未找到短信接收账号 ${username}`
        : `未找到短信接收账号 #${userId}`,
    )
  }

  if (!recipient.phone || !recipient.phoneVerifiedAt) {
    throw new Error(`短信接收账号 ${recipient.username} 没有已验证手机号`)
  }

  return {
    ...recipient,
    phone: recipient.phone,
  }
}

export async function sendAddonSms(
  input: AddonSmsSendInput,
): Promise<AddonSmsSendResult> {
  const recipient = await resolveAddonSmsRecipient(input)
  const result = await sendSms({
    phone: recipient.phone,
    code: normalizeOptionalString(input.code) || undefined,
    scene: normalizeOptionalString(input.scene) || "addon",
    templateCode: normalizeOptionalString(input.templateCode) || undefined,
    templateParam: input.templateParam,
    signName: normalizeOptionalString(input.signName) || undefined,
    outId: normalizeOptionalString(input.outId) || undefined,
  })

  return {
    userId: recipient.id,
    username: recipient.username,
    phone: recipient.phone,
    provider: result.provider,
    sent: true,
    queued: result.queued ? true : undefined,
    jobId: result.jobId,
    sentAt: new Date().toISOString(),
    messageId: result.messageId ?? null,
    requestId: result.requestId ?? null,
  }
}
