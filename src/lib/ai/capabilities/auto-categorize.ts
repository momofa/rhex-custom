import "server-only"

import { createHash } from "node:crypto"

import { prisma } from "@/db/client"
import {
  AiReplyTaskStatus,
  AutoCategorizeTaskSourceType,
  Prisma,
} from "@/db/types"
import { enqueueBackgroundJob, registerBackgroundJobHandler } from "@/lib/background-jobs"
import { logError, logInfo } from "@/lib/logger"
import { AiProviderError, resolveAiProvider, type AiProviderConfig } from "@/lib/ai/provider"
import { AiRateLimitError } from "@/lib/ai/rate-limit"
import { runAiTask } from "@/lib/ai/service"
import { getServerAiReplyConfig } from "@/lib/ai-reply-config"
import { getAiSafePostContentText } from "@/lib/post-content"
import { normalizeManualTags } from "@/lib/post-tags"
import { slugifyTagName } from "@/lib/post-taxonomy"

import { getAutoCategorizeConfig } from "./auto-categorize-config"

/**
 * 能力 1.b：auto 板块 / 标签选择
 * 现在统一走后台任务队列，预览请求和 post.create.after 都会落任务记录，
 * 便于在高流量下做统一并发控制、重试和后台追踪。
 */

const LOG_SCOPE = "ai.auto-categorize"
const AUTO_CATEGORIZE_BACKGROUND_JOB_NAME = "ai.auto-categorize.process"
const MAX_TITLE_CHARS = 200
const MAX_CONTENT_CHARS = 4000
const MAX_BOARD_CANDIDATES = 100
const MAX_TAG_CANDIDATES = 200
const MAX_TOKENS = 512
const AUTO_CATEGORIZE_RETRY_BASE_DELAY_MS = 30_000
const AUTO_CATEGORIZE_RETRY_MAX_DELAY_MS = 10 * 60 * 1_000
const AUTO_CATEGORIZE_PREVIEW_CACHE_TTL_MS = 5 * 60 * 1_000

interface SuggestionPayload {
  boardSlug?: string
  tags: string[]
  reasoning?: string
}

export interface AutoCategorizeBoardCandidate {
  id: string
  slug: string
  name: string
}

export interface AutoCategorizeTagCandidate {
  id: string
  slug: string
  name: string
}

export interface AutoCategorizeSuggestedTag {
  id?: string
  slug: string
  name: string
  isNew: boolean
}

export interface AutoCategorizeSuggestionData {
  board: AutoCategorizeBoardCandidate | null
  tags: AutoCategorizeSuggestedTag[]
  reasoning?: string
  model: string
}

export type AutoCategorizeFinalStatus =
  | "no_requested_capabilities"
  | "provider_not_configured"
  | "no_candidate_boards"
  | "invalid_json"
  | "empty_suggestion"
  | "ok"

export type AutoCategorizeSuggestionResult =
  | { status: "no_requested_capabilities" }
  | { status: "provider_not_configured" }
  | { status: "no_candidate_boards" }
  | { status: "invalid_json"; rawPreview: string }
  | { status: "empty_suggestion" }
  | { status: "ok"; data: AutoCategorizeSuggestionData }

export interface AutoCategorizeTaskPollResult {
  taskId: string
  status: "queued" | "processing" | AutoCategorizeFinalStatus
  board: {
    slug: string
    name: string
  } | null
  tags: Array<{
    slug: string
    name: string
  }>
  reasoning: string | null
  rawPreview?: string
}

type AutoCategorizeTaskWorkerRecord = Awaited<ReturnType<typeof loadAutoCategorizeTaskForWorker>>
const autoCategorizeTaskPollSelect = {
  id: true,
  status: true,
  allowBoardSuggestion: true,
  errorMessage: true,
  resultStatus: true,
  resultReasoning: true,
  resultRawPreview: true,
  resultTagIds: true,
  resultTagsJson: true,
  resultBoard: {
    select: {
      slug: true,
      name: true,
    },
  },
} satisfies Prisma.AutoCategorizeTaskSelect

class AutoCategorizeTaskCancelledError extends Error {}

function normalizeTaskText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength)
}

function stripFence(raw: string): string {
  const trimmed = raw.trim()
  const fence = trimmed.match(/^```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)\s*```$/u)
  return fence?.[1]?.trim() ?? trimmed
}

