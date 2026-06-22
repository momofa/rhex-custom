
import { FaqPageFrame } from "@/components/faq-page-frame"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { resolveSiteOrigin } from "@/lib/site-origin"
import { buildFaqMetadata } from "@/lib/faq"


export async function generateMetadata() {
  return buildFaqMetadata("RSS 订阅指南", "了解站点 RSS 的用途、订阅方式，以及系统当前支持的所有 RSS 地址。")
}

function buildAbsoluteUrl(origin: string, path: string) {
  return new URL(path, `${origin}/`).toString()
}

export default async function FaqRssGuidePage() {
  const [origin] = await Promise.all([
    resolveSiteOrigin()
  ])

  const globalFeeds = [
    {
      label: "全站最新帖子",
      path: "/rss.xml",
      description: "订阅整个站点最新发布的公开帖子。",
    },
  ]

  return (
    <FaqPageFrame
      currentPath="/faq/rss-guide"
      eyebrow="RSS Guide"
      title="RSS 订阅指南"
      description="RSS 可以让你在阅读器里持续跟踪站点内容更新，不需要反复打开页面手动刷新。"
    >

      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>固定 RSS 地址</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {globalFeeds.map((feed) => (
              <div key={feed.path} className="rounded-xl border border-border bg-secondary/30 p-4">
                <p className="font-semibold text-foreground">{feed.label}</p>
                <p className="mt-2 break-all font-mono text-xs text-foreground">{buildAbsoluteUrl(origin, feed.path)}</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{feed.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>动态 RSS 地址规则</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              {
                label: "分区 RSS",
                rule: `${origin}/zones/{zone-slug}/rss.xml`,
                description: "适合按分区订阅。每个已存在的分区都有一条对应的 RSS。",
              },
              {
                label: "节点 RSS",
                rule: `${origin}/boards/{board-slug}/rss.xml`,
                description: "适合只跟踪某个节点的帖子更新。",
              },
              {
                label: "标签 RSS",
                rule: `${origin}/tags/{tag-slug}/rss.xml`,
                description: "适合订阅某个话题标签下的最新帖子。",
              },
              {
                label: "用户 RSS",
                rule: `${origin}/users/{username}/rss.xml`,
                description: "适合订阅某个用户公开发布的最新帖子。",
              },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-card p-4">
                <p className="font-semibold text-foreground">{item.label}</p>
                <p className="mt-2 break-all font-mono text-xs text-foreground">{item.rule}</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>


    </FaqPageFrame>
  )
}
