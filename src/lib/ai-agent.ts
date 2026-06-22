import { getAiReplyConfig } from "@/lib/ai-reply-config"
import { withRuntimeFallback } from "@/lib/runtime-errors"

type AiAgentConfigLike = {
  agentUserId?: unknown
  agents?: Array<{ agentUserId?: unknown }> | null
}

function normalizeAiAgentUserId(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null
}

export function resolveAiAgentUserIds(config: AiAgentConfigLike) {
  const userIds: number[] = []
  const seenUserIds = new Set<number>()

  const addUserId = (value: unknown) => {
    const userId = normalizeAiAgentUserId(value)
    if (!userId || seenUserIds.has(userId)) {
      return
    }

    seenUserIds.add(userId)
    userIds.push(userId)
  }

  addUserId(config.agentUserId)
  for (const agent of config.agents ?? []) {
    addUserId(agent.agentUserId)
  }

  return userIds
}

export async function getAiAgentUserIds() {
  return withRuntimeFallback(async () => {
    const config = await getAiReplyConfig()
    return resolveAiAgentUserIds(config)
  }, {
    area: "ai-reply",
    action: "getAiAgentUserIds",
    message: "AI 代理账号列表加载失败",
    fallback: [] as number[],
  })
}

export async function getAiAgentUserId() {
  return withRuntimeFallback(async () => {
    const config = await getAiReplyConfig()
    return resolveAiAgentUserIds(config)[0] ?? null
  }, {
    area: "ai-reply",
    action: "getAiAgentUserId",
    message: "AI 代理账号加载失败",
    fallback: null,
  })
}
