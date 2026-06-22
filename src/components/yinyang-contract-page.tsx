"use client"

import { useEffect, useMemo, useState, useTransition } from "react"

import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/toast"
import { useContentSafety } from "@/hooks/use-content-safety"
import { formatCompactPointValue } from "@/lib/formatters"
import { formatYinYangChallengeTime, type YinYangChallengeCard, type YinYangLobbyData, type YinYangLeaderboardUser } from "@/lib/yinyang-contract-shared"

type ApiResponse<T> = { code: number; message?: string; data?: T }
type ResultFxState = null | { type: "win" | "lose"; title: string; detail: string }
type EarnerTab = "today-profit" | "today-loss" | "total-profit" | "total-loss"
type RandomChallengePreset = { question: string; optionA: string; optionB: string; correctOption: "A" | "B" }

const RANDOM_CHALLENGE_PRESETS: RandomChallengePreset[] = [
  { question: "今天的运势更偏向哪边？", optionA: "稳中求胜", optionB: "险中出奇", correctOption: "A" },
  { question: "下班之后更适合做什么？", optionA: "回家躺平", optionB: "出去逛逛", correctOption: "B" },
  { question: "点外卖时今天更适合哪一类？", optionA: "热辣重口", optionB: "清爽轻食", correctOption: "A" },
  { question: "做任务时应该先处理哪种？", optionA: "最难最重要的", optionB: "最简单最顺手的", correctOption: "A" },
  { question: "如果今晚熬夜，你更像哪种状态？", optionA: "越战越勇", optionB: "灵魂出走", correctOption: "B" },
  { question: "今天的灵感来源更像什么？", optionA: "突然开窍", optionB: "慢慢酝酿", correctOption: "B" },
  { question: "周末更适合哪种节奏？", optionA: "宅家回血", optionB: "社交充电", correctOption: "A" },
  { question: "遇到分歧时你更该怎么选？", optionA: "相信直觉", optionB: "相信证据", correctOption: "B" },
  { question: "今天更适合听哪类音乐？", optionA: "热血节奏", optionB: "安静慢歌", correctOption: "A" },
  { question: "如果现在来一杯饮料，你更该点？", optionA: "冰美式", optionB: "全糖奶茶", correctOption: "A" },
  { question: "今天适合先完成哪件事？", optionA: "清理待办", optionB: "先摸鱼放空", correctOption: "A" },
  { question: "今晚刷剧更适合哪种类型？", optionA: "悬疑烧脑", optionB: "轻松喜剧", correctOption: "B" },
  { question: "今天出门更容易遇到什么？", optionA: "贵人相助", optionB: "意外插曲", correctOption: "B" },
  { question: "面对突发情况更该先做什么？", optionA: "先冷静判断", optionB: "先快速行动", correctOption: "A" },
  { question: "如果今晚学习，你更适合哪种模式？", optionA: "高强度冲刺", optionB: "碎片化慢学", correctOption: "A" },
  { question: "今天的社交状态更像哪一种？", optionA: "妙语连珠", optionB: "能躲就躲", correctOption: "B" },
  { question: "今天更适合什么颜色？", optionA: "黑金气场", optionB: "白蓝治愈", correctOption: "A" },
  { question: "如果现在立刻出门，你更可能忘记什么？", optionA: "手机", optionB: "钥匙", correctOption: "B" },
  { question: "今天更适合在哪种环境工作？", optionA: "安静独处", optionB: "热闹氛围", correctOption: "A" },
  { question: "当灵感来了，你更该怎么处理？", optionA: "立刻记录", optionB: "先放着等会儿", correctOption: "A" },
  { question: "今天更容易在哪方面翻车？", optionA: "时间管理", optionB: "情绪控制", correctOption: "A" },
  { question: "如果只能做一个选择，今晚更该？", optionA: "早点睡觉", optionB: "继续熬夜", correctOption: "A" },
  { question: "今天更适合哪个关键词？", optionA: "稳", optionB: "冲", correctOption: "A" },
  { question: "如果朋友突然约你，你更该？", optionA: "果断答应", optionB: "礼貌拒绝", correctOption: "B" },
  { question: "今天最可能带来好运的是？", optionA: "坚持原计划", optionB: "临场改打法", correctOption: "A" },
  { question: "现在更适合做哪种决策？", optionA: "保守稳健", optionB: "大胆一试", correctOption: "B" },
  { question: "今天更接近哪种气质？", optionA: "冷静审慎", optionB: "疯感上头", correctOption: "A" },
  { question: "如果要见重要的人，你更该选？", optionA: "提前准备", optionB: "现场发挥", correctOption: "A" },
  { question: "今天更适合哪种工作法？", optionA: "单线程推进", optionB: "多线程乱杀", correctOption: "A" },
  { question: "今天更适合相信什么？", optionA: "经验", optionB: "运气", correctOption: "A" },
] as const

