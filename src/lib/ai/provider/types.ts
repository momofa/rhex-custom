export interface AiChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface AiChatOptions {
  model: string
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  abortSignal?: AbortSignal
  /** 透传 provider-specific 额外参数（如 top_p / presence_penalty） */
  extra?: Record<string, unknown>
}

export interface AiChatUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface AiChatResult {
  text: string
  finishReason?: string
  usage?: AiChatUsage
}

export interface AiStreamChunk {
  deltaText: string
  done: boolean
  finishReason?: string
}

export interface AiProvider {
  readonly name: string
  chat(messages: AiChatMessage[], opts: AiChatOptions): Promise<AiChatResult>
  stream?(messages: AiChatMessage[], opts: AiChatOptions): AsyncIterable<AiStreamChunk>
}

export interface AiProviderConfig {
  /** 目前仅支持 openai 兼容协议；未来可扩展 anthropic / azure 等 */
  kind: "openai-compatible"
  /** e.g. https://api.openai.com/v1 或自建 endpoint */
  baseUrl: string
  apiKey: string
  defaultModel?: string
  defaultTimeoutMs?: number
  /** 透传 header（如 "X-Custom: ..."） */
  extraHeaders?: Record<string, string>
}

export type AiProviderErrorKind =
  | "network"
  | "timeout"
  | "auth"
  | "rate_limit"
  | "bad_response"
  | "unknown"

export class AiProviderError extends Error {
  readonly kind: AiProviderErrorKind
  readonly cause?: unknown

  constructor(msg: string, kind: AiProviderErrorKind, cause?: unknown) {
    super(msg)
    this.name = "AiProviderError"
    this.kind = kind
    this.cause = cause
  }
}