function parseSuggestion(raw: string): SuggestionPayload | null {
  const body = stripFence(raw)
  if (!body) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null
  }

  const obj = parsed as Record<string, unknown>
  const boardRaw = typeof obj.board === "string"
    ? obj.board
    : typeof obj.boardSlug === "string"
      ? obj.boardSlug
      : ""
  const boardSlug = boardRaw.trim() || undefined

  const tagsRaw = Array.isArray(obj.tags) ? obj.tags : []
  const tags = tagsRaw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)

  const reasoning = typeof obj.reasoning === "string"
    ? obj.reasoning.trim().slice(0, 500) || undefined
    : undefined

  return { boardSlug, tags, reasoning }
}

async function loadAutoCategorizeBoardCandidates(boardWhitelistSlugs: string[]) {
  const boardWhere: { status: "ACTIVE"; slug?: { in: string[] } } = { status: "ACTIVE" }
  if (boardWhitelistSlugs.length > 0) {
    boardWhere.slug = { in: boardWhitelistSlugs }
  }

  return prisma.board.findMany({
    where: boardWhere,
    select: { id: true, slug: true, name: true },
    orderBy: { sortOrder: "asc" },
    take: MAX_BOARD_CANDIDATES,
  })
}

async function loadAutoCategorizeDefaultBoardCandidate(defaultBoardSlug: string) {
  if (!defaultBoardSlug) {
    return null
  }

  return prisma.board.findFirst({
    where: {
      slug: defaultBoardSlug,
      status: "ACTIVE",
    },
    select: { id: true, slug: true, name: true },
  })
}

async function loadAutoCategorizeTagCandidates() {
  return prisma.tag.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: [{ postCount: "desc" }, { createdAt: "desc" }],
    take: MAX_TAG_CANDIDATES,
  })
}

async function loadTagsByIds(tagIds: string[]) {
  if (tagIds.length === 0) {
    return []
  }

  const tags = await prisma.tag.findMany({
    where: { id: { in: tagIds } },
    select: { id: true, slug: true, name: true },
  })
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))

  return tagIds
    .map((id) => tagMap.get(id))
    .filter((tag): tag is { id: string; slug: string; name: string } => Boolean(tag))
}

function normalizeGeneratedTagName(value: string) {
  return normalizeManualTags([value])[0] ?? ""
}

function serializeSuggestedTags(tags: AutoCategorizeSuggestedTag[]) {
  return tags.map((tag) => ({
    ...(tag.id ? { id: tag.id } : {}),
    slug: tag.slug,
    name: tag.name,
    isNew: tag.isNew,
  }))
}

function parseSuggestedTagsJson(value: unknown): AutoCategorizeSuggestedTag[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null
      }

      const record = item as Record<string, unknown>
      const slug = typeof record.slug === "string" ? record.slug.trim() : ""
      const name = typeof record.name === "string" ? record.name.trim() : ""
      const id = typeof record.id === "string" ? record.id.trim() : undefined
      if (!slug || !name) {
        return null
      }

      return {
        ...(id ? { id } : {}),
        slug,
        name,
        isNew: record.isNew === true || !id,
      } satisfies AutoCategorizeSuggestedTag
    })
    .filter((item): item is AutoCategorizeSuggestedTag => Boolean(item))
}

function resolveSuggestedTagsFromPayload(params: {
  payloadTags: string[]
  candidateTags: AutoCategorizeTagCandidate[]
  maxTagCount: number
}) {
  const tagBySlug = new Map(params.candidateTags.map((tag) => [tag.slug.toLowerCase(), tag]))
  const tagByName = new Map(params.candidateTags.map((tag) => [tag.name.toLowerCase(), tag]))
  const seenKeys = new Set<string>()
  const suggestedTags: AutoCategorizeSuggestedTag[] = []

  for (const rawValue of params.payloadTags) {
    const value = rawValue.trim()
    if (!value) {
      continue
    }

    const existingTag = tagBySlug.get(value.toLowerCase()) ?? tagByName.get(value.toLowerCase())
    if (existingTag) {
      const dedupeKey = `id:${existingTag.id}`
      if (seenKeys.has(dedupeKey)) {
        continue
      }
      seenKeys.add(dedupeKey)
      suggestedTags.push({
        id: existingTag.id,
        slug: existingTag.slug,
        name: existingTag.name,
        isNew: false,
      })
    } else {
      const normalizedName = normalizeGeneratedTagName(value)
      const normalizedSlug = slugifyTagName(normalizedName)
      if (!normalizedName || !normalizedSlug) {
        continue
      }

      const dedupeKey = `slug:${normalizedSlug.toLowerCase()}`
      if (seenKeys.has(dedupeKey)) {
        continue
      }
      seenKeys.add(dedupeKey)
      suggestedTags.push({
        slug: normalizedSlug,
        name: normalizedName,
        isNew: true,
      })
    }

    if (suggestedTags.length >= params.maxTagCount) {
      break
    }
  }

  return suggestedTags
}

