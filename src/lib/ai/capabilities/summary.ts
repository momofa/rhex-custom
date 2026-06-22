import "server-only"

import { createHash } from "node:crypto"

import { prisma } from "@/db/client"
import { logError, logInfo } from "@/lib/logger"
import {
  AiProviderError,
  resolveAiProvider,
  type AiProviderConfig,
} from "@/lib/ai/provider"
import { runAiTask } from "@/lib/ai/service"
import { getServerAiReplyConfig } from "@/lib/ai-reply-config"
import { getSummaryConfig } from "@/lib/ai/capabilities/summary-config"
import { getAiSafePostContentText } from "@/lib/post-content"

const LOG_SCOPE = "ai.capabilities.summary"

export type SummarySourceKind = "post" | "comment"

export interface GetOrCreateSummaryInput {
  sourceKind: SummarySourceKind
  sourceId: string
  /** 原始内容（未截断），内部会做 normalize 后 sha256 + 截断给模型 */
  content: string
  /** 可选覆盖 modelKey；不传则按 summaryCfg.modelKey || aiCfg.model */
  modelKey?: string
}

export interface SummaryResult {
  text: string
  fromCache: boolean
  /** 命中缓存时的原始 cache id */
  cacheId?: string
}

export class SummaryDisabledError extends Error {
  constructor() {
    super("summary_disabled")
    this.name = "SummaryDisabledError"
  }
}

export class SummaryProviderNotConfiguredError extends Error {
  constructor() {
    super("summary_provider_not_configured")
    this.name = "SummaryProviderNotConfiguredError"
  }
}

function normalizeForHash(input: string): string {
  // 统一换行、折叠连续空白，避免无关空白导致缓存击穿
  return input.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex")
}

function isFresh(createdAt: Date, ttlDays: number, now: Date): boolean {
  if (ttlDays <= 0) return true
  const ageMs = now.getTime() - createdAt.getTime()
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000
  return ageMs < ttlMs
}

export async function getOrCreateSummary(
  input: GetOrCreateSummaryInput,
): Promise<SummaryResult> {
  const summaryCfg = await getSummaryConfig()
  if (!summaryCfg.enabled) {
    throw new SummaryDisabledError()
  }

  const aiCfg = await getServerAiReplyConfig()
  const apiKey = (aiCfg.apiKey ?? "").trim()
  const baseUrl = aiCfg.baseUrl.trim()
  const baseModel = aiCfg.model.trim()
  if (!apiKey || !baseUrl || !baseModel) {
    throw new SummaryProviderNotConfiguredError()
  }

  const modelKey = (input.modelKey?.trim() || summaryCfg.modelKey.trim() || baseModel).slice(0, 200)

  const normalized = normalizeForHash(input.content ?? "")
  const contentHash = sha256Hex(normalized)
  const now = new Date()

  const existing = await prisma.aiSummaryCache.findFirst({
    where: {
      sourceKind: input.sourceKind,
      sourceId: input.sourceId,
      modelKey,
      contentHash,
    },
    select: { id: true, summary: true, createdAt: true },
  })

  if (existing && isFresh(existing.createdAt, summaryCfg.cacheTtlDays, now)) {
    await prisma.aiSummaryCache.update({
      where: { id: existing.id },
      data: { hitCount: { increment: 1 }, lastHitAt: now },
    })
    return { text: existing.summary, fromCache: true, cacheId: existing.id }
  }

  // miss or stale → regenerate
  const truncated = normalized.slice(0, summaryCfg.maxInputChars)

  const providerConfig: AiProviderConfig = {
    kind: "openai-compatible",
    baseUrl,
    apiKey,
  }
  const provider = resolveAiProvider(providerConfig)

  let result: { text: string }
  try {
    result = await runAiTask({
      kind: "summary",
      appKey: "app.ai-reply",
      provider,
      messages: [
        { role: "system", content: summaryCfg.systemPrompt },
        { role: "user", content: truncated || "（无正文）" },
      ],
      options: {
        model: modelKey,
        temperature: aiCfg.temperature,
        maxTokens: summaryCfg.maxOutputTokens,
        timeoutMs: aiCfg.timeoutMs,
      },
    })
  } catch (err) {
    if (err instanceof AiProviderError) {
      logError(
        { scope: LOG_SCOPE, action: "provider_error", targetId: input.sourceId },
        err,
        { kind: err.kind, sourceKind: input.sourceKind },
      )
    } else {
      logError(
        { scope: LOG_SCOPE, action: "provider_call_failed", targetId: input.sourceId },
        err,
        { sourceKind: input.sourceKind },
      )
    }
    throw err
  }

  const text = result.text.trim()

  // 过期命中复用旧 id 做更新；否则 create
  if (existing) {
    const updated = await prisma.aiSummaryCache.update({
      where: { id: existing.id },
      data: {
        summary: text,
        createdAt: now,
        lastHitAt: now,
        hitCount: 1,
      },
      select: { id: true },
    })
    logInfo(
      { scope: LOG_SCOPE, action: "regenerated", targetId: input.sourceId },
      { sourceKind: input.sourceKind, modelKey },
    )
    return { text, fromCache: false, cacheId: updated.id }
  }

  const created = await prisma.aiSummaryCache.create({
    data: {
      sourceKind: input.sourceKind,
      sourceId: input.sourceId,
      modelKey,
      contentHash,
      summary: text,
      hitCount: 1,
      lastHitAt: now,
    },
    select: { id: true },
  })
  logInfo(
    { scope: LOG_SCOPE, action: "created", targetId: input.sourceId },
    { sourceKind: input.sourceKind, modelKey },
  )
  return { text, fromCache: false, cacheId: created.id }
}

export async function summarizePostById(postId: string): Promise<SummaryResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, title: true, content: true, appendedContent: true },
  })
  if (!post) throw new Error(`post_not_found:${postId}`)
  const body = [
    post.title,
    getAiSafePostContentText(post.content),
    post.appendedContent ? getAiSafePostContentText(post.appendedContent) : "",
  ].filter(Boolean).join("\n\n")
  return getOrCreateSummary({ sourceKind: "post", sourceId: postId, content: body })
}

export async function summarizeCommentById(commentId: string): Promise<SummaryResult> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, content: true },
  })
  if (!comment) throw new Error(`comment_not_found:${commentId}`)
  return getOrCreateSummary({
    sourceKind: "comment",
    sourceId: commentId,
    content: comment.content,
  })
}
