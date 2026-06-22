"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import type { LocalPostDraft } from "@/lib/post-draft"
import { normalizeManualTags } from "@/lib/post-tags"

type BoardSelectionMode = "auto" | "manual"
type AiCategorizeStatus =
  | "idle"
  | "ok"
  | "disabled"
  | "empty_input"
  | "provider_not_configured"
  | "no_requested_capabilities"
  | "no_candidate_boards"
  | "invalid_json"
  | "empty_suggestion"

type AiCategorizeApiStatus = Exclude<AiCategorizeStatus, "idle"> | "queued" | "processing"

interface AiCategorizeBoardLite {
  slug: string
  name: string
}

interface AiCategorizeTagLite {
  slug: string
  name: string
}

interface AiCategorizeResponseData {
  status: Exclude<AiCategorizeStatus, "idle">
  board: AiCategorizeBoardLite | null
  tags: AiCategorizeTagLite[]
  reasoning: string | null
  rawPreview?: string
}

interface AiCategorizeTaskResponseData {
  taskId?: string
  status: AiCategorizeApiStatus
  board: AiCategorizeBoardLite | null
  tags: AiCategorizeTagLite[]
  reasoning: string | null
  rawPreview?: string
}

function isFinalAiCategorizeResponse(data: AiCategorizeTaskResponseData): data is AiCategorizeResponseData {
  return data.status !== "queued" && data.status !== "processing"
}

interface UseCreatePostAiAssistOptions {
  draft: LocalPostDraft
  mode: "create" | "edit"
  boardAutoSelectEnabled: boolean
  tagAutoExtractEnabled: boolean
  preferredBoardLocked: boolean
  localAutoExtractedTagPool: string[]
  updateDraftField: <Key extends keyof LocalPostDraft>(
    field: Key,
    value: LocalPostDraft[Key],
  ) => void
}

function normalizePreviewText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength)
}

const AI_CATEGORIZE_POLL_INTERVAL_MS = 1_200
const AI_CATEGORIZE_POLL_TIMEOUT_MS = 20_000

function buildSuggestionRequestKey(params: {
  title: string
  content: string
  needBoard: boolean
  needTags: boolean
}) {
  return JSON.stringify([
    params.needBoard ? "board" : "no-board",
    params.needTags ? "tags" : "no-tags",
    params.title.trim(),
    params.content.trim(),
  ])
}

function resolveBoardSelectionError(status: Exclude<AiCategorizeStatus, "idle" | "ok">) {
  if (status === "empty_input") {
    return "请先补充标题或正文，或切换为手动选择节点。"
  }

  if (status === "disabled" || status === "no_requested_capabilities") {
    return "后台未开启 AI 自动选节点，请切换为手动选择。"
  }

  if (status === "provider_not_configured") {
    return "AI 助手未完成模型配置，请切换为手动选择节点。"
  }

  if (status === "no_candidate_boards") {
    return "当前没有可供 AI 判断的节点候选，请切换为手动选择。"
  }

  if (status === "invalid_json") {
    return "AI 返回结果不可用，请稍后重试或切换为手动选择。"
  }

  return "AI 暂未选出合适节点，请补充标题/正文或切换为手动选择。"
}

export function resolveAiSuggestionNeeds(params: {
  canUseAutoBoardSelection: boolean
  canUseAiTagExtraction: boolean
  boardSelectionMode: BoardSelectionMode
}) {
  const needBoard =
    params.canUseAutoBoardSelection && params.boardSelectionMode === "auto"
  const manualBoardSelectionEnabled =
    params.canUseAutoBoardSelection && params.boardSelectionMode === "manual"

  return {
    needBoard,
    // Once the user explicitly falls back to manual board selection, skip the
    // AI route entirely so posting still works even if the provider keeps failing.
    needTags: params.canUseAiTagExtraction && !manualBoardSelectionEnabled,
  }
}

function mergeSuggestedTagsIntoDraft(draft: LocalPostDraft, tags: AiCategorizeTagLite[]) {
  if (tags.length === 0) {
    return draft
  }

  const mergedTags = normalizeManualTags([
    ...draft.manualTags,
    ...tags.map((tag) => tag.name),
  ])

  return mergedTags.join("\u0000") === draft.manualTags.join("\u0000")
    ? draft
    : { ...draft, manualTags: mergedTags }
}

