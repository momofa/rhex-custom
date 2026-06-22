"use client"

import Image from "next/image"
import { RefreshCw, ShieldCheck } from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

interface BuiltinCaptchaFieldProps {
  code: string
  onCodeChange: (value: string) => void
  onTokenChange: (value: string) => void
  onLoadError?: (message: string) => void
}

type CaptchaResponse = {
  code?: number
  message?: string
  data?: {
    imageDataUrl?: string
    captchaToken?: string
  }
}

function normalizeCaptchaCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4)
}

function isComposingInputEvent(event: ChangeEvent<HTMLInputElement>) {
  return (event.nativeEvent as InputEvent).isComposing
}

export function BuiltinCaptchaField({ code, onCodeChange, onTokenChange, onLoadError }: BuiltinCaptchaFieldProps) {
  const inputId = useId()
  const [captchaUrl, setCaptchaUrl] = useState("")
  const [displayCode, setDisplayCode] = useState(code)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const hasInitializedRef = useRef(false)
  const isComposingRef = useRef(false)

  useEffect(() => {
    if (!isComposingRef.current) {
      setDisplayCode(code)
    }
  }, [code])

  const commitCode = useCallback((value: string) => {
    const normalizedCode = normalizeCaptchaCode(value)
    setDisplayCode(normalizedCode)
    onCodeChange(normalizedCode)
  }, [onCodeChange])

  const refreshCaptcha = useCallback(async () => {
    setIsRefreshing(true)

    try {
      const response = await fetch(`/api/auth/captcha?ts=${Date.now()}`, { cache: "no-store" })
      const result = await response.json() as CaptchaResponse

      if (!response.ok || result.code !== 0) {
        onLoadError?.(result.message ?? "验证码加载失败")
        return
      }

      setCaptchaUrl(result.data?.imageDataUrl ?? "")
      onTokenChange(result.data?.captchaToken ?? "")
      setDisplayCode("")
      onCodeChange("")
    } catch {
      onLoadError?.("验证码加载失败")
    } finally {
      setIsRefreshing(false)
    }
  }, [onCodeChange, onLoadError, onTokenChange])

  const handleMount = useCallback((node: HTMLDivElement | null) => {
    if (!node || hasInitializedRef.current) {
      return
    }

    hasInitializedRef.current = true
    void refreshCaptcha()
  }, [refreshCaptcha])

  return (
    <div ref={handleMount} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          图形验证码
        </label>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          aria-label="刷新图形验证码"
          title="点击刷新验证码"
          onClick={() => void refreshCaptcha()}
          disabled={isRefreshing}
          className="group relative h-11 w-[132px] overflow-hidden rounded-2xl border border-border bg-background/80 shadow-xs transition-colors hover:border-primary/50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-70"
        >
          {captchaUrl ? (
            <Image
              src={captchaUrl}
              alt="图形验证码"
              width={132}
              height={44}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              加载中...
            </span>
          )}
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/0 text-primary opacity-0 transition-opacity group-hover:bg-background/45 group-hover:opacity-100 group-focus-visible:bg-background/45 group-focus-visible:opacity-100">
            <RefreshCw data-icon="captcha-refresh" className={cn("size-4", isRefreshing && "animate-spin")} />
          </span>
        </button>

        <InputGroup className="h-11 rounded-2xl bg-background/80 sm:max-w-[220px]">
          <InputGroupAddon>
            <ShieldCheck />
          </InputGroupAddon>
          <InputGroupInput
            id={inputId}
            value={displayCode}
            onChange={(event) => {
              if (isComposingInputEvent(event)) {
                setDisplayCode(event.target.value)
                return
              }

              commitCode(event.target.value)
            }}
            onCompositionStart={() => {
              isComposingRef.current = true
            }}
            onCompositionEnd={(event) => {
              isComposingRef.current = false
              commitCode(event.currentTarget.value)
            }}
            placeholder="输入图中验证码"
            autoComplete="off"
            inputMode="text"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={4}
          />
        </InputGroup>
      </div>
    </div>
  )
}