function buildSuggestionPrompt(params: {
  title: string
  content: string
  allowBoardSuggestion: boolean
  allowTagSuggestion: boolean
  boards: AutoCategorizeBoardCandidate[]
  tags: AutoCategorizeTagCandidate[]
  maxTagCount: number
}) {
  const boardList = params.boards.map((board) => `- ${board.slug}: ${board.name}`).join("\n")
  const tagList = params.tags.length > 0
    ? params.tags.map((tag) => `- ${tag.slug}: ${tag.name}`).join("\n")
    : "（暂无预定义 tag，可返回 tags: []）"

  return [
    `帖子标题：${params.title}`,
    `帖子正文：\n${params.content || "（无正文）"}`,
    params.allowBoardSuggestion
      ? `候选板块（slug: 名称）：\n${boardList}`
      : "本次无需选择板块，board 字段固定输出空字符串。",
    params.allowTagSuggestion
      ? `候选标签（slug: 名称）：\n${tagList}\n\n最多可返回 ${params.maxTagCount} 个 tag；可直接返回候选标签的 slug，也可以返回新的标签名称。`
      : "本次无需提取标签，tags 字段固定输出空数组。",
    '请严格输出单个 JSON 对象，字段：{"board": "<slug>", "tags": ["<slug>", ...], "reasoning": "<简述>"}，不要额外说明。',
  ].join("\n\n")
}

function buildPreviewSourceKey(params: {
  requesterUserId: number
  title: string
  content: string
  allowBoardSuggestion: boolean
  allowTagSuggestion: boolean
  configCacheKey: string
}) {
  const hash = createHash("sha1")
    .update(JSON.stringify([
      params.requesterUserId,
      params.title,
      params.content,
      params.allowBoardSuggestion,
      params.allowTagSuggestion,
      params.configCacheKey,
    ]))
    .digest("hex")

  return `preview:${params.requesterUserId}:${hash}`
}

function buildPostCreateSourceKey(postId: string) {
  return `post:${postId}`
}

function getAutoCategorizeRetryDelayMs(attemptCount: number) {
  const delayMs = AUTO_CATEGORIZE_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attemptCount - 1)
  return Math.min(AUTO_CATEGORIZE_RETRY_MAX_DELAY_MS, delayMs)
}

function isCompletedTaskReusable(params: {
  sourceType: AutoCategorizeTaskSourceType
  status: AiReplyTaskStatus
  updatedAt: Date
}) {
  if (params.status !== AiReplyTaskStatus.SUCCEEDED) {
    return false
  }

  if (params.sourceType === AutoCategorizeTaskSourceType.POST_CREATE) {
    return true
  }

  return Date.now() - params.updatedAt.getTime() <= AUTO_CATEGORIZE_PREVIEW_CACHE_TTL_MS
}

function createTaskSuccessPayload(result: AutoCategorizeSuggestionResult) {
  if (result.status === "ok") {
    return {
      resultStatus: "ok" as const,
      resultBoardId: result.data.board?.id ?? null,
      resultTagIds: result.data.tags
        .map((tag) => tag.id)
        .filter((id): id is string => Boolean(id)),
      resultTagsJson: serializeSuggestedTags(result.data.tags),
      resultReasoning: result.data.reasoning ?? null,
      resultModelKey: result.data.model,
      resultRawPreview: null,
    }
  }

  return {
    resultStatus: result.status,
    resultBoardId: null,
    resultTagIds: [],
    resultTagsJson: [],
    resultReasoning: null,
    resultModelKey: null,
    resultRawPreview: result.status === "invalid_json" ? result.rawPreview : null,
  }
}

function buildDefaultBoardFallbackReasoning(
  defaultBoard: AutoCategorizeBoardCandidate,
  reasoning?: string,
  hasOtherSignal = false,
) {
  const fallbackMessage = hasOtherSignal
    ? `AI 未选出节点，已回退默认节点 ${defaultBoard.name}（${defaultBoard.slug}）`
    : `AI 未产出有效节点建议，已回退默认节点 ${defaultBoard.name}（${defaultBoard.slug}）`

  return reasoning
    ? `${reasoning}；${fallbackMessage}`.slice(0, 500)
    : fallbackMessage.slice(0, 500)
}

