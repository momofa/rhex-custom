"use client"

import Script from "next/script"
import { useEffect, useRef, useState } from "react"

interface TurnstileCaptchaFieldProps {
  siteKey: string
  onTokenChange: (value: string) => void
}

export function TurnstileCaptchaField({ siteKey, onTokenChange }: TurnstileCaptchaFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [scriptReady, setScriptReady] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile))

  useEffect(() => {
    const container = containerRef.current
    if (!siteKey || !scriptReady || !window.turnstile || !container || widgetIdRef.current) {
      return
    }

    widgetIdRef.current = window.turnstile.render(container, {
      sitekey: siteKey,
      callback: (token) => onTokenChange(token),
      "expired-callback": () => onTokenChange(""),
      "error-callback": () => onTokenChange(""),
      theme: "auto",
    })
  }, [onTokenChange, scriptReady, siteKey])

  return (
    <div className="space-y-2 rounded-xl">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div ref={containerRef} className="min-h-[65px]" />
    </div>
  )
}
