"use client"

import Link from "next/link"

import { SelfServeAdsGrid } from "@/components/self-serve-ads-grid"
import type { SelfServeAdsPanelData } from "@/lib/self-serve-ads.shared"

interface SelfServeAdsIntroPageProps {
  AppId: string
  panelData: SelfServeAdsPanelData | null
}

export function SelfServeAdsIntroPage({ AppId, panelData }: SelfServeAdsIntroPageProps) {
  void AppId
  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs shadow-black/5 dark:shadow-black/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">自助推广广告位</h1>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">支持图片广告和文字广告购买，提交后进入后台审核；已投放广告会显示到期时间。</p>
          </div>
          <Link href="/" className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground">返回首页查看广告位</Link>
        </div>
      </div>

      {panelData ? (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs shadow-black/5 dark:shadow-black/30">
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-base font-semibold">{panelData.title}</h2>
            <p className="text-sm text-muted-foreground">未使用的广告位会显示“点击购买”，已使用的广告位会显示到期时间。</p>
          </div>
          <SelfServeAdsGrid
            imageSlots={panelData.imageSlots}
            textSlots={panelData.textSlots}
            placeholderLabel={panelData.placeholderLabel}
            variant="page"
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card px-5 py-6 text-sm leading-7 text-muted-foreground">
          当前未开放自助广告位购买。
        </div>
      )}

    </section>
  )
}