async function claimAutoCategorizeTask(taskId: string) {
  const result = await prisma.autoCategorizeTask.updateMany({
    where: {
      id: taskId,
      status: AiReplyTaskStatus.PENDING,
    },
    data: {
      status: AiReplyTaskStatus.PROCESSING,
      startedAt: new Date(),
      attemptCount: {
        increment: 1,
      },
      errorMessage: null,
    },
  })

  return result.count > 0
}

async function loadAutoCategorizeTaskForWorker(taskId: string) {
  return prisma.autoCategorizeTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      sourceType: true,
      postId: true,
      requesterUserId: true,
      title: true,
      content: true,
      appendedContent: true,
      allowBoardSuggestion: true,
      allowTagSuggestion: true,
      attemptCount: true,
      maxAttempts: true,
      post: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  })
}

async function markAutoCategorizeTaskSucceeded(taskId: string, result: AutoCategorizeSuggestionResult) {
  const payload = createTaskSuccessPayload(result)

  await prisma.autoCategorizeTask.update({
    where: { id: taskId },
    data: {
      status: AiReplyTaskStatus.SUCCEEDED,
      finishedAt: new Date(),
      errorMessage: null,
      ...payload,
    },
  })
}

async function markAutoCategorizeTaskCancelled(taskId: string, message: string) {
  await prisma.autoCategorizeTask.update({
    where: { id: taskId },
    data: {
      status: AiReplyTaskStatus.CANCELLED,
      errorMessage: message,
      finishedAt: new Date(),
    },
  })
}

async function markAutoCategorizeTaskFailed(taskId: string, message: string) {
  await prisma.autoCategorizeTask.update({
    where: { id: taskId },
    data: {
      status: AiReplyTaskStatus.FAILED,
      errorMessage: message,
      finishedAt: new Date(),
    },
  })
}

async function requeueAutoCategorizeTask(taskId: string, message: string, delayMs: number) {
  await prisma.autoCategorizeTask.update({
    where: { id: taskId },
    data: {
      status: AiReplyTaskStatus.PENDING,
      scheduledAt: new Date(Date.now() + delayMs),
      errorMessage: message,
      startedAt: null,
      finishedAt: null,
    },
  })

  await enqueueBackgroundJob(AUTO_CATEGORIZE_BACKGROUND_JOB_NAME, { taskId }, { delayMs })
}

async function syncSuggestedTagsOnPost(
  tx: Prisma.TransactionClient,
  postId: string,
  suggestedTags: AutoCategorizeSuggestedTag[],
) {
  const existingRelations = await tx.postTag.findMany({
    where: { postId },
    select: { tagId: true },
  })

  const syncedTags = await Promise.all(
    suggestedTags.map((tag) => tx.tag.upsert({
      where: { slug: tag.slug },
      update: {
        name: tag.name,
      },
      create: {
        name: tag.name,
        slug: tag.slug,
      },
    })),
  )

  await tx.postTag.deleteMany({
    where: { postId },
  })

  if (syncedTags.length > 0) {
    await tx.postTag.createMany({
      data: syncedTags.map((tag) => ({
        postId,
        tagId: tag.id,
      })),
      skipDuplicates: true,
    })
  }

  const affectedTagIds = [...new Set([
    ...existingRelations.map((relation) => relation.tagId),
    ...syncedTags.map((tag) => tag.id),
  ])]
  if (affectedTagIds.length === 0) {
    return
  }

  const counts = await Promise.all(
    affectedTagIds.map((tagId) => tx.postTag.count({
      where: { tagId },
    })),
  )

  await Promise.all(
    affectedTagIds.map((tagId, index) => tx.tag.update({
      where: { id: tagId },
      data: {
        postCount: counts[index] ?? 0,
      },
    })),
  )
}

async function applyPostCreateSuggestion(task: NonNullable<AutoCategorizeTaskWorkerRecord>, result: Extract<AutoCategorizeSuggestionResult, { status: "ok" }>) {
  if (!task.postId || !task.post) {
    throw new AutoCategorizeTaskCancelledError("源帖子已不存在，任务已取消")
  }

  const suggestedBoardId = result.data.board?.id ?? null

  await prisma.$transaction(async (tx) => {
    if (suggestedBoardId) {
      await tx.post.update({
        where: { id: task.postId! },
        data: { boardId: suggestedBoardId },
      })
    }

    if (result.data.tags.length > 0) {
      await syncSuggestedTagsOnPost(tx, task.postId!, result.data.tags)
    }

    const payload = createTaskSuccessPayload(result)
    await tx.autoCategorizeTask.update({
      where: { id: task.id },
      data: {
        status: AiReplyTaskStatus.SUCCEEDED,
        finishedAt: new Date(),
        errorMessage: null,
        ...payload,
      },
    })
  })

  logInfo({
    scope: LOG_SCOPE,
    action: "suggestion_auto_applied",
    targetId: task.postId,
  }, {
    board: result.data.board?.slug ?? null,
    tagCount: result.data.tags.length,
    taskId: task.id,
  })
}

