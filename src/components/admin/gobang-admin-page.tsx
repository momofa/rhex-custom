"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TextField } from "@/components/ui/text-field"

interface GobangAdminPageProps {
  AppId: string
  config: Record<string, boolean | number | string>
}

export function GobangAdminPage({ AppId, config }: GobangAdminPageProps) {
  void AppId
  const [dailyFreeGames, setDailyFreeGames] = useState(String(config.dailyFreeGames ?? 1))
  const [dailyVipFreeGames, setDailyVipFreeGames] = useState(String(config.dailyVipFreeGames ?? 2))
  const [dailyNormalGameLimit, setDailyNormalGameLimit] = useState(String(config.dailyNormalGameLimit ?? 3))
  const [dailyVipGameLimit, setDailyVipGameLimit] = useState(String(config.dailyVipGameLimit ?? 5))
  const [ticketCost, setTicketCost] = useState(String(config.ticketCost ?? 10))
  const [aiLevel, setAiLevel] = useState(String(config.aiLevel ?? 2))
  const [winReward, setWinReward] = useState(String(config.winReward ?? 20))
  const [matchLabel, setMatchLabel] = useState(String(config.matchLabel ?? "五子棋人机对战"))
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  function saveConfig() {
    setFeedback("")
    startTransition(async () => {
      const response = await fetch("/api/admin/apps/gobang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            dailyFreeGames: Number(dailyFreeGames),
            dailyVipFreeGames: Number(dailyVipFreeGames),
            dailyNormalGameLimit: Number(dailyNormalGameLimit),
            dailyVipGameLimit: Number(dailyVipGameLimit),
            ticketCost: Number(ticketCost),
            aiLevel: Number(aiLevel),
            winReward: Number(winReward),
            matchLabel,
          },
        }),
      })

      const result = await response.json()
      setFeedback(result.message ?? (response.ok ? "保存成功" : "保存失败"))
    })
  }

  return (
    <div className="space-y-6">


      <Card>
        <CardHeader>
          <CardTitle>基础配置</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TextField label="每日普通免费次数" value={dailyFreeGames} onChange={setDailyFreeGames} />
          <TextField label="每日 VIP 免费次数" value={dailyVipFreeGames} onChange={setDailyVipFreeGames} />
          <TextField label="普通用户每日总次数" value={dailyNormalGameLimit} onChange={setDailyNormalGameLimit} />
          <TextField label="VIP 用户每日总次数" value={dailyVipGameLimit} onChange={setDailyVipGameLimit} />
          <TextField label="超额门票积分" value={ticketCost} onChange={setTicketCost} />
          <TextField label="AI 难度等级" value={aiLevel} onChange={setAiLevel} />
          <TextField label="获胜奖励积分" value={winReward} onChange={setWinReward} />
          <TextField label="前台入口名称" value={matchLabel} onChange={setMatchLabel} containerClassName="md:col-span-2 xl:col-span-3" />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="button" disabled={isPending} onClick={saveConfig}>{isPending ? "保存中..." : "保存配置"}</Button>
        {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
      </div>
    </div>
  )
}
