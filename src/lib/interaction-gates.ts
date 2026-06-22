import { apiError } from "@/lib/api-route"
import type { InteractionGateAction, InteractionGateSettings } from "@/lib/site-settings"

export interface InteractionGateUserSnapshot {
  id: number
  role: "USER" | "MODERATOR" | "ADMIN"
  createdAt: Date | string
  emailVerifiedAt?: Date | string | null
  phoneVerifiedAt?: Date | string | null
}

const INTERACTION_GATE_ACTION_LABELS: Record<InteractionGateAction, string> = {
  POST_CREATE: "发帖",
  COMMENT_CREATE: "回复",
}

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function getRequiredRegisteredMinutes(settings: InteractionGateSettings, action: InteractionGateAction) {
  const condition = settings.actions[action].conditions.find((item) => item.type === "REGISTERED_MINUTES")
  return condition?.type === "REGISTERED_MINUTES" ? condition.value : 0
}

function requiresEmailVerified(settings: InteractionGateSettings, action: InteractionGateAction) {
  return settings.actions[action].conditions.some((item) => item.type === "EMAIL_VERIFIED")
}

function requiresPhoneVerified(settings: InteractionGateSettings, action: InteractionGateAction) {
  return settings.actions[action].conditions.some((item) => item.type === "PHONE_VERIFIED")
}

export function enforceInteractionGate(params: {
  action: InteractionGateAction
  settings: InteractionGateSettings
  user: InteractionGateUserSnapshot
  now?: Date
}) {
  if (params.user.role !== "USER") {
    return
  }

  const rule = params.settings.actions[params.action]
  if (!rule.enabled || rule.conditions.length === 0) {
    return
  }

  if (requiresEmailVerified(params.settings, params.action) && !params.user.emailVerifiedAt) {
    apiError(403, `当前站点要求完成邮箱验证后才能${INTERACTION_GATE_ACTION_LABELS[params.action]}`)
  }

  if (requiresPhoneVerified(params.settings, params.action) && !params.user.phoneVerifiedAt) {
    apiError(403, `当前站点要求完成手机验证后才能${INTERACTION_GATE_ACTION_LABELS[params.action]}`)
  }

  const requiredRegisteredMinutes = getRequiredRegisteredMinutes(params.settings, params.action)
  if (requiredRegisteredMinutes <= 0) {
    return
  }

  const createdAtTimestamp = toTimestamp(params.user.createdAt)
  const nowTimestamp = toTimestamp(params.now ?? new Date())
  if (createdAtTimestamp === null || nowTimestamp === null) {
    apiError(403, `当前账号注册时间异常，暂时不能${INTERACTION_GATE_ACTION_LABELS[params.action]}`)
  }

  const registeredMinutes = Math.floor((nowTimestamp - createdAtTimestamp) / 60_000)
  if (registeredMinutes < requiredRegisteredMinutes) {
    apiError(403, `注册未满 ${requiredRegisteredMinutes} 分钟，暂时不能${INTERACTION_GATE_ACTION_LABELS[params.action]}`)
  }
}