async function processAutoCategorizeTask(taskId: string) {
  const claimed = await claimAutoCategorizeTask(taskId)
  if (!claimed) {
    return
  }

  const task = await loadAutoCategorizeTaskForWorker(taskId)
  if (!task) {
    return
  }

  try {
    if (task.sourceType === AutoCategorizeTaskSourceType.POST_CREATE && (!task.postId || !task.post)) {
      throw new AutoCategorizeTaskCancelledError("源帖子已不存在，任务已取消")
    }

    const content = task.sourceType === AutoCategorizeTaskSourceType.POST_CREATE
      ? getAiSafePostContentText(task.content)
      : task.content
    const appendedContent = task.sourceType === AutoCategorizeTaskSourceType.POST_CREATE && task.appendedContent
      ? getAiSafePostContentText(task.appendedContent)
      : task.appendedContent
    const result = await resolveAutoCategorizeSuggestion({
      title: task.title,
      content,
      appendedContent,
      allowBoardSuggestion: task.allowBoardSuggestion,
      allowTagSuggestion: task.allowTagSuggestion,
    })

    if (task.sourceType === AutoCategorizeTaskSourceType.POST_CREATE && result.status === "ok") {
      await applyPostCreateSuggestion(task, result)
    } else {
      await markAutoCategorizeTaskSucceeded(task.id, result)
    }

    logInfo({
      scope: LOG_SCOPE,
      action: "task-succeeded",
      userId: task.requesterUserId,
      targetId: task.id,
    }, {
      sourceType: task.sourceType,
      postId: task.postId,
      resultStatus: result.status,
    })
  } catch (error) {
    if (error instanceof AutoCategorizeTaskCancelledError) {
      await markAutoCategorizeTaskCancelled(task.id, error.message)
      logInfo({
        scope: LOG_SCOPE,
        action: "task-cancelled",
        userId: task.requesterUserId,
        targetId: task.id,
      }, {
        sourceType: task.sourceType,
        postId: task.postId,
        reason: error.message,
      })
      return
    }

    logError({
      scope: LOG_SCOPE,
      action: "task-failed",
      userId: task.requesterUserId,
      targetId: task.id,
      metadata: {
        sourceType: task.sourceType,
        postId: task.postId,
        attemptCount: task.attemptCount,
        maxAttempts: task.maxAttempts,
      },
    }, error)

    const message = error instanceof Error ? error.message : String(error)
    if (error instanceof AiRateLimitError) {
      await markAutoCategorizeTaskFailed(task.id, `[RATE_LIMIT] ${message}`)
      return
    }

    if (task.attemptCount < task.maxAttempts) {
      await requeueAutoCategorizeTask(task.id, message, getAutoCategorizeRetryDelayMs(task.attemptCount))
      return
    }

    await markAutoCategorizeTaskFailed(task.id, message)
  }
}

registerBackgroundJobHandler(AUTO_CATEGORIZE_BACKGROUND_JOB_NAME, async (payload) => {
  await processAutoCategorizeTask(payload.taskId)
})

