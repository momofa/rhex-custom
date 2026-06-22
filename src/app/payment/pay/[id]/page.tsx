import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { AlertCircle, ArrowLeft, CheckCircle2, CreditCard, ExternalLink, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { buildLoginHrefWithRedirect } from "@/lib/auth-redirect"
import { formatDateTime } from "@/lib/formatters"
import { getPaymentCheckoutPageData } from "@/lib/payment-applications"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"

interface PaymentPayPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `确认支付 - ${settings.siteName}`,
  }
}

export default async function PaymentPayPage(props: PaymentPayPageProps) {
  const [{ id }, searchParams, currentUser, settings] = await Promise.all([
    props.params,
    props.searchParams,
    getCurrentUser(),
    getSiteSettings(),
  ])
  const transactionId = id
  const currentPath = `/payment/pay/${encodeURIComponent(transactionId)}`

  if (!currentUser) {
    redirect(buildLoginHrefWithRedirect(currentPath))
  }

  const errorMessage = readSearchParam(searchParams.error) ?? ""
  const data = await getPaymentCheckoutPageData(transactionId)

  if (!data) {
    return (
      <PaymentShell>
        <Card className="w-full">
          <CardHeader className="border-b">
            <CardTitle>支付订单不存在</CardTitle>
            <CardDescription>请返回发起支付的网站重新下单。</CardDescription>
          </CardHeader>
          <CardFooter className="justify-end">
            <Button type="button" variant="outline" nativeButton={false} render={<Link href="/" />}>
              返回首页
            </Button>
          </CardFooter>
        </Card>
      </PaymentShell>
    )
  }

  if (currentUser.status !== "ACTIVE") {
    return (
      <PaymentShell>
        <Card className="w-full">
          <CardHeader className="border-b">
            <CardTitle>账号状态不可支付</CardTitle>
            <CardDescription>当前账号不是正常状态，无法完成第三方支付。</CardDescription>
          </CardHeader>
          <CardFooter className="justify-end">
            <Button type="button" variant="outline" nativeButton={false} render={<Link href="/" />}>
              返回首页
            </Button>
          </CardFooter>
        </Card>
      </PaymentShell>
    )
  }

  const insufficient = data.status === "pending" && currentUser.points < data.amount

  return (
    <PaymentShell>
      <Card className="w-full overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex min-w-0 flex-col gap-2">
            <Badge variant={data.status === "completed" ? "secondary" : data.expired ? "outline" : "default"} className="w-fit">
              {getPaymentStatusText(data.status, data.expired)}
            </Badge>
            <CardTitle>确认支付给 {data.application.name}</CardTitle>
            <CardDescription>
              这笔支付将使用你的 {settings.pointName} 余额完成，支付成功后浏览器会跳回商户回调地址。
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 py-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="flex flex-col gap-4">
            {errorMessage ? (
              <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            ) : null}

            <section className="rounded-xl border border-border bg-muted/25 px-4 py-3">
              <p className="text-xs text-muted-foreground">订单说明</p>
              <p className="mt-2 text-base font-semibold">{data.description}</p>
              <p className="mt-2 break-all text-xs text-muted-foreground">商户订单号：{data.externalReference}</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">交易 ID：{data.transactionId}</p>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="支付金额" value={`${data.amount} ${settings.pointName}`} />
              <MetricCard label="平台手续费" value={`${data.platformFee} ${settings.pointName}`} />
            </section>

            <section className="rounded-xl border border-border px-4 py-3 text-sm leading-6 text-muted-foreground">
              <p className="font-medium text-foreground">支付安全提示</p>
              <p className="mt-1">
                确认商户名称和订单说明无误后再支付。支付完成后商户会收到带签名的浏览器 GET 回调。
              </p>
            </section>
          </div>

          <aside className="flex flex-col gap-3 rounded-xl border border-border bg-muted/25 px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-muted-foreground" />
              <p className="font-medium">当前账号</p>
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{currentUser.nickname ?? currentUser.username}</p>
              <p className="truncate text-xs text-muted-foreground">@{currentUser.username}</p>
              <p className="mt-2 text-xs text-muted-foreground">余额：{currentUser.points} {settings.pointName}</p>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">商户</p>
              <p className="mt-1 truncate font-medium">{data.application.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">申请人：{data.application.ownerDisplayName}</p>
              {data.application.homepageUrl ? (
                <Link href={data.application.homepageUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs hover:underline">
                  查看商户网站
                  <ExternalLink data-icon="inline-end" />
                </Link>
              ) : null}
            </div>

            <div className="border-t border-border pt-3 text-xs text-muted-foreground">
              <p>创建：{formatDateTime(data.createdAt)}</p>
              <p className="mt-1">过期：{formatDateTime(data.expiresAt)}</p>
              {data.paidAt ? <p className="mt-1">支付：{formatDateTime(data.paidAt)}</p> : null}
            </div>
          </aside>
        </CardContent>

        <CardFooter className="justify-between gap-3">
          <Button type="button" variant="outline" nativeButton={false} render={<Link href="/" />}>
            <ArrowLeft data-icon="inline-start" />
            返回首页
          </Button>

          {data.status === "completed" ? (
            data.callbackUrl ? (
              <Button type="button" nativeButton={false} render={<Link href={data.callbackUrl} />}>
                <CheckCircle2 data-icon="inline-start" />
                返回商户
              </Button>
            ) : (
              <Badge variant="secondary">已支付</Badge>
            )
          ) : (
            <form action={`/payment/pay/${encodeURIComponent(data.transactionId)}/confirm`} method="post">
              <Button type="submit" disabled={data.expired || insufficient || data.status !== "pending"}>
                <CreditCard data-icon="inline-start" />
                {insufficient ? `${settings.pointName}不足` : data.expired ? "订单已过期" : "确认支付"}
              </Button>
            </form>
          )}
        </CardFooter>
      </Card>
    </PaymentShell>
  )
}

function PaymentShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-4xl items-center px-4 py-6">
      {children}
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  )
}

function getPaymentStatusText(status: string, expired: boolean) {
  if (expired) {
    return "已过期"
  }

  if (status === "completed") {
    return "已支付"
  }

  if (status === "processing") {
    return "处理中"
  }

  if (status === "failed") {
    return "支付失败"
  }

  if (status === "cancelled") {
    return "已取消"
  }

  if (status === "refunded") {
    return "已退款"
  }

  return "待支付"
}