interface YinYangContractPageProps {
  initialData: YinYangLobbyData
  canPlay: boolean
}

export function YinYangContractPage({ initialData, canPlay }: YinYangContractPageProps) {
  const [data, setData] = useState(initialData)
  const [question, setQuestion] = useState("")
  const [optionA, setOptionA] = useState("")
  const [optionB, setOptionB] = useState("")
  const [correctOption, setCorrectOption] = useState<"A" | "B">("A")
  const [stakePoints, setStakePoints] = useState(String(initialData.config.maxStakePoints))
  const [selectedChallenge, setSelectedChallenge] = useState<YinYangChallengeCard | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [winnerLeaderboardOpen, setWinnerLeaderboardOpen] = useState(false)
  const [earnerLeaderboardOpen, setEarnerLeaderboardOpen] = useState(false)
  const [resultFx, setResultFx] = useState<ResultFxState>(null)
  const [isPending, startTransition] = useTransition()

  const questionSafety = useContentSafety(question, { maxLength: 120 })
  const optionASafety = useContentSafety(optionA, { maxLength: 40 })
  const optionBSafety = useContentSafety(optionB, { maxLength: 40 })
  const createFormValid = questionSafety.valid && optionASafety.valid && optionBSafety.valid

  const myOpenChallengeIds = useMemo(() => new Set(data.recentChallenges.filter((item) => item.status === "OPEN").map((item) => item.id)), [data.recentChallenges])


  useEffect(() => {
    if (!resultFx) {
      return
    }
    const timer = window.setTimeout(() => setResultFx(null), 2600)
    return () => window.clearTimeout(timer)
  }, [resultFx])

  async function submit(action: "create" | "accept", payload: Record<string, unknown>) {
    if (!canPlay) {
      toast.error("请先登录后再参与阴阳契", "未登录")
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/yinyang-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      })
      const result = await response.json() as ApiResponse<YinYangLobbyData>
      if (!response.ok || !result.data) {
        toast.error(result.message ?? "操作失败", "阴阳契")
        return
      }

      const previousPoints = data.summary.points
      const nextPoints = result.data.summary.points
      const pointsDelta = nextPoints - previousPoints

      setData(result.data)
      toast.success(result.message ?? "操作成功", "阴阳契")

      if (action === "accept") {
        setSelectedChallenge(null)
        if (pointsDelta > 0) {
          setResultFx({ type: "win", title: "挑战胜利", detail: `本局净赚 ${formatCompactPointValue(pointsDelta)} ${result.data.summary.pointName}` })
        } else if (pointsDelta < 0) {
          setResultFx({ type: "lose", title: "挑战失利", detail: `本局亏损 ${formatCompactPointValue(Math.abs(pointsDelta))} ${result.data.summary.pointName}` })
        }
      }

      if (action === "create") {
        setQuestion("")
        setOptionA("")
        setOptionB("")
        setCorrectOption("A")
        setCreateModalOpen(false)
      }
    })
  }

  function handleCreate() {
    submit("create", {
      question,
      optionA,
      optionB,
      correctOption,
      stakePoints: Number(stakePoints || 0),
    })
  }

  function refreshLobby() {
    if (!canPlay) {
      toast.error("请先登录后再刷新阴阳契数据", "未登录")
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/yinyang-contract", {
        method: "GET",
        cache: "no-store",
      })
      const result = await response.json() as ApiResponse<YinYangLobbyData>
      if (!response.ok || !result.data) {
        toast.error(result.message ?? "刷新失败", "阴阳契")
        return
      }
      setData(result.data)
      toast.success("大厅数据已刷新", "阴阳契")
    })
  }

  function rollRandomChallenge() {
    const preset = RANDOM_CHALLENGE_PRESETS[Math.floor(Math.random() * RANDOM_CHALLENGE_PRESETS.length)]
    setQuestion(preset.question)
    setOptionA(preset.optionA)
    setOptionB(preset.optionB)
    setCorrectOption(preset.correctOption)
    toast.success("已随机生成一组题目", "阴阳契")
  }

  return (
    <div className="relative space-y-6">
      <ResultFxOverlay state={resultFx} onClose={() => setResultFx(null)} />
      <CreateChallengeModal
        open={createModalOpen}
        canPlay={canPlay}
        isPending={isPending}
        question={question}
        optionA={optionA}
        optionB={optionB}
        correctOption={correctOption}
        stakePoints={stakePoints}
        minStakePoints={data.config.minStakePoints}
        maxStakePoints={data.config.maxStakePoints}
        taxRateBps={data.config.taxRateBps}
        dailyCreateLimit={data.summary.dailyCreateLimit}
        dailyAcceptLimit={data.summary.dailyAcceptLimit}
        questionSafety={questionSafety}
        optionASafety={optionASafety}
        optionBSafety={optionBSafety}
        createFormValid={createFormValid}
        onClose={() => setCreateModalOpen(false)}

        onQuestionChange={setQuestion}
        onOptionAChange={setOptionA}
        onOptionBChange={setOptionB}
        onCorrectOptionChange={setCorrectOption}
        onStakePointsChange={setStakePoints}
        onRollRandom={rollRandomChallenge}
        onSubmit={handleCreate}
      />
      <ChallengeAcceptModal
        challenge={selectedChallenge}
        pointName={data.config.pointName}
        disabled={isPending || !canPlay}
        onClose={() => setSelectedChallenge(null)}
        onAccept={(selectedOption) => selectedChallenge ? submit("accept", { challengeId: selectedChallenge.id, selectedOption }) : undefined}
      />
      <RecentChallengesModal open={historyModalOpen} challenges={data.recentChallenges} currentUserId={data.summary.userId} onClose={() => setHistoryModalOpen(false)} />
      <WinnerLeaderboardModal open={winnerLeaderboardOpen} items={data.winnerLeaderboard} onClose={() => setWinnerLeaderboardOpen(false)} />
      <EarnerLeaderboardModal open={earnerLeaderboardOpen} items={data.earnerLeaderboard} onClose={() => setEarnerLeaderboardOpen(false)} />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <div className="space-y-3">
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">我的概览</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">查看当前积分、胜负场和盈利情况。</p>
              </div>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setHistoryModalOpen(true)}>我的近期挑战</Button>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="当前积分" value={`${formatCompactPointValue(data.summary.points)} ${data.summary.pointName}`} />
                <StatCard label="胜 / 负" value={`${data.summary.winCount} / ${data.summary.loseCount}`} />
                <StatCard label="今日盈利" value={formatCompactPointValue(data.summary.todayProfitPoints)} tone="green" />
                <StatCard label="今日亏损" value={formatCompactPointValue(data.summary.todayLossPoints)} tone="red" />
                <StatCard label="总盈利" value={formatCompactPointValue(data.summary.totalProfitPoints)} tone="green" />
                <StatCard label="总亏损" value={formatCompactPointValue(data.summary.totalLossPoints)} tone="red" />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setWinnerLeaderboardOpen(true)}>赢家排行榜</Button>
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setEarnerLeaderboardOpen(true)}>赚积分排行榜</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">开放挑战大厅</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">点击任一挑战进入应战弹窗，确认答案后完成结算。</p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="rounded-full" disabled={isPending || !canPlay} onClick={refreshLobby}>刷新</Button>
                <Button type="button" className="rounded-full" disabled={!canPlay} onClick={() => setCreateModalOpen(true)}>发起挑战</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.openChallenges.length === 0 ? <EmptyState text="暂无开放挑战，快来发起第一场。" /> : data.openChallenges.map((challenge) => (
                <ChallengeListItem
                  key={challenge.id}
                  challenge={challenge}
                  pointName={data.config.pointName}
                  isMine={myOpenChallengeIds.has(challenge.id)}
                  onOpen={() => setSelectedChallenge(challenge)}
                />
              ))}
            </CardContent>
          </Card>
          <AnimatedCardTitle previousKing={data.kings.previousKing} currentKing={data.kings.currentKing} />
        </div>
      </div>
    </div>
  )
}

