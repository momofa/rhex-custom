"use client"

import dynamic from "next/dynamic"

import { cn } from "@/lib/utils"

const DinoGame = dynamic(
  () => import("@/components/auth/dino-game").then((module) => module.DinoGame),
  {
    ssr: false,
    loading: () => (
      <div className="auth-dino-card">
        <div className="auth-dino-status">游戏加载中...</div>
      </div>
    ),
  },
)

const TrueFocus = dynamic(() => import("@/components/TrueFocus"), {
  ssr: false,
  loading: () => (
    <div className="text-3xl font-semibold tracking-tight text-muted-foreground" aria-hidden>
      <span>...</span>
    </div>
  ),
})

interface AuthShowcaseProps {
  className?: string
  siteName: string
}

export function AuthShowcase({
  className,
  siteName,
}: AuthShowcaseProps) {
  return (
    <div className={cn("auth-showcase-layout", className)}>
      <div className="auth-showcase-wordmark-shell" aria-hidden>
        <TrueFocus
          sentence={siteName}
          manualMode={false}
          blurAmount={5}
          borderColor="#5227FF"
          animationDuration={0.5}
          pauseBetweenAnimations={1}
        />
      </div>

      <DinoGame />
    </div>
  )
}
