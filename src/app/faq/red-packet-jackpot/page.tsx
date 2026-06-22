import { FaqPageFrame } from "@/components/faq-page-frame"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildFaqMetadata } from "@/lib/faq"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata() {
  return buildFaqMetadata("红包与聚宝盆", "查看帖子红包和聚宝盆的触发方式、限制条件、中奖规则和当前站点数值。")
}

export default async function RedPacketJackpotFaqPage() {
  const settings = await getSiteSettings()

  const comparisonItems = [
    {
      title: "帖子红包",
      description: `发帖人一次性投入 ${settings.pointName}，在指定互动行为发生后按规则发放给参与者。`,
    },
    {
      title: "聚宝盆",
      description: `发帖时先放入初始 ${settings.pointName}，后续回复会继续向积分池累加，并按概率抽取当前池内奖励。`,
    },
    {
      title: "互斥关系",
      description: "同一帖子里只能二选一。你要么配置帖子红包，要么配置聚宝盆，不能同时开启。",
    },
  ]

  const redPacketRules = [
    `当前站点${settings.postRedPacketEnabled ? "已开启" : "未开启"}帖子红包功能。`,
    `红包支持按回复、点赞、收藏三种互动条件触发，具体由发帖人发布时选择。`,
    `固定红包单个最高不能超过 ${settings.postRedPacketMaxPoints} ${settings.pointName}。`,
    `拼手气红包总额最高不能超过 ${settings.postRedPacketMaxPoints} ${settings.pointName}，且总积分不能小于份数。`,
    `同一发帖人每日发红包累计上限为 ${settings.postRedPacketDailyLimit} ${settings.pointName}。`,
    settings.postRedPacketRandomClaimProbability > 0
      ? `当红包使用“随机名额”模式时，当前触发用户的基础命中概率固定为 ${settings.postRedPacketRandomClaimProbability}%，未命中则本次无人领取。`
      : "当红包使用“随机名额”模式时，当前触发用户的基础命中概率按候选人数均分。",
    "普通红包仍然遵循“一人一次”的领取逻辑，已经领过同一帖红包的用户不会再次领取。",
  ]

  const jackpotRules = [
    `当前站点${settings.postJackpotEnabled ? "已开启" : "未开启"}聚宝盆功能。`,
    `发帖时必须先投入初始 ${settings.pointName}，当前允许范围为 ${settings.postJackpotMinInitialPoints} 到 ${settings.postJackpotMaxInitialPoints}。`,
    `用户首次有效回复会向积分池追加 ${settings.postJackpotReplyIncrementPoints} ${settings.pointName}。`,
    `同一用户后续再次回复时，只会追加“小于 ${settings.postJackpotReplyIncrementPoints}”的随机整数少量积分。`,
    settings.postJackpotHitProbability >= 100
      ? "当前聚宝盆基础概率为 100%，有效回复会必中；命中奖励仍按当前积分池随机结算。"
      : `用户首次回复按 ${settings.postJackpotHitProbability}% 的基础概率抽奖；再次回复概率会明显下降。`,
    settings.postJackpotHitProbability >= 100
      ? "已经中过奖的用户，后续再次有效回复仍会继续命中，直到积分池归零。"
      : "已经中过奖的用户，后续再次回复仍然可能继续中奖，但概率会继续衰减。",
    "楼主自己的回复不会触发追加积分，也不会中奖。",
    "当积分池归零后，聚宝盆结束，后续回复不会再继续加池或抽奖。",
    `每次命中时，奖励会从“当前积分池”里随机结算，最少 1 ${settings.pointName}，最多可直接拿走当前池内全部 ${settings.pointName}。`,
  ]

  const auditItems = [
    `发布帖子红包或聚宝盆时，会先扣除发帖人对应的 ${settings.pointName}。`,
    `成功领取红包或命中聚宝盆后，系统会增加用户余额，并写入 ${settings.pointName} 日志。`,
    "红包和聚宝盆的领取记录会保留在帖子详情面板里，方便回看谁在什么时候拿到了多少。",
  ]

  return (
    <FaqPageFrame
      currentPath="/faq/red-packet-jackpot"
      eyebrow="Reward Pool"
      title="红包与聚宝盆"
      description={`帖子红包和聚宝盆都属于帖子激励池，但两者的预算结构、触发逻辑和发放节奏不同。这里展示的是当前站点实际启用中的规则。`}
    >
      <section className="grid gap-4 lg:grid-cols-3">
        {comparisonItems.map((item) => (
          <Card key={item.title}>
            <CardContent className="p-5">
              <p className="font-semibold">{item.title}</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>帖子红包规则</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {redPacketRules.map((item) => (
              <div key={item} className="rounded-xl bg-secondary/40 p-4 text-sm leading-7 text-muted-foreground">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>聚宝盆规则</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {jackpotRules.map((item) => (
              <div key={item} className="rounded-xl bg-secondary/40 p-4 text-sm leading-7 text-muted-foreground">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>当前站点关键数值</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border px-4 py-4">
            <p className="text-xs text-muted-foreground">红包单次上限</p>
            <p className="mt-2 font-semibold">{settings.postRedPacketMaxPoints} {settings.pointName}</p>
          </div>
          <div className="rounded-xl border border-border px-4 py-4">
            <p className="text-xs text-muted-foreground">每日红包上限</p>
            <p className="mt-2 font-semibold">{settings.postRedPacketDailyLimit} {settings.pointName}</p>
          </div>
          <div className="rounded-xl border border-border px-4 py-4">
            <p className="text-xs text-muted-foreground">聚宝盆初始范围</p>
            <p className="mt-2 font-semibold">{settings.postJackpotMinInitialPoints} - {settings.postJackpotMaxInitialPoints} {settings.pointName}</p>
          </div>
  
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>资金流与审计</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {auditItems.map((item) => (
            <div key={item} className="rounded-xl bg-secondary/40 p-4 text-sm leading-7 text-muted-foreground">
              {item}
            </div>
          ))}
        </CardContent>
      </Card>
    </FaqPageFrame>
  )
}