function ChallengeListItem({ challenge, pointName, isMine, onOpen }: {
  challenge: YinYangChallengeCard
  pointName: string
  isMine: boolean
  onOpen: () => void
}) {
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-xl border border-border bg-background p-4 text-left transition-colors hover:bg-accent/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-foreground">{challenge.question}</div>
          <div className="mt-1 text-xs text-muted-foreground">发起人：{challenge.creatorName} · {formatYinYangChallengeTime(challenge.createdAt)}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">彩头 {formatCompactPointValue(challenge.stakePoints)} {pointName}</div>
          <span className={`text-xs ${isMine ? "text-amber-600" : "text-muted-foreground"}`}>{isMine ? "这是你发起的挑战" : "点击进入应战"}</span>
        </div>
      </div>
    </button>
  )
}

function CreateChallengeModal({ open, canPlay, isPending, question, optionA, optionB, correctOption, stakePoints, minStakePoints, maxStakePoints, taxRateBps, dailyCreateLimit, dailyAcceptLimit, questionSafety, optionASafety, optionBSafety, createFormValid, onClose, onQuestionChange, onOptionAChange, onOptionBChange, onCorrectOptionChange, onStakePointsChange, onRollRandom, onSubmit }: {
  open: boolean
  canPlay: boolean
  isPending: boolean
  question: string
  optionA: string
  optionB: string
  correctOption: "A" | "B"
  stakePoints: string
  minStakePoints: number
  maxStakePoints: number
  taxRateBps: number
  dailyCreateLimit: number
  dailyAcceptLimit: number
  questionSafety: ReturnType<typeof useContentSafety>
  optionASafety: ReturnType<typeof useContentSafety>
  optionBSafety: ReturnType<typeof useContentSafety>
  createFormValid: boolean
  onClose: () => void
  onQuestionChange: (value: string) => void
  onOptionAChange: (value: string) => void
  onOptionBChange: (value: string) => void
  onCorrectOptionChange: (value: "A" | "B") => void
  onStakePointsChange: (value: string) => void
  onRollRandom: () => void
  onSubmit: () => void
}) {

  if (!open) return null

  return (
    <ModalShell title="发起阴阳挑战" description="设置问题、双答案与正确答案，提交后挑战会进入大厅。" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <Field label="问题" action={<Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={onRollRandom}>🎲 骰子</Button>} hint={<span className={`inline-flex text-xs ${questionSafety.overLimit ? "text-rose-500" : "text-muted-foreground"}`}>{questionSafety.length}/120</span>}>
          <textarea value={question} onChange={(event) => onQuestionChange(event.target.value)} className={`min-h-[110px] w-full rounded-[16px] border bg-background px-4 py-3 text-sm outline-hidden ${questionSafety.overLimit ? "border-rose-400 focus-visible:border-rose-500" : "border-border"}`} placeholder="输入挑战问题" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="答案 A" hint={<span className={`inline-flex text-xs ${optionASafety.overLimit ? "text-rose-500" : "text-muted-foreground"}`}>{optionASafety.length}/40</span>}>
            <input value={optionA} onChange={(event) => onOptionAChange(event.target.value)} className={`h-11 w-full rounded-[16px] border bg-background px-4 text-sm outline-hidden ${optionASafety.overLimit ? "border-rose-400 focus-visible:border-rose-500" : "border-border"}`} placeholder="输入答案 A" />
          </Field>
          <Field label="答案 B" hint={<span className={`inline-flex text-xs ${optionBSafety.overLimit ? "text-rose-500" : "text-muted-foreground"}`}>{optionBSafety.length}/40</span>}>
            <input value={optionB} onChange={(event) => onOptionBChange(event.target.value)} className={`h-11 w-full rounded-[16px] border bg-background px-4 text-sm outline-hidden ${optionBSafety.overLimit ? "border-rose-400 focus-visible:border-rose-500" : "border-border"}`} placeholder="输入答案 B" />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="正确答案">
            <select value={correctOption} onChange={(event) => onCorrectOptionChange(event.target.value === "B" ? "B" : "A")} className="h-11 w-full rounded-[16px] border border-border bg-background px-4 text-sm outline-hidden">
              <option value="A">答案 A</option>
              <option value="B">答案 B</option>
            </select>
          </Field>
          <Field label={`积分彩头（${minStakePoints}-${maxStakePoints}）`}>
            <input value={stakePoints} onChange={(event) => onStakePointsChange(event.target.value)} className="h-11 w-full rounded-[16px] border border-border bg-background px-4 text-sm outline-hidden" inputMode="numeric" />
          </Field>
        </div>
        <div className="rounded-[16px] bg-muted p-4 text-xs leading-6 text-muted-foreground">
          <p>发起挑战时会先托管扣除彩头，应战后由系统自动按配置税率结算。</p>
          <p>当前税率：{(taxRateBps / 100).toFixed(2)}%，每日可发起 {dailyCreateLimit} 次、可应战 {dailyAcceptLimit} 次。</p>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>关闭</Button>
          <Button type="button" className="rounded-full" disabled={isPending || !canPlay || !createFormValid} onClick={onSubmit}>{isPending ? "提交中..." : "确认发起"}</Button>

        </div>
      </div>
    </ModalShell>
  )
}

