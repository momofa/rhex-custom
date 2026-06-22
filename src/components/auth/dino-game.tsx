"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Kbd } from "@/components/ui/kbd"

declare global {
  interface Window {
    AuthDinoGame?: {
      mount: (host: HTMLElement) => () => void
    }
  }
}

const SCRIPT_ID = "auth-dino-bundle"
const SAFE_STYLE_ID = "auth-dino-safe-style"
let scriptLoader: Promise<NonNullable<Window["AuthDinoGame"]>> | null = null

function ensureSafeStyleSheet() {
  if (typeof document === "undefined") {
    return
  }

  if (document.getElementById(SAFE_STYLE_ID)) {
    return
  }

  const style = document.createElement("style")
  style.id = SAFE_STYLE_ID
  // 插入到 <head> 最前面，成为 document.styleSheets[0]，确保同源可访问
  document.head.insertBefore(style, document.head.firstChild)
}

function loadDinoGameScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window is not available"))
  }

  if (window.AuthDinoGame) {
    return Promise.resolve(window.AuthDinoGame)
  }

  if (scriptLoader) {
    return scriptLoader
  }

  scriptLoader = new Promise((resolve, reject) => {
    const handleLoad = () => {
      if (window.AuthDinoGame) {
        resolve(window.AuthDinoGame)
        return
      }

      reject(new Error("Auth dino game did not register correctly"))
    }

    const handleError = () => {
      reject(new Error("Failed to load auth dino bundle"))
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null

    if (!script) {
      script = document.createElement("script")
      script.id = SCRIPT_ID
      script.src = "/auth-dino.bundle.js"
      script.async = true
      script.addEventListener("load", handleLoad, { once: true })
      script.addEventListener("error", handleError, { once: true })
      document.body.appendChild(script)
      return
    }

    script.addEventListener("load", handleLoad, { once: true })
    script.addEventListener("error", handleError, { once: true })
  })

  return scriptLoader
}

export function DinoGame() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const hostId = useId().replace(/:/g, "")
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let cleanup = () => {}

    const host = hostRef.current
    if (!host) {
      return
    }

    host.id = `auth-dino-${hostId}`

    // 确保 document.styleSheets[0] 是同源可访问的样式表，解决 CDN 跨域导致的 SecurityError
    ensureSafeStyleSheet()

    void loadDinoGameScript()
      .then((game) => {
        if (cancelled || !hostRef.current) {
          return
        }

        cleanup = game.mount(hostRef.current)
        setReady(true)
        setFailed(false)
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setReady(false)
        setFailed(true)
      })

    return () => {
      cancelled = true
      cleanup()
    }
  }, [hostId])

  return (
    <div className="auth-dino-card">
      <div className="auth-dino-toolbar">
        <span className="auth-dino-badge">Dino</span>
        <span className="auth-dino-toolbar-text">点击游戏区域后按空格开始</span>
      </div>

      <div className="auth-dino-stage-shell">
        <div
          ref={hostRef}
          className="auth-dino-host"
          tabIndex={0}
          onPointerDown={(event) => event.currentTarget.focus()}
        />

        {!ready && !failed ? <div className="auth-dino-status">游戏加载中...</div> : null}
        {failed ? <div className="auth-dino-status auth-dino-status-error">游戏加载失败</div> : null}
      </div>

      <p className="auth-dino-footnote text-center">
        <Kbd>空格</Kbd>或<Kbd>⇧</Kbd>跳跃。
      </p>
    </div>
  )
}