export function useCreatePostAiAssist({
  draft,
  mode,
  boardAutoSelectEnabled,
  tagAutoExtractEnabled,
  preferredBoardLocked,
  localAutoExtractedTagPool,
  updateDraftField,
}: UseCreatePostAiAssistOptions) {
  const canUseAutoBoardSelection =
    mode === "create" && boardAutoSelectEnabled && !preferredBoardLocked
  const canUseAiTagExtraction = mode === "create" && tagAutoExtractEnabled
  const [boardSelectionMode, setBoardSelectionMode] = useState<BoardSelectionMode>(
    canUseAutoBoardSelection ? "auto" : "manual",
  )
  const [aiSuggestedBoard, setAiSuggestedBoard] = useState<AiCategorizeBoardLite | null>(null)
  const [aiSuggestedTags, setAiSuggestedTags] = useState<string[]>([])
  const [aiSuggestionPending, setAiSuggestionPending] = useState(false)
  const [aiSuggestionError, setAiSuggestionError] = useState("")
  const [aiSuggestionStatus, setAiSuggestionStatus] = useState<AiCategorizeStatus>("idle")
  const lastResolvedRequestKeyRef = useRef("")
  const activeAbortControllerRef = useRef<AbortController | null>(null)

  async function pollTaskResult({
    taskId,
    signal,
  }: {
    taskId: string
    signal?: AbortSignal
  }) {
    const response = await fetch(`/api/posts/ai-categorize?taskId=${encodeURIComponent(taskId)}`, {
      method: "GET",
      signal,
      cache: "no-store",
    })
    const result = (await response.json().catch(() => null)) as {
      code?: number
      message?: string
      data?: AiCategorizeTaskResponseData
    } | null

    if (!response.ok || result?.code !== 0 || !result.data) {
      throw new Error(result?.message ?? "AI 建议生成失败")
    }

    return result.data
  }

  async function requestSuggestionPreview({
    title,
    content,
    needBoard,
    needTags,
    signal,
  }: {
    title: string
    content: string
    needBoard: boolean
    needTags: boolean
    signal?: AbortSignal
  }): Promise<AiCategorizeResponseData> {
    const response = await fetch("/api/posts/ai-categorize", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        content,
        needBoard,
        needTags,
      }),
    })
    const result = (await response.json().catch(() => null)) as {
      code?: number
      message?: string
      data?: AiCategorizeTaskResponseData
    } | null

    if (!response.ok || result?.code !== 0 || !result.data) {
      throw new Error(result?.message ?? "AI 建议生成失败")
    }

    let data = result.data
    if (isFinalAiCategorizeResponse(data)) {
      return data
    }

    if (!data.taskId) {
      throw new Error("AI 发帖辅助任务创建失败")
    }
    const taskId = data.taskId

    const startedAt = Date.now()
    while (Date.now() - startedAt < AI_CATEGORIZE_POLL_TIMEOUT_MS) {
      if (signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError")
      }

      await new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException("The operation was aborted.", "AbortError"))
          return
        }

        let settled = false
        const onAbort = () => {
          if (settled) {
            return
          }
          settled = true
          window.clearTimeout(timer)
          signal?.removeEventListener("abort", onAbort)
          reject(new DOMException("The operation was aborted.", "AbortError"))
        }

        const timer = window.setTimeout(() => {
          if (settled) {
            return
          }
          settled = true
          signal?.removeEventListener("abort", onAbort)
          resolve()
        }, AI_CATEGORIZE_POLL_INTERVAL_MS)

        signal?.addEventListener("abort", onAbort, { once: true })
      })

      data = await pollTaskResult({
        taskId,
        signal,
      })
      if (isFinalAiCategorizeResponse(data)) {
        return data
      }
    }

    throw new Error("AI 建议生成超时，请稍后重试")
  }

  useEffect(() => {
    if (!canUseAutoBoardSelection && boardSelectionMode !== "manual") {
      setBoardSelectionMode("manual")
    }
  }, [boardSelectionMode, canUseAutoBoardSelection])

  useEffect(() => {
    if (!canUseAutoBoardSelection || boardSelectionMode !== "auto" || !aiSuggestedBoard?.slug) {
      return
    }

    if (draft.boardSlug === aiSuggestedBoard.slug) {
      return
    }

    const timer = window.setTimeout(() => {
      updateDraftField("boardSlug", aiSuggestedBoard.slug)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [
    aiSuggestedBoard?.slug,
    boardSelectionMode,
    canUseAutoBoardSelection,
    draft.boardSlug,
    updateDraftField,
  ])

  useEffect(() => {
    const { needBoard, needTags } = resolveAiSuggestionNeeds({
      canUseAutoBoardSelection,
      canUseAiTagExtraction,
      boardSelectionMode,
    })

    activeAbortControllerRef.current?.abort()
    activeAbortControllerRef.current = null
    setAiSuggestionPending(false)
    if (!needBoard && !needTags) {
      setAiSuggestionStatus("idle")
      setAiSuggestionError("")
      setAiSuggestedBoard(null)
      setAiSuggestedTags([])
      lastResolvedRequestKeyRef.current = ""
      return
    }

    const requestKey = buildSuggestionRequestKey({
      title: normalizePreviewText(draft.title, 200),
      content: normalizePreviewText(draft.content, 20_000),
      needBoard,
      needTags,
    })

    if (lastResolvedRequestKeyRef.current !== requestKey) {
      setAiSuggestionStatus("idle")
      setAiSuggestionError("")
      setAiSuggestedBoard(null)
      setAiSuggestedTags([])
    }
  }, [
    boardSelectionMode,
    canUseAiTagExtraction,
    canUseAutoBoardSelection,
    draft.content,
    draft.title,
  ])

  async function resolveDraftBeforeSubmit(currentDraft: LocalPostDraft) {
    const { needBoard, needTags } = resolveAiSuggestionNeeds({
      canUseAutoBoardSelection,
      canUseAiTagExtraction,
      boardSelectionMode,
    })
    if (!needBoard && !needTags) {
      return currentDraft
    }

    const normalizedTitle = normalizePreviewText(currentDraft.title, 200)
    const normalizedContent = normalizePreviewText(currentDraft.content, 20_000)
    if (!normalizedTitle && !normalizedContent) {
      if (needBoard) {
        throw new Error("请先补充标题或正文，或切换为手动选择节点。")
      }
      return currentDraft
    }

    const requestKey = buildSuggestionRequestKey({
      title: normalizedTitle,
      content: normalizedContent,
      needBoard,
      needTags,
    })

    activeAbortControllerRef.current?.abort()
    activeAbortControllerRef.current = null
    setAiSuggestionPending(true)
    setAiSuggestionError("")

    try {
      const data = await requestSuggestionPreview({
        title: normalizedTitle,
        content: normalizedContent,
        needBoard,
        needTags,
      })

      lastResolvedRequestKeyRef.current = requestKey
      setAiSuggestionStatus(data.status)
      setAiSuggestedBoard(data.board)
      setAiSuggestedTags(data.tags.map((tag) => tag.name))

      let nextDraft = mergeSuggestedTagsIntoDraft(currentDraft, data.status === "ok" ? data.tags : [])

      if (needBoard && data.status === "ok" && data.board?.slug) {
        if (currentDraft.boardSlug !== data.board.slug) {
          updateDraftField("boardSlug", data.board.slug)
          nextDraft = { ...nextDraft, boardSlug: data.board.slug }
        }
      } else if (needBoard && data.status === "ok") {
        throw new Error("AI 暂未选出合适节点，请补充标题/正文或切换为手动选择。")
      }

      if (needBoard && data.status !== "ok") {
        throw new Error(resolveBoardSelectionError(data.status))
      }

      return nextDraft
    } catch (error) {
      setAiSuggestionStatus("idle")
      setAiSuggestedBoard(null)
      setAiSuggestedTags([])
      setAiSuggestionError(error instanceof Error ? error.message : "AI 建议生成失败")
      throw error
    } finally {
      setAiSuggestionPending(false)
    }
  }

  const resolvedAutoExtractedTagPool = useMemo(
    () =>
      canUseAiTagExtraction && aiSuggestedTags.length > 0
        ? aiSuggestedTags
        : localAutoExtractedTagPool,
    [aiSuggestedTags, canUseAiTagExtraction, localAutoExtractedTagPool],
  )

  return {
    canUseAutoBoardSelection,
    canUseAiTagExtraction,
    boardSelectionMode,
    setBoardSelectionMode,
    aiSuggestedBoard,
    aiSuggestionPending,
    aiSuggestionError,
    aiSuggestionStatus,
    resolvedAutoExtractedTagPool,
    resolveDraftBeforeSubmit,
  }
}
