import "server-only"

import type {
  AiChatMessage,
  AiChatOptions,
  AiChatResult,
  AiChatUsage,
  AiProvider,
  AiProviderConfig,
  AiStreamChunk,
} from "./types"
import { AiProviderError } from "./types"

/**
 * OpenAI 兼容 Provider。实现参考自 src/lib/ai-reply.ts：
 *   - extractCompletionText            (L188-L238)
 *   - extractCompletionTextFromSse     (L240-L270)
 *   - callAiReplyModel (fetch + abort) (L336-L411)
 * 但此处独立实现，不 import ai-reply.ts 的内部符号，且不做 sanitizer/normalize，
 * 仅返回 provider 原始文本，由外层（service / 调用方）处理清洗。
 */

interface ChoiceLike {
  finish_reason?: unknown
  message?: { content?: unknown } | null
  delta?: { content?: unknown } | null
}

interface ChatCompletionPayload {
  choices?: ChoiceLike[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

function mapUsage(raw: ChatCompletionPayload["usage"]): AiChatUsage | undefined {
  if (!raw) return undefined
  const usage: AiChatUsage = {}
  if (typeof raw.prompt_tokens === "number") usage.promptTokens = raw.prompt_tokens
  if (typeof raw.completion_tokens === "number") usage.completionTokens = raw.completion_tokens
  if (typeof raw.total_tokens === "number") usage.totalTokens = raw.total_tokens
  return Object.keys(usage).length > 0 ? usage : undefined
}

function extractMessageContent(choice: ChoiceLike | undefined): string {
  if (!choice) return ""
  const msg = choice.message
  const content = msg?.content
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item
        if (item && typeof item === "object" && "text" in (item as Record<string, unknown>)) {
          const t = (item as { text?: unknown }).text
          return typeof t === "string" ? t : ""
        }
        return ""
      })
      .join("")
  }
  return ""
}

function extractDeltaContent(choice: ChoiceLike | undefined): string {
  if (!choice) return ""
  const delta = choice.delta
  const content = delta?.content
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item
        if (item && typeof item === "object" && "text" in (item as Record<string, unknown>)) {
          const t = (item as { text?: unknown }).text
          return typeof t === "string" ? t : ""
        }
        return ""
      })
      .join("")
  }
  return ""
}

function toFinishReason(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function mapHttpErrorKind(status: number) {
  if (status === 401 || status === 403) return "auth" as const
  if (status === 429) return "rate_limit" as const
  return "bad_response" as const
}

function buildHeaders(config: AiProviderConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
    ...(config.extraHeaders ?? {}),
  }
}

function buildBody(
  messages: AiChatMessage[],
  opts: AiChatOptions,
  stream: boolean,
  config: AiProviderConfig,
): string {
  const model = opts.model || config.defaultModel
  if (!model) {
    throw new AiProviderError("model is required", "bad_response")
  }
  const body: Record<string, unknown> = {
    model,
    stream,
    messages,
    ...(opts.extra ?? {}),
  }
  if (typeof opts.temperature === "number") body.temperature = opts.temperature
  if (typeof opts.maxTokens === "number") body.max_tokens = opts.maxTokens
  return JSON.stringify(body)
}

function resolveTimeoutMs(opts: AiChatOptions, config: AiProviderConfig): number {
  return opts.timeoutMs ?? config.defaultTimeoutMs ?? 60_000
}

