"use client"

import dynamic from "next/dynamic"

import type { PasskeyAuthPanelProps } from "@/components/auth/passkey-auth-panel"

const DynamicPasskeyAuthPanel = dynamic<PasskeyAuthPanelProps>(
  () => import("@/components/auth/passkey-auth-panel").then((module) => module.PasskeyAuthPanel),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
        Passkey 认证模块加载中...
      </div>
    ),
  },
)

export function PasskeyAuthPanelLoader(props: PasskeyAuthPanelProps) {
  return <DynamicPasskeyAuthPanel {...props} />
}