function ChallengeAcceptModal({ challenge, pointName, disabled, onClose, onAccept }: {
  challenge: YinYangChallengeCard | null
  pointName: string
  disabled: boolean
  onClose: () => void
  onAccept: (selectedOption: "A" | "B") => void
}) {
  if (!challenge) return null

  return (
    <ModalShell title="应战确认" description="确认你要选择的答案，提交后将立即结算本局挑战。" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="rounded-[16px] bg-muted p-4">
          <div className="font-medium text-foreground">{challenge.question}</div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>发起人：{challenge.creatorName}</span>
            <span>彩头：{formatCompactPointValue(challenge.stakePoints)} {pointName}</span>
            <span>奖励：{formatCompactPointValue(challenge.rewardPoints)} {pointName}</span>
          </div>
        </div>
        <div className="grid gap-3">
          <Button type="button" variant="outline" disabled={disabled} className="h-auto justify-start rounded-[18px] px-4 py-4 text-left" onClick={() => onAccept("A")}>选择 A：{challenge.optionA}</Button>
          <Button type="button" variant="outline" disabled={disabled} className="h-auto justify-start rounded-[18px] px-4 py-4 text-left" onClick={() => onAccept("B")}>选择 B：{challenge.optionB}</Button>
        </div>
      </div>
    </ModalShell>
  )
}