async function upsertAutoCategorizeTask(params: {
  sourceType: AutoCategorizeTaskSourceType
  sourceKey: string
  postId?: string | null
  requesterUserId: number
  title: string
  content: string
  appendedContent?: string | null
  allowBoardSuggestion: boolean
  allowTagSuggestion: boolean
}) {
  const normalizedTitle = normalizeTaskText(params.title, MAX_TITLE_CHARS)
  const normalizedContent = normalizeTaskText(params.content, MAX_CONTENT_CHARS)
  const normalizedAppendedContent = params.appendedContent
    ? normalizeTaskText(params.appendedContent, MAX_CONTENT_CHARS)
    : null

  return prisma.$transaction(async (tx) => {
    const now = new Date()
    const existing = await tx.autoCategorizeTask.findUnique({
      where: { sourceKey: params.sourceKey },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    })

    let taskId: string
    let shouldEnqueue = false

    if (
      existing
      && (
        existing.status === AiReplyTaskStatus.PENDING
        || existing.status === AiReplyTaskStatus.PROCESSING
        || isCompletedTaskReusable({
          sourceType: params.sourceType,
          status: existing.status,
          updatedAt: existing.updatedAt,
        })
      )
    ) {
      taskId = existing.id
    } else if (existing) {
      const resetTaskData = {
        postId: params.postId ?? null,
        status: AiReplyTaskStatus.PENDING,
        requesterUserId: params.requesterUserId,
        title: normalizedTitle,
        content: normalizedContent,
        appendedContent: normalizedAppendedContent,
        allowBoardSuggestion: params.allowBoardSuggestion,
        allowTagSuggestion: params.allowTagSuggestion,
        scheduledAt: now,
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
        resultStatus: null,
        resultBoardId: null,
        resultTagIds: [],
        resultTagsJson: Prisma.DbNull,
        resultReasoning: null,
        resultModelKey: null,
        resultRawPreview: null,
      } satisfies Prisma.AutoCategorizeTaskUncheckedUpdateInput
      const updated = await tx.autoCategorizeTask.update({
        where: { id: existing.id },
        data: resetTaskData,
        select: { id: true },
      })
      taskId = updated.id
      shouldEnqueue = true
    } else {
      const created = await tx.autoCategorizeTask.create({
        data: {
          sourceType: params.sourceType,
          sourceKey: params.sourceKey,
          postId: params.postId ?? null,
          requesterUserId: params.requesterUserId,
          title: normalizedTitle,
          content: normalizedContent,
          appendedContent: normalizedAppendedContent,
          allowBoardSuggestion: params.allowBoardSuggestion,
          allowTagSuggestion: params.allowTagSuggestion,
        },
        select: { id: true },
      })
      taskId = created.id
      shouldEnqueue = true
    }

    if (params.sourceType === AutoCategorizeTaskSourceType.PREVIEW) {
      await tx.autoCategorizeTask.updateMany({
        where: {
          requesterUserId: params.requesterUserId,
          sourceType: AutoCategorizeTaskSourceType.PREVIEW,
          status: AiReplyTaskStatus.PENDING,
          id: { not: taskId },
        },
        data: {
          status: AiReplyTaskStatus.CANCELLED,
          errorMessage: "已被更新的发帖辅助请求替代",
          finishedAt: now,
        },
      })
    }

    return { taskId, shouldEnqueue }
  })
}

function mapTaskStatusToPollStatus(status: string): "queued" | "processing" {
  return status === AiReplyTaskStatus.PROCESSING ? "processing" : "queued"
}

async function buildTaskPollResult(task: {
  id: string
  status: AiReplyTaskStatus
  allowBoardSuggestion: boolean
  errorMessage: string | null
  resultStatus: string | null
  resultReasoning: string | null
  resultRawPreview: string | null
  resultTagIds: string[]
  resultTagsJson: unknown
  resultBoard: {
    slug: string
    name: string
  } | null
}) {
  if (task.status === AiReplyTaskStatus.PENDING || task.status === AiReplyTaskStatus.PROCESSING) {
    return {
      taskId: task.id,
      status: mapTaskStatusToPollStatus(task.status),
      board: null,
      tags: [],
      reasoning: null,
    } satisfies AutoCategorizeTaskPollResult
  }

  if (task.status === AiReplyTaskStatus.CANCELLED) {
    throw new AutoCategorizeTaskCancelledError(task.errorMessage ?? "发帖辅助任务已取消")
  }

  if (task.status === AiReplyTaskStatus.FAILED) {
    throw new Error(task.errorMessage ?? "发帖辅助任务执行失败")
  }

  const tags = parseSuggestedTagsJson(task.resultTagsJson)
  const fallbackTags = tags.length === 0
    ? (await loadTagsByIds(task.resultTagIds)).map((tag) => ({
      slug: tag.slug,
      name: tag.name,
      isNew: false,
      id: tag.id,
    }))
    : tags
  const canUseDefaultBoardFallback =
    task.allowBoardSuggestion
    && !task.resultBoard
    && (task.resultStatus === "empty_suggestion" || task.resultStatus === "invalid_json")

  if (canUseDefaultBoardFallback) {
    const autoCfg = await getAutoCategorizeConfig()
    const defaultBoard = await loadAutoCategorizeDefaultBoardCandidate(autoCfg.defaultBoardSlug)

    if (defaultBoard) {
      return {
        taskId: task.id,
        status: "ok",
        board: {
          slug: defaultBoard.slug,
          name: defaultBoard.name,
        },
        tags: fallbackTags.map((tag) => ({
          slug: tag.slug,
          name: tag.name,
        })),
        reasoning: buildDefaultBoardFallbackReasoning(
          defaultBoard,
          task.resultReasoning ?? undefined,
          task.resultStatus === "invalid_json",
        ),
      } satisfies AutoCategorizeTaskPollResult
    }
  }

  return {
    taskId: task.id,
    status: (task.resultStatus ?? "empty_suggestion") as AutoCategorizeTaskPollResult["status"],
    board: task.resultBoard
      ? {
          slug: task.resultBoard.slug,
          name: task.resultBoard.name,
        }
      : null,
    tags: fallbackTags.map((tag) => ({
      slug: tag.slug,
      name: tag.name,
    })),
    reasoning: task.resultReasoning,
    ...(task.resultRawPreview ? { rawPreview: task.resultRawPreview } : {}),
  } satisfies AutoCategorizeTaskPollResult
}

