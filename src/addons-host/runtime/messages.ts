import "server-only"

import { executeDirectMessageSend } from "@/lib/message-send-execution"
import { resolveAddonActor } from "@/addons-host/runtime/actors"
import type {
  AddonMessageSendInput,
  AddonMessageSendResult,
  LoadedAddonRuntime,
} from "@/addons-host/types"

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function buildAddonRuntimeRequest(
  addon: LoadedAddonRuntime,
  runtimePath: string,
  request?: Request,
) {
  const origin = request
    ? new URL(request.url).origin
    : "http://localhost"

  return new Request(
    new URL(`${addon.publicApiBaseUrl}/${runtimePath.replace(/^\/+/, "")}`, origin).toString(),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rhex-addon-id": addon.manifest.id,
      },
    },
  )
}

export async function sendAddonMessage(
  addon: LoadedAddonRuntime,
  input: AddonMessageSendInput,
  request?: Request,
): Promise<AddonMessageSendResult> {
  const sender = await resolveAddonActor({
    userId: input.senderId,
    username: input.senderUsername,
    label: "私信发送账号",
  })
  const recipient = await resolveAddonActor({
    userId: input.recipientId,
    username: input.recipientUsername,
    label: "私信接收账号",
  })

  return executeDirectMessageSend({
    recipientId: recipient.id,
    body: normalizeOptionalString(input.body),
  }, {
    request: buildAddonRuntimeRequest(addon, "__internal/messages/send", request),
    sender,
    log: {
      scope: "addon-messages-send",
      action: "addon-send-direct-message",
      extra: {
        addonId: addon.manifest.id,
        addonName: addon.manifest.name,
      },
    },
  })
}
