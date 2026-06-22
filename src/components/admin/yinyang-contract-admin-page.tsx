"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/rbutton"

interface YinYangContractAdminPageProps {
  AppId: string
  config: Record<string, boolean | number | string>
}

export function YinYangContractAdminPage({ AppId, config }: YinYangContractAdminPageProps) {
  const [entryLabel, setEntryLabel] = useState(String(config.entryLabel ?? "阴阳契"))
  const [taxRateBps, setTaxRateBps] = useState(String(config.taxRateBps ?? 1000))
  const [minStakePoints, setMinStakePoints] = useState(String(config.minStakePoints ?? 10))
  const [maxStakePoints, setMaxStakePoints] = useState(String(config.maxStakePoints ?? 500))
  const [dailyCreateLimit, setDailyCreateLimit] = useState(String(config.dailyCreateLimit ?? 5))
  const [dailyAcceptLimit, setDailyAcceptLimit] = useState(String(config.dailyAcceptLimit ?? 10))
  const challengeExpireHours = String(config.challengeExpireHours ?? 24)
  const [feedback, setFeedback] = useState("")


  const [isPending, startTransition] = useTransition()

  function saveConfig() {
    setFeedback("")
    startTransition(async () => {
      const response = await fetch("/api/admin/apps/yinyang-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            enabled: true,
            entryLabel,
            taxRateBps: Number(taxRateBps || 0),
            minStakePoints: Number(minStakePoints || 0),
            maxStakePoints: Number(maxStakePoints || 0),
            dailyCreateLimit: Number(dailyCreateLimit || 0),
            dailyAcceptLimit: Number(dailyAcceptLimit || 0),
            challengeExpireHours: Number(challengeExpireHours || 0),
          },
        }),
      })

      const result = await response.json()
      setFeedback(result.message ?? (response.ok ? "保存成功" : "保存失败"))
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">阴阳契应用后台</h3>
          <p className="text-sm text-muted-foreground">应用标识：{AppId}。统一管理税率、彩头范围与每日挑战次数。</p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h4 className="text-sm font-semibold">基础配置</h4>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="前台入口名称" value={entryLabel} onChange={setEntryLabel} />
          <Field label="税率基点（1000=10%）" value={taxRateBps} onChange={setTaxRateBps} />
          <Field label="单次最小彩头" value={minStakePoints} onChange={setMinStakePoints} />
          <Field label="单次最大彩头" value={maxStakePoints} onChange={setMaxStakePoints} />
          <Field label="每日发起次数上限" value={dailyCreateLimit} onChange={setDailyCreateLimit} />
          <Field label="每日应战次数上限" value={dailyAcceptLimit} onChange={setDailyAcceptLimit} />

        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="button" disabled={isPending} onClick={saveConfig}>{isPending ? "保存中..." : "保存配置"}</Button>
        {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-[16px] border border-border bg-background px-4 text-sm outline-hidden" />
    </label>
  )
}