export async function getAutoCategorizeTaskResultForUser(params: {
  taskId: string
  requesterUserId: number
}) {
  const task = await prisma.autoCategorizeTask.findFirst({
    where: {
      id: params.taskId,
      requesterUserId: params.requesterUserId,
    },
    select: autoCategorizeTaskPollSelect,
  })

  if (!task) {
    return null
  }

  return buildTaskPollResult(task)
}

export async function enqueueAutoCategorizePreviewTask(params: {
  requesterUserId: number
  title: string
  content: string
  allowBoardSuggestion: boolean
  allowTagSuggestion: boolean
}) {
  const normalizedTitle = normalizeTaskText(params.title, MAX_TITLE_CHARS)
  const normalizedContent = normalizeTaskText(params.content, MAX_CONTENT_CHARS)
  const autoCfg = await getAutoCategorizeConfig()
  const configCacheKey = JSON.stringify([
    autoCfg.defaultBoardSlug,
    autoCfg.promptTemplate,
    autoCfg.boardWhitelistSlugs,
    autoCfg.maxTagCount,
  ])
  const sourceKey = buildPreviewSourceKey({
    ...params,
    title: normalizedTitle,
    content: normalizedContent,
    configCacheKey,
  })
  const task = await upsertAutoCategorizeTask({
    sourceType: AutoCategorizeTaskSourceType.PREVIEW,
    sourceKey,
    requesterUserId: params.requesterUserId,
    title: normalizedTitle,
    content: normalizedContent,
    allowBoardSuggestion: params.allowBoardSuggestion,
    allowTagSuggestion: params.allowTagSuggestion,
  })

  if (task.shouldEnqueue) {
    await enqueueBackgroundJob(AUTO_CATEGORIZE_BACKGROUND_JOB_NAME, { taskId: task.taskId })
  }

  return task.taskId
}

