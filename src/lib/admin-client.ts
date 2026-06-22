"use client"

export interface AdminClientPayload<TData = unknown> {
  code?: number
  message?: string
  data?: TData
}

export interface AdminClientResult<TData = void> {
  message: string
  data: TData
}

export class AdminClientError extends Error {
  readonly status: number
  readonly code: number

  constructor(message: string, options?: { status?: number; code?: number; cause?: unknown }) {
    super(message, { cause: options?.cause })
    this.name = "AdminClientError"
    this.status = options?.status ?? 500
    this.code = options?.code ?? this.status
  }
}

export interface AdminRequestOptions<TData = void> extends Omit<RequestInit, "body"> {
  body?: unknown
  validateData?: (data: unknown) => data is TData
  invalidDataMessage?: string
  defaultSuccessMessage?: string
  defaultErrorMessage?: string
  defaultNetworkErrorMessage?: string
}

function resolveRequestBody(body: unknown) {
  if (typeof body === "undefined") {
    return undefined
  }

  if (
    typeof FormData !== "undefined" && body instanceof FormData
    || typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams
    || typeof Blob !== "undefined" && body instanceof Blob
    || typeof body === "string"
  ) {
    return body
  }

  return JSON.stringify(body)
}

function resolveHeaders(body: unknown, headers?: HeadersInit) {
  const resolvedHeaders = new Headers(headers)
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData
  const isUrlSearchParams = typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams

  if (typeof body !== "undefined" && !isFormData && !isUrlSearchParams && !resolvedHeaders.has("Content-Type")) {
    resolvedHeaders.set("Content-Type", "application/json")
  }

  return resolvedHeaders
}

async function readPayload<TData>(response: Response) {
  return await response.json().catch(() => null) as AdminClientPayload<TData> | null
}

export function toAdminClientError(error: unknown, fallbackMessage = "操作失败，请稍后重试") {
  if (error instanceof AdminClientError) {
    return error
  }

  const message = error instanceof Error && error.message ? error.message : fallbackMessage
  return new AdminClientError(message, { cause: error })
}

export function getAdminClientErrorMessage(error: unknown, fallbackMessage = "操作失败，请稍后重试") {
  return toAdminClientError(error, fallbackMessage).message
}

export async function adminRequest<TData = void>(input: RequestInfo | URL, options: AdminRequestOptions<TData> = {}): Promise<AdminClientResult<TData>> {
  const {
    body,
    validateData,
    invalidDataMessage = "响应数据格式不正确",
    defaultSuccessMessage = "操作成功",
    defaultErrorMessage = "操作失败，请稍后重试",
    defaultNetworkErrorMessage = "网络异常，请稍后重试",
    headers,
    ...init
  } = options

  try {
    const response = await fetch(input, {
      ...init,
      headers: resolveHeaders(body, headers),
      body: resolveRequestBody(body),
    })
    const payload = await readPayload<TData>(response)

    if (!response.ok) {
      throw new AdminClientError(payload?.message ?? defaultErrorMessage, {
        status: response.status,
        code: payload?.code ?? response.status,
      })
    }

    if (validateData && !validateData(payload?.data)) {
      throw new AdminClientError(payload?.message ?? invalidDataMessage, {
        status: response.status,
        code: payload?.code ?? response.status,
      })
    }

    return {
      message: payload?.message ?? defaultSuccessMessage,
      data: payload?.data as TData,
    }
  } catch (error) {
    if (error instanceof AdminClientError) {
      throw error
    }

    throw new AdminClientError(defaultNetworkErrorMessage, { cause: error })
  }
}

export function adminGet<TData = void>(input: RequestInfo | URL, options?: Omit<AdminRequestOptions<TData>, "method" | "body">) {
  return adminRequest<TData>(input, {
    ...options,
    method: "GET",
  })
}

export function adminPost<TData = void>(input: RequestInfo | URL, body?: unknown, options?: Omit<AdminRequestOptions<TData>, "method" | "body">) {
  return adminRequest<TData>(input, {
    ...options,
    method: "POST",
    body,
  })
}