function RecentChallengesModal({ open, challenges, onClose, currentUserId }: { open: boolean; challenges: YinYangChallengeCard[]; onClose: () => void; currentUserId: number | null }) {
  if (!open) return null

  return (
    <ModalShell title="我的近期挑战" description="查看最近参与的挑战结果、彩头、奖励与答案记录。" onClose={onClose} size="lg">
      <div className="space-y-3 text-sm">
        {challenges.length === 0 ? <EmptyState text="你还没有参与过阴阳契挑战。" /> : challenges.map((challenge) => {
          const opponentName = currentUserId === challenge.creatorId
            ? (challenge.challengerName ?? "暂无对手")
            : currentUserId === challenge.challengerId
              ? challenge.creatorName
              : (challenge.challengerName ?? challenge.creatorName)

          return (
            <div key={challenge.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{challenge.question}</div>
                <span className="text-xs text-muted-foreground">{formatYinYangChallengeTime(challenge.settledAt ?? challenge.createdAt)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>对方：{opponentName}</span>
                <span>状态：{resolveStatusText(challenge.status)}</span>
                <span>彩头：{formatCompactPointValue(challenge.stakePoints)}</span>
                <span>奖励：{formatCompactPointValue(challenge.rewardPoints)}</span>
                {challenge.selectedOption ? <span>应战选择：{challenge.selectedOption}</span> : null}
                {challenge.correctOption ? <span>正确答案：{challenge.correctOption}</span> : null}
              </div>
            </div>
          )
        })}
      </div>
    </ModalShell>
  )
}

function WinnerLeaderboardModal({ open, items, onClose }: { open: boolean; items: YinYangLeaderboardUser[]; onClose: () => void }) {
  if (!open) return null

  return (
    <ModalShell title="赢家排行榜" description="按胜场优先排序，展示最能赢下挑战的玩家。" onClose={onClose} size="lg">
      <LeaderboardList items={items} getMetric={(item) => `胜 ${item.winCount} · 负 ${item.loseCount} · 胜率 ${(item.winRate * 100).toFixed(1)}%`} />
    </ModalShell>
  )
}

function EarnerLeaderboardModal({ open, items, onClose }: { open: boolean; items: YinYangLeaderboardUser[]; onClose: () => void }) {
  if (!open) return null

  return <EarnerLeaderboardModalBody items={items} onClose={onClose} />
}

function EarnerLeaderboardModalBody({ items, onClose }: { items: YinYangLeaderboardUser[]; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<EarnerTab>("today-profit")

  const tabConfig: Array<{ id: EarnerTab; label: string }> = [
    { id: "today-profit", label: "今日盈利" },
    { id: "today-loss", label: "今日亏损" },
    { id: "total-profit", label: "总盈利" },
    { id: "total-loss", label: "总亏损" },
  ]

  const sortedItems = [...items].sort((left, right) => {
    if (activeTab === "today-profit") return right.todayProfitPoints - left.todayProfitPoints || left.todayLossPoints - right.todayLossPoints
    if (activeTab === "today-loss") return right.todayLossPoints - left.todayLossPoints || right.loseCount - left.loseCount
    if (activeTab === "total-profit") return right.totalProfitPoints - left.totalProfitPoints || left.totalLossPoints - right.totalLossPoints
    return right.totalLossPoints - left.totalLossPoints || right.loseCount - left.loseCount
  })

  const metricText = (item: YinYangLeaderboardUser) => {
    if (activeTab === "today-profit") return `今日盈利 ${formatCompactPointValue(item.todayProfitPoints)}`
    if (activeTab === "today-loss") return `今日亏损 ${formatCompactPointValue(item.todayLossPoints)}`
    if (activeTab === "total-profit") return `总盈利 ${formatCompactPointValue(item.totalProfitPoints)}`
    return `总亏损 ${formatCompactPointValue(item.totalLossPoints)}`
  }

  return (
    <ModalShell title="赚积分排行榜" description="按今日与历史盈亏维度查看最会赚、最敢赌的玩家。" onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {tabConfig.map((tab) => (
            <Button key={tab.id} type="button" variant={activeTab === tab.id ? "default" : "outline"} className="rounded-full" onClick={() => setActiveTab(tab.id)}>{tab.label}</Button>
          ))}
        </div>
        <LeaderboardList items={sortedItems} getMetric={metricText} />
      </div>
    </ModalShell>
  )
}

function LeaderboardList({ items, getMetric }: { items: YinYangLeaderboardUser[]; getMetric: (item: YinYangLeaderboardUser) => string }) {
  if (items.length === 0) {
    return <EmptyState text="暂无排行数据。" />
  }

  return (
    <div className="space-y-3 text-sm">
      {items.map((item, index) => {
        const isTopThree = index < 3
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null
        return (
          <div
            key={`leaderboard-${item.userId}-${index}`}
            className={`flex items-center justify-between gap-3 rounded-[18px] px-4 py-3 ${
              isTopThree
                ? "border border-amber-200/70 bg-linear-to-r from-amber-50 via-background to-amber-50 shadow-[0_10px_30px_rgba(245,158,11,0.08)] dark:border-amber-400/28 dark:from-amber-500/16 dark:via-slate-950 dark:to-orange-400/12 dark:shadow-[0_18px_44px_rgba(245,158,11,0.16)]"
                : "border border-border/70 bg-muted/90 dark:bg-muted/75"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                  isTopThree
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-400/18 dark:text-amber-50 dark:ring-1 dark:ring-amber-300/30"
                    : "bg-background text-muted-foreground dark:bg-background/80 dark:text-foreground/70"
                }`}
              >
                {medal ?? `#${index + 1}`}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${isTopThree ? "dark:text-amber-50" : ""}`}>{item.userName}</span>
                  {item.badge ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        isTopThree
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-400/18 dark:text-amber-50 dark:ring-1 dark:ring-amber-300/25"
                          : "bg-background text-muted-foreground dark:bg-background/80 dark:text-foreground/70"
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <div className={`mt-1 text-xs ${isTopThree ? "text-amber-800/80 dark:text-amber-100/80" : "text-muted-foreground"}`}>
                  {getMetric(item)}
                </div>
              </div>
            </div>
            {isTopThree ? (
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-600 dark:text-amber-200">Top {index + 1}</div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function ModalShell({ title, description, children, onClose, size = "md" }: { title: string; description: string; children: React.ReactNode; onClose: () => void; size?: "md" | "lg" }) {
  return (
    <div className="fixed inset-0 z-65 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <div className={`w-full rounded-xl border border-border bg-background shadow-[0_30px_80px_rgba(15,23,42,0.24)] ${size === "lg" ? "max-w-3xl" : "max-w-xl"}`}>
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <Button type="button" variant="ghost" className="rounded-full" onClick={onClose}>关闭</Button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function StatCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "green" | "red" }) {
  const className = tone === "green" ? "text-emerald-600" : tone === "red" ? "text-rose-600" : "text-foreground"
  return (
    <div className="rounded-[16px] bg-muted p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${className}`}>{value}</div>
    </div>
  )
}

function Field({ label, children, action, hint }: { label: string; children: React.ReactNode; action?: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="flex items-center justify-between gap-3 text-sm font-medium text-foreground">
        <span>{label}</span>
        <span className="flex items-center gap-3">
          {hint}
          {action}
        </span>
      </span>
      {children}
    </label>
  )
}





function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[16px] bg-muted p-4 text-sm text-muted-foreground">{text}</div>
}

function AnimatedCardTitle({ previousKing, currentKing }: { previousKing: string | null; currentKing: string | null }) {
  return (
    <div className="relative overflow-hidden rounded-[18px] border border-amber-200/60 bg-linear-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.28),transparent_45%),radial-gradient(circle_at_bottom,rgba(96,165,250,0.22),transparent_40%)]" />
      <div className="absolute inset-y-0 left-[-20%] w-1/3 skew-x-[-20deg] animate-[pulse_2.4s_ease-in-out_infinite] bg-linear-to-r from-transparent via-white/10 to-transparent" />
      <div className="relative space-y-2 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold tracking-[0.24em] text-amber-100">
          <span className="text-amber-300 animate-[pulse_1.8s_ease-in-out_infinite]">✦</span>
          <span className="bg-linear-to-r from-amber-200 via-white to-sky-200 bg-clip-text text-transparent">阴阳契 - 命定双生</span>
          <span className="text-sky-300 animate-[pulse_1.8s_ease-in-out_infinite]">✦</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-200/90">
          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1">昨日阴阳王：{previousKing ?? "暂无"}</span>
          <span className="rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1">今日阴阳王：{currentKing ?? "暂无"}</span>
        </div>
      </div>
    </div>
  )
}

function ResultFxOverlay({ state, onClose }: { state: ResultFxState; onClose: () => void }) {
  if (!state) {
    return null
  }

  const isWin = state.type === "win"

  return (
    <div className="pointer-events-none fixed inset-0 z-70 flex items-center justify-center overflow-hidden">
      <div className={`absolute inset-0 ${isWin ? "bg-emerald-500/18" : "bg-slate-950/30"} backdrop-blur-[2px]`} />
      <div className="absolute inset-0 overflow-hidden">
        {isWin ? Array.from({ length: 18 }).map((_, index) => (
          <span
            key={`win-${index}`}
            className="absolute h-3 w-3 animate-[ping_1.8s_ease-in-out_infinite] rounded-full bg-amber-300/80 shadow-[0_0_18px_rgba(251,191,36,0.9)]"
            style={{ left: `${6 + (index * 5) % 88}%`, top: `${8 + (index * 11) % 78}%`, animationDelay: `${index * 80}ms` }}
          />
        )) : Array.from({ length: 12 }).map((_, index) => (
          <span
            key={`lose-${index}`}
            className="absolute h-10 w-10 animate-bounce rounded-full border border-sky-200/30 bg-sky-100/10"
            style={{ left: `${10 + (index * 7) % 80}%`, top: `${12 + (index * 9) % 70}%`, animationDuration: `${1.8 + (index % 3) * 0.15}s`, animationDelay: `${index * 90}ms` }}
          />
        ))}
      </div>
      <div className={`relative mx-4 w-full max-w-md rounded-xl border px-6 py-7 text-center shadow-[0_28px_80px_rgba(15,23,42,0.28)] ${isWin ? "border-emerald-200/70 bg-linear-to-br from-emerald-50 via-white to-amber-50" : "border-slate-300/70 bg-linear-to-br from-slate-50 via-white to-sky-50"}`}>
        <button type="button" className="pointer-events-auto absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-sm text-muted-foreground" onClick={onClose}>×</button>
        <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full text-5xl shadow-inner ${isWin ? "bg-emerald-100 text-emerald-600 animate-[pulse_1.1s_ease-in-out_infinite]" : "bg-sky-100 text-sky-500 animate-[bounce_1.6s_ease-in-out_infinite]"}`}>{isWin ? "✦" : "☾"}</div>
        <h3 className={`mt-5 text-2xl font-black tracking-tight ${isWin ? "text-emerald-700" : "text-slate-700"}`}>{state.title}</h3>
        <p className={`mt-2 text-sm ${isWin ? "text-emerald-700/80" : "text-slate-600"}`}>{state.detail}</p>
        <div className={`mx-auto mt-4 h-1.5 w-28 rounded-full ${isWin ? "bg-linear-to-r from-emerald-400 via-amber-300 to-emerald-500" : "bg-linear-to-r from-slate-300 via-sky-200 to-slate-400"}`} />
      </div>
    </div>
  )
}

function resolveStatusText(status: YinYangChallengeCard["status"]) {
  if (status === "OPEN") return "待应战"
  if (status === "LOCKED") return "结算中"
  if (status === "SETTLED") return "已结算"
  return "已取消"
}