function mapFetchError(err: unknown, timedOut: boolean): AiProviderError {
  if (timedOut) return new AiProviderError("AI provider request timed out", "timeout", err)
  if (err && typeof err === "object") {
    const name = (err as { name?: unknown }).name
    if (name === "AbortError") {
      return new AiProviderError("AI provider request aborted", "timeout", err)
    }
  }
  return new AiProviderError("AI provider network error", "network", err)
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = "openai-compatible"

  constructor(private readonly config: AiProviderConfig) {
    if (config.kind !== "openai-compatible") {
      throw new AiProviderError(
        `OpenAiCompatibleProvider got wrong kind: ${String(config.kind)}`,
        "unknown",
      )
    }
    if (!config.baseUrl) throw new AiProviderError("baseUrl is required", "unknown")
    if (!config.apiKey) throw new AiProviderError("apiKey is required", "auth")
  }

  private endpoint(): string {
    return `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`
  }

  async chat(messages: AiChatMessage[], opts: AiChatOptions): Promise<AiChatResult> {
    const controller = new AbortController()
    const timeoutMs = resolveTimeoutMs(opts, this.config)
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    const externalListener = opts.abortSignal
      ? () => controller.abort()
      : null
    if (opts.abortSignal && externalListener) {
      if (opts.abortSignal.aborted) controller.abort()
      else opts.abortSignal.addEventListener("abort", externalListener, { once: true })
    }

    try {
      let response: Response
      try {
        response = await fetch(this.endpoint(), {
          method: "POST",
          headers: buildHeaders(this.config),
          body: buildBody(messages, opts, false, this.config),
          signal: controller.signal,
        })
      } catch (err) {
        throw mapFetchError(err, timedOut)
      }

      const rawText = await response.text()
      let parsed: ChatCompletionPayload | null = null
      try {
        parsed = rawText ? (JSON.parse(rawText) as ChatCompletionPayload) : null
      } catch {
        parsed = null
      }

      if (!response.ok) {
        const kind = mapHttpErrorKind(response.status)
        const snippet = rawText.length > 600 ? `${rawText.slice(0, 600)}…` : rawText
        throw new AiProviderError(
          `AI provider responded with ${response.status}: ${snippet}`,
          kind,
        )
      }

      const choice = parsed?.choices?.[0]
      const text =
        extractMessageContent(choice) || extractDeltaContent(choice) || ""
      return {
        text,
        finishReason: toFinishReason(choice?.finish_reason),
        usage: mapUsage(parsed?.usage),
      }
    } finally {
      clearTimeout(timer)
      if (opts.abortSignal && externalListener) {
        opts.abortSignal.removeEventListener("abort", externalListener)
      }
    }
  }

  stream(messages: AiChatMessage[], opts: AiChatOptions): AsyncIterable<AiStreamChunk> {
    return {
      [Symbol.asyncIterator]: (): AsyncIterator<AiStreamChunk> =>
        this.streamIterator(messages, opts),
    }
  }

  private async *streamIterator(
    messages: AiChatMessage[],
    opts: AiChatOptions,
  ): AsyncGenerator<AiStreamChunk, void, void> {
    const controller = new AbortController()
    const timeoutMs = resolveTimeoutMs(opts, this.config)
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    const externalListener = opts.abortSignal
      ? () => controller.abort()
      : null
    if (opts.abortSignal && externalListener) {
      if (opts.abortSignal.aborted) controller.abort()
      else opts.abortSignal.addEventListener("abort", externalListener, { once: true })
    }

    try {
      let response: Response
      try {
        response = await fetch(this.endpoint(), {
          method: "POST",
          headers: buildHeaders(this.config),
          body: buildBody(messages, opts, true, this.config),
          signal: controller.signal,
        })
      } catch (err) {
        throw mapFetchError(err, timedOut)
      }

      if (!response.ok) {
        const kind = mapHttpErrorKind(response.status)
        const rawText = await response.text().catch(() => "")
        const snippet = rawText.length > 600 ? `${rawText.slice(0, 600)}…` : rawText
        throw new AiProviderError(
          `AI provider responded with ${response.status}: ${snippet}`,
          kind,
        )
      }

      if (!response.body) {
        throw new AiProviderError("AI provider returned empty stream body", "bad_response")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder("utf-8")
      let buffer = ""
      let finishReason: string | undefined
      let done = false

      try {
        while (!done) {
          let chunk: ReadableStreamReadResult<Uint8Array>
          try {
            chunk = await reader.read()
          } catch (err) {
            throw mapFetchError(err, timedOut)
          }
          if (chunk.done) break
          buffer += decoder.decode(chunk.value, { stream: true })

          // SSE 事件以空行分隔；先按行扫描，累积 data: 行
          let newlineIdx: number
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            const rawLine = buffer.slice(0, newlineIdx).replace(/\r$/, "")
            buffer = buffer.slice(newlineIdx + 1)
            const line = rawLine.trim()
            if (!line.startsWith("data:")) continue
            const data = line.slice(5).trim()
            if (!data) continue
            if (data === "[DONE]") {
              done = true
              yield { deltaText: "", done: true, finishReason }
              break
            }
            let parsed: ChatCompletionPayload | null = null
            try {
              parsed = JSON.parse(data) as ChatCompletionPayload
            } catch {
              continue
            }
            const choice = parsed?.choices?.[0]
            const fr = toFinishReason(choice?.finish_reason)
            if (fr) finishReason = fr
            const delta =
              extractDeltaContent(choice) || extractMessageContent(choice) || ""
            if (delta) {
              yield { deltaText: delta, done: false }
            }
            if (fr) {
              done = true
              yield { deltaText: "", done: true, finishReason }
              break
            }
          }
        }

        if (!done) {
          // 兜底：SSE 未显式结束
          yield { deltaText: "", done: true, finishReason }
        }
      } finally {
        try {
          reader.releaseLock()
        } catch {
          // ignore
        }
      }
    } finally {
      clearTimeout(timer)
      if (opts.abortSignal && externalListener) {
        opts.abortSignal.removeEventListener("abort", externalListener)
      }
    }
  }
}