export async function resolveAutoCategorizeSuggestion(params: {
  title: string
  content: string
  appendedContent?: string | null
  allowBoardSuggestion?: boolean
  allowTagSuggestion?: boolean
}): Promise<AutoCategorizeSuggestionResult> {
  const allowBoardSuggestion = params.allowBoardSuggestion !== false
  const allowTagSuggestion = params.allowTagSuggestion !== false
  if (!allowBoardSuggestion && !allowTagSuggestion) {
    return { status: "no_requested_capabilities" }
  }

  const [autoCfg, aiCfg] = await Promise.all([
    getAutoCategorizeConfig(),
    getServerAiReplyConfig(),
  ])

  const apiKey = (aiCfg.apiKey ?? "").trim()
  const baseUrl = aiCfg.baseUrl.trim()
  const model = aiCfg.model.trim()
  if (!apiKey || !baseUrl || !model) {
    return { status: "provider_not_configured" }
  }

  const [boards, tags, defaultBoard] = await Promise.all([
    allowBoardSuggestion ? loadAutoCategorizeBoardCandidates(autoCfg.boardWhitelistSlugs) : Promise.resolve([]),
    allowTagSuggestion ? loadAutoCategorizeTagCandidates() : Promise.resolve([]),
    allowBoardSuggestion ? loadAutoCategorizeDefaultBoardCandidate(autoCfg.defaultBoardSlug) : Promise.resolve(null),
  ])

  const promptAllowsBoardSuggestion = allowBoardSuggestion && boards.length > 0
  if (allowBoardSuggestion && boards.length === 0 && !defaultBoard) {
    return { status: "no_candidate_boards" }
  }
  if (!promptAllowsBoardSuggestion && !allowTagSuggestion && defaultBoard) {
    return {
      status: "ok",
      data: {
        board: defaultBoard,
        tags: [],
        reasoning: buildDefaultBoardFallbackReasoning(defaultBoard),
        model,
      },
    }
  }

  const fullContent = [params.content, params.appendedContent].filter(Boolean).join("\n\n")
  const truncatedContent = fullContent.slice(0, MAX_CONTENT_CHARS)
  const providerConfig: AiProviderConfig = {
    kind: "openai-compatible",
    baseUrl,
    apiKey,
  }
  const provider = resolveAiProvider(providerConfig)
  const result = await runAiTask({
    kind: "auto-categorize",
    appKey: "app.ai-reply",
    provider,
    messages: [
      { role: "system", content: autoCfg.promptTemplate },
      {
        role: "user",
        content: buildSuggestionPrompt({
          title: params.title,
          content: truncatedContent,
          allowBoardSuggestion: promptAllowsBoardSuggestion,
          allowTagSuggestion,
          boards,
          tags,
          maxTagCount: autoCfg.maxTagCount,
        }),
      },
    ],
    options: {
      model,
      temperature: aiCfg.temperature,
      maxTokens: MAX_TOKENS,
      timeoutMs: aiCfg.timeoutMs,
    },
  })

  const payload = parseSuggestion(result.text)
  if (!payload) {
    return {
      status: "invalid_json",
      rawPreview: result.text.slice(0, 200),
    }
  }

  const boardBySlug = new Map(boards.map((board) => [board.slug, board]))
  const aiSuggestedBoard = promptAllowsBoardSuggestion && payload.boardSlug
    ? boardBySlug.get(payload.boardSlug) ?? null
    : null
  const suggestedBoard = !aiSuggestedBoard && allowBoardSuggestion && defaultBoard
    ? defaultBoard
    : aiSuggestedBoard
  const reasoning = defaultBoard && suggestedBoard?.id === defaultBoard.id
    ? buildDefaultBoardFallbackReasoning(
        defaultBoard,
        payload.reasoning,
        Boolean(payload.boardSlug) || payload.tags.length > 0,
      )
    : payload.reasoning

  const suggestedTags = allowTagSuggestion
    ? resolveSuggestedTagsFromPayload({
      payloadTags: payload.tags,
      candidateTags: tags,
      maxTagCount: autoCfg.maxTagCount,
    })
    : []

  if (!suggestedBoard && suggestedTags.length === 0) {
    return { status: "empty_suggestion" }
  }

  return {
    status: "ok",
    data: {
      board: suggestedBoard,
      tags: suggestedTags,
      reasoning,
      model,
    },
  }
}

export async function runAutoCategorize({ postId }: { postId: string }): Promise<void> {
  try {
    const autoCfg = await getAutoCategorizeConfig()
    if (!autoCfg.enabled) {
      return
    }
    if (!autoCfg.writeBoardAutoSelectEnabled && !autoCfg.writeTagAutoExtractEnabled) {
      logInfo({ scope: LOG_SCOPE, action: "skip_no_requested_capabilities", targetId: postId })
      return
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        title: true,
        content: true,
        appendedContent: true,
      },
    })
    if (!post) {
      logInfo({ scope: LOG_SCOPE, action: "skip_post_missing", targetId: postId })
      return
    }

    const task = await upsertAutoCategorizeTask({
      sourceType: AutoCategorizeTaskSourceType.POST_CREATE,
      sourceKey: buildPostCreateSourceKey(postId),
      postId: post.id,
      requesterUserId: post.authorId,
      title: post.title,
      content: getAiSafePostContentText(post.content),
      appendedContent: post.appendedContent ? getAiSafePostContentText(post.appendedContent) : null,
      allowBoardSuggestion: autoCfg.writeBoardAutoSelectEnabled,
      allowTagSuggestion: autoCfg.writeTagAutoExtractEnabled,
    })

    if (task.shouldEnqueue) {
      await enqueueBackgroundJob(AUTO_CATEGORIZE_BACKGROUND_JOB_NAME, { taskId: task.taskId })
    }

    logInfo({
      scope: LOG_SCOPE,
      action: "task-enqueued",
      targetId: postId,
    }, {
      taskId: task.taskId,
      sourceType: AutoCategorizeTaskSourceType.POST_CREATE,
    })
  } catch (err) {
    if (err instanceof AiProviderError) {
      logError({ scope: LOG_SCOPE, action: "provider_error", targetId: postId }, err, { kind: err.kind })
      return
    }

    logError({ scope: LOG_SCOPE, action: "enqueue_failed", targetId: postId }, err)
  }
}
