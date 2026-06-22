"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, Code2, Copy, CreditCard, KeyRound, Plus, ReceiptText, RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FormModal, Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { PageNumberPagination } from "@/components/page-number-pagination"
import { formatCompactPointValue, formatDateTime, formatNumber } from "@/lib/formatters"
import type { OAuthAuthorizedSiteListItem, OAuthClientListItem } from "@/lib/oauth-server"
import type { PaymentApplicationListItem, PaymentTransactionListItem, PaymentTransactionPageData } from "@/lib/payment-applications"

interface OAuthApplicationsPanelProps {
  enabled: boolean
  oauthServerEnabled: boolean
  oauthClientApplicationEnabled: boolean
  paymentApplicationEnabled: boolean
  clients: OAuthClientListItem[]
  authorizedSites: OAuthAuthorizedSiteListItem[]
  paymentApplications: PaymentApplicationListItem[]
  paymentTransactions: PaymentTransactionPageData
}

interface OAuthClientFormState {
  id?: string
  name: string
  description: string
  homepageUrl: string
  logoUrl: string
  redirectUris: string
  scopes: string[]
}

interface PaymentApplicationFormState {
  id?: string
  name: string
  description: string
  homepageUrl: string
  callbackUrl: string
}

interface SecretOnceState {
  namespace: string
  title: string
  description: string
  warning: string
  refreshOnClose?: boolean
  rows: Array<{
    label: string
    value: string
    copyLabel: string
  }>
}

const scopeOptions = [
  { value: "openid", label: "openid", description: "OAuth/OIDC 基础身份标识，默认必须包含。" },
  { value: "profile", label: "profile", description: "读取用户名、昵称、头像等公开资料。" },
  { value: "email", label: "email", description: "读取邮箱和邮箱验证状态。" },
]

const oauthEndpointRows = [
  { label: "授权地址", value: "GET /oauth/authorize" },
  { label: "Token 地址", value: "POST /oauth/token" },
  { label: "用户信息", value: "GET /oauth/userinfo" },
  { label: "撤销 Token", value: "POST /oauth/revoke" },
]

const authorizationParameterRows = [
  { name: "client_id", description: "应用 appid。" },
  { name: "redirect_uri", description: "必须与应用配置中的回调地址完全一致。" },
  { name: "response_type", description: "固定传 code。" },
  { name: "scope", description: "用空格分隔，例如 openid profile email。" },
  { name: "state", description: "建议必传，用于回调后校验请求来源。" },
  { name: "code_challenge", description: "由 code_verifier 生成的 SHA-256 Base64URL 摘要。" },
  { name: "code_challenge_method", description: "固定传 S256。" },
]

const tokenParameterRows = [
  { name: "grant_type", description: "授权码模式固定传 authorization_code。" },
  { name: "code", description: "授权回调得到的一次性授权码。" },
  { name: "redirect_uri", description: "必须与发起授权时的 redirect_uri 一致。" },
  { name: "code_verifier", description: "发起授权前生成并保存在客户端会话中的 PKCE verifier。" },
  { name: "client_id / client_secret", description: "推荐使用 HTTP Basic 认证，也支持表单字段传入。" },
]

const oauthDemoCode = `#!/usr/bin/env node

import { spawn } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { createServer } from "node:http"

// 固定配置：把这里替换成你创建 OAuth 应用后拿到的值，不使用 .env。
const issuer = "http://localhost:3000"
const clientId = "app_demo_client_id"
const clientSecret = "key_demo_client_secret"
const redirectUri = "http://localhost:8787/callback"
const scope = "openid profile email"
const shouldOpenBrowser = true

if (typeof fetch !== "function") {
  throw new Error("需要 Node.js 18+，因为示例直接使用全局 fetch。")
}

const redirectUrl = new URL(redirectUri)
if (redirectUrl.protocol !== "http:") {
  throw new Error("本地最小 demo 只监听 http:// 回调地址。")
}

// PKCE：code_verifier 留在本地，授权页只传 code_challenge。
const state = randomToken(24)
const codeVerifier = randomToken(64)
const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url")

const authorizeUrl = new URL("/oauth/authorize", issuer)
authorizeUrl.searchParams.set("client_id", clientId)
authorizeUrl.searchParams.set("redirect_uri", redirectUri)
authorizeUrl.searchParams.set("response_type", "code")
authorizeUrl.searchParams.set("scope", scope)
authorizeUrl.searchParams.set("state", state)
authorizeUrl.searchParams.set("code_challenge", codeChallenge)
authorizeUrl.searchParams.set("code_challenge_method", "S256")

const callback = await startCallbackServer({ redirectUrl, expectedState: state })

console.log("OAuth 登录示例已启动。")
console.log("回调地址：", redirectUri)
console.log("授权地址：", authorizeUrl.toString())

if (shouldOpenBrowser) {
  openBrowser(authorizeUrl.toString())
}

// 用户登录并同意授权后，浏览器会跳回 redirectUri，并携带 code 和 state。
const code = await callback.codePromise
console.log("已收到授权码，开始换取 token。")

const token = await postForm(new URL("/oauth/token", issuer), {
  grant_type: "authorization_code",
  code,
  redirect_uri: redirectUri,
  code_verifier: codeVerifier,
}, basicAuthHeader(clientId, clientSecret))

console.log("Token 响应：")
console.log(JSON.stringify(maskTokenResponse(token), null, 2))

const userinfo = await getJson(new URL("/oauth/userinfo", issuer), {
  Authorization: "Bearer " + token.access_token,
})

console.log("用户信息：")
console.log(JSON.stringify(userinfo, null, 2))

function randomToken(bytes) {
  return randomBytes(bytes).toString("base64url")
}

function startCallbackServer({ redirectUrl, expectedState }) {
  let settle
  const codePromise = new Promise((resolveCode, rejectCode) => {
    settle = { resolveCode, rejectCode }
  })

  const server = createServer((request, response) => {
    const currentUrl = new URL(request.url || "/", redirectUrl.origin)

    if (currentUrl.pathname !== redirectUrl.pathname) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      response.end("Not found")
      return
    }

    const error = currentUrl.searchParams.get("error")
    if (error) {
      const description = currentUrl.searchParams.get("error_description") || error
      response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" })
      response.end("<h1>OAuth error</h1><pre>" + escapeHtml(description) + "</pre>")
      settle.rejectCode(new Error("OAuth error: " + description))
      return
    }

    const returnedState = currentUrl.searchParams.get("state")
    if (returnedState !== expectedState) {
      response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" })
      response.end("<h1>Invalid state</h1>")
      settle.rejectCode(new Error("OAuth state mismatch."))
      return
    }

    const code = currentUrl.searchParams.get("code")
    if (!code) {
      response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" })
      response.end("<h1>Missing code</h1>")
      settle.rejectCode(new Error("OAuth callback did not include code."))
      return
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    response.end("<h1>Login complete</h1><p>可以回到终端查看结果。</p>")
    settle.resolveCode(code)
  })

  const timeout = setTimeout(() => {
    settle.rejectCode(new Error("等待 OAuth 回调超时。"))
  }, 5 * 60 * 1000)

  codePromise.finally(() => {
    clearTimeout(timeout)
    server.close()
  }).catch(() => {})

  const listenPromise = new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen)
    server.listen(Number(redirectUrl.port || 80), redirectUrl.hostname, resolveListen)
  })

  return listenPromise.then(() => ({ codePromise }))
}

function basicAuthHeader(id, secret) {
  const value = encodeURIComponent(id) + ":" + encodeURIComponent(secret)
  return "Basic " + Buffer.from(value).toString("base64")
}

async function postForm(url, fields, authorization) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields),
  })

  return parseJsonResponse(response)
}

async function getJson(url, headers) {
  const response = await fetch(url, { headers })
  return parseJsonResponse(response)
}

async function parseJsonResponse(response) {
  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error("HTTP " + response.status + ": " + JSON.stringify(data))
  }

  return data
}

function maskTokenResponse(token) {
  return {
    ...token,
    access_token: maskSecret(token.access_token),
    refresh_token: maskSecret(token.refresh_token),
  }
}

function maskSecret(value) {
  if (typeof value !== "string" || value.length <= 12) {
    return value
  }

  return value.slice(0, 6) + "..." + value.slice(-6)
}

function openBrowser(url) {
  const command = process.platform === "win32" ? "rundll32" : process.platform === "darwin" ? "open" : "xdg-open"
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url]
  const child = spawn(command, args, { detached: true, stdio: "ignore" })
  child.unref()
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
}`

const paymentEndpointRows = [
  { label: "发起支付", value: "POST /payment/pay/:payment_id/process" },
  { label: "跳转支付", value: "GET /payment/pay/:transaction_id" },
  { label: "查询状态", value: "POST /payment/query/:payment_id" },
  { label: "支付回调", value: "GET 你的 callback_url" },
]

const paymentTransactionStatusOptions = [
  { value: "ALL", label: "全部状态" },
  { value: "PENDING", label: "待支付" },
  { value: "PROCESSING", label: "处理中" },
  { value: "COMPLETED", label: "已完成" },
  { value: "FAILED", label: "失败" },
  { value: "CANCELLED", label: "已取消" },
  { value: "REFUNDED", label: "已退款" },
]

const paymentCreateParameterRows = [
  { name: "amount", description: "支付金额，单位为站内积分，必须是大于 0 的整数。" },
  { name: "description", description: "交易描述，会展示给用户确认。" },
  { name: "order_id", description: "你的业务订单号，同一 Payment 应用下必须唯一。" },
  { name: "signature", description: "HMAC-SHA256 签名，签名参数为 amount、description、order_id。" },
]

const paymentCallbackParameterRows = [
  { name: "transaction_id", description: "本站生成的交易 ID。" },
  { name: "external_reference", description: "你的业务订单号，即发起支付时的 order_id。" },
  { name: "amount / platform_fee", description: "支付金额和平台手续费，单位为站内积分。" },
  { name: "status / paid_at", description: "支付状态和支付完成时间。" },
  { name: "signature", description: "回调签名，商户必须验证后再发货或开通服务。" },
]

const oauthFlowSteps = [
  "生成 PKCE code_verifier 和 code_challenge。",
  "跳转 /oauth/authorize，请求 code 和授权范围。",
  "回调地址收到 code 与 state 后，先校验 state。",
  "服务端 POST /oauth/token 换取 access_token。",
  "携带 Bearer access_token 请求 /oauth/userinfo。",
]

const paymentFlowSteps = [
  "按 amount、description、order_id 生成 HMAC-SHA256 签名。",
  "POST /payment/pay/:payment_id/process 创建交易。",
  "跳转 payment_url，让用户在本站登录并确认支付。",
  "支付成功后浏览器跳回 callback_url，并携带签名参数。",
  "回调丢失时可 POST /payment/query/:payment_id 主动查询。",
]

const paymentDemoCode = `#!/usr/bin/env node

import { spawn } from "node:child_process"
import { createHash, createHmac } from "node:crypto"
import { createServer } from "node:http"

// 固定配置：把这里替换成你创建 Payment 应用后拿到的值，不使用 .env。
const baseUrl = "http://localhost:3000"
const paymentId = "pay_demo_payment_id"
const secretKey = "tk_demo_secret_key"
const callbackUrl = "http://localhost:8788/payment-callback"

// 演示订单：order_id 在同一个 Payment 应用下必须唯一。
const order = {
  amount: 1,
  description: "Node.js 最小 Payment Demo",
  order_id: "demo_" + Date.now(),
}

if (typeof fetch !== "function") {
  throw new Error("需要 Node.js 18+，因为示例直接使用全局 fetch。")
}

const callbackServer = await startCallbackServer({ callbackUrl, secretKey })
const checkout = await postJson(baseUrl + "/payment/pay/" + encodeURIComponent(paymentId) + "/process", {
  ...order,
  signature: signPaymentParams(secretKey, order),
})

console.log("支付链接：", checkout.payment_url)
openBrowser(checkout.payment_url)

// 用户在 NodeLoc 登录并支付后，浏览器会跳回 callbackUrl。
const callbackParams = await callbackServer.callbackPromise
console.log("已收到并验证回调：")
console.log(JSON.stringify(callbackParams, null, 2))

// 可选：主动查询支付状态，适合回调丢失或用户关闭浏览器时兜底。
const queryPayload = {
  transaction_id: callbackParams.transaction_id || checkout.transaction_id,
}
const queryResult = await postJson(baseUrl + "/payment/query/" + encodeURIComponent(paymentId), {
  ...queryPayload,
  signature: signPaymentParams(secretKey, queryPayload),
})

console.log("查询结果：")
console.log(JSON.stringify(queryResult, null, 2))

function buildSignaturePayload(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => key + "=" + String(value))
    .join("&")
}

function signPaymentParams(secret, params) {
  // NodeLoc Payment 使用 SHA256(Secret Key) 作为 HMAC key。
  const hmacKey = createHash("sha256").update(secret, "utf8").digest("hex")
  return createHmac("sha256", hmacKey)
    .update(buildSignaturePayload(params), "utf8")
    .digest("hex")
}

function verifyCallbackSignature(secret, params) {
  const { signature, ...signedParams } = params
  if (typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false
  }

  return signPaymentParams(secret, signedParams).toLowerCase() === signature.toLowerCase()
}

function startCallbackServer({ callbackUrl, secretKey }) {
  const url = new URL(callbackUrl)
  if (url.protocol !== "http:") {
    throw new Error("本地最小 demo 只监听 http:// 回调地址。")
  }

  let settle
  const callbackPromise = new Promise((resolveCallback, rejectCallback) => {
    settle = { resolveCallback, rejectCallback }
  })

  const server = createServer((request, response) => {
    const currentUrl = new URL(request.url || "/", url.origin)
    if (currentUrl.pathname !== url.pathname) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      response.end("Not found")
      return
    }

    const params = Object.fromEntries(currentUrl.searchParams.entries())
    if (!verifyCallbackSignature(secretKey, params)) {
      response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" })
      response.end("<h1>Payment callback signature invalid</h1>")
      settle.rejectCallback(new Error("Payment callback signature invalid."))
      return
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    response.end("<h1>Payment callback verified</h1><p>可以回到终端查看结果。</p>")
    settle.resolveCallback(params)
  })

  const listenPromise = new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen)
    server.listen(Number(url.port || 80), url.hostname, resolveListen)
  })

  const timeout = setTimeout(() => {
    settle.rejectCallback(new Error("等待支付回调超时。"))
  }, 10 * 60 * 1000)

  callbackPromise.finally(() => {
    clearTimeout(timeout)
    server.close()
  }).catch(() => {})

  return listenPromise.then(() => ({ callbackPromise }))
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error("HTTP " + response.status + ": " + JSON.stringify(data))
  }

  return data
}

function openBrowser(url) {
  const command = process.platform === "win32" ? "rundll32" : process.platform === "darwin" ? "open" : "xdg-open"
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url]
  const child = spawn(command, args, { detached: true, stdio: "ignore" })
  child.unref()
}`

function getInitialForm(client?: OAuthClientListItem | null): OAuthClientFormState {
  return {
    id: client?.id,
    name: client?.name ?? "",
    description: client?.description ?? "",
    homepageUrl: client?.homepageUrl ?? "",
    logoUrl: client?.logoUrl ?? "",
    redirectUris: client?.redirectUris.join("\n") ?? "",
    scopes: client?.scopes.length ? client.scopes : ["openid", "profile", "email"],
  }
}

function getInitialPaymentForm(application?: PaymentApplicationListItem | null): PaymentApplicationFormState {
  return {
    id: application?.id,
    name: application?.name ?? "",
    description: application?.description ?? "",
    homepageUrl: application?.homepageUrl ?? "",
    callbackUrl: application?.callbackUrl ?? "",
  }
}

export function OAuthApplicationsPanel({
  enabled,
  oauthServerEnabled,
  oauthClientApplicationEnabled,
  paymentApplicationEnabled,
  clients,
  authorizedSites,
  paymentApplications,
  paymentTransactions,
}: OAuthApplicationsPanelProps) {
  const router = useRouter()
  const [editingClient, setEditingClient] = useState<OAuthClientListItem | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingPaymentApplication, setEditingPaymentApplication] = useState<PaymentApplicationListItem | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [secretModal, setSecretModal] = useState<SecretOnceState | null>(null)
  const [isPending, startTransition] = useTransition()

  function openCreateModal() {
    setEditingClient(null)
    setCreateModalOpen(true)
  }

  function openEditModal(client: OAuthClientListItem) {
    setEditingClient(client)
    setCreateModalOpen(true)
  }

  function closeFormModal() {
    if (isPending) {
      return
    }

    setCreateModalOpen(false)
    setEditingClient(null)
  }

  function openPaymentCreateModal() {
    setEditingPaymentApplication(null)
    setPaymentModalOpen(true)
  }

  function openPaymentEditModal(application: PaymentApplicationListItem) {
    setEditingPaymentApplication(application)
    setPaymentModalOpen(true)
  }

  function closePaymentFormModal() {
    if (isPending) {
      return
    }

    setPaymentModalOpen(false)
    setEditingPaymentApplication(null)
  }

  function showOAuthSecret(payload: { clientId: string; clientSecret: string }, options?: { refreshOnClose?: boolean }) {
    setSecretModal({
      namespace: "OAuth 应用",
      title: "请保存 OAuth 应用密钥",
      description: "client_secret 只会显示这一次。关闭弹窗后无法再次查看，只能重置生成新密钥。",
      warning: "请把 client_secret 存到你的服务端环境变量中，不要提交到前端代码或公开仓库。",
      refreshOnClose: options?.refreshOnClose,
      rows: [
        { label: "appid / client_id", value: payload.clientId, copyLabel: "client_id" },
        { label: "key / client_secret", value: payload.clientSecret, copyLabel: "client_secret" },
      ],
    })
  }

  function showPaymentSecret(payload: { paymentId: string; secretKey: string }, options?: { refreshOnClose?: boolean }) {
    setSecretModal({
      namespace: "Payment 应用",
      title: "请保存 Payment 密钥",
      description: "Secret Key 只会显示这一次。关闭弹窗后无法再次查看，只能重置生成新密钥。",
      warning: "请把 Secret Key 存到你的服务端环境变量中。签名时使用 SHA256(Secret Key) 作为 HMAC key。",
      refreshOnClose: options?.refreshOnClose,
      rows: [
        { label: "Payment ID", value: payload.paymentId, copyLabel: "Payment ID" },
        { label: "Secret Key", value: payload.secretKey, copyLabel: "Secret Key" },
      ],
    })
  }

  function closeSecretModal() {
    const shouldRefresh = secretModal?.refreshOnClose

    setSecretModal(null)

    if (shouldRefresh) {
      startTransition(() => {
        router.refresh()
      })
    }
  }

  function resetSecret(client: OAuthClientListItem) {
    startTransition(async () => {
      try {
        const response = await fetch("/api/oauth/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rotate-secret",
            id: client.id,
          }),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok || result?.code !== 0) {
          throw new Error(result?.message ?? "重置密钥失败")
        }

        showOAuthSecret({
          clientId: client.clientId,
          clientSecret: String(result.data?.clientSecret ?? ""),
        }, { refreshOnClose: true })
        toast.success("应用密钥已重置", "OAuth 应用")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "重置密钥失败", "OAuth 应用")
      }
    })
  }

  function resetPaymentSecret(application: PaymentApplicationListItem) {
    startTransition(async () => {
      try {
        const response = await fetch("/api/payment/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rotate-secret",
            id: application.id,
          }),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok || result?.code !== 0) {
          throw new Error(result?.message ?? "重置 Secret Key 失败")
        }

        showPaymentSecret({
          paymentId: application.paymentId,
          secretKey: String(result.data?.secretKey ?? ""),
        }, { refreshOnClose: true })
        toast.success("Payment Secret Key 已重置", "Payment 应用")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "重置 Secret Key 失败", "Payment 应用")
      }
    })
  }

  function revokeConsent(site: OAuthAuthorizedSiteListItem) {
    startTransition(async () => {
      try {
        const response = await fetch("/api/oauth/authorized-sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "revoke",
            clientId: site.clientId,
          }),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok || result?.code !== 0) {
          throw new Error(result?.message ?? "取消授权失败")
        }

        toast.success("已取消授权", "OAuth 授权")
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "取消授权失败", "OAuth 授权")
      }
    })
  }

  const disabledReason = !oauthServerEnabled
    ? "站点 OAuth 授权服务未开启，当前无法申请应用。"
    : !oauthClientApplicationEnabled
      ? "后台已关闭用户申请 OAuth 应用入口。"
      : ""
  const paymentDisabledReason = !paymentApplicationEnabled
    ? "后台已关闭 Payment 功能，当前无法提交或重提 Payment 应用。"
    : ""
  const defaultTab = paymentTransactions.filters.keyword
    || paymentTransactions.filters.status !== "ALL"
    || paymentTransactions.pagination.page > 1
    || paymentTransactions.pagination.pageSize !== 10
    ? "payment"
    : "apps"

  return (
    <div className="flex w-full flex-col gap-4">
      <Tabs defaultValue={defaultTab} className="flex w-full flex-col gap-4">
        <TabsList className="self-start">
          <TabsTrigger value="apps">OAuth 应用</TabsTrigger>
          <TabsTrigger value="payment">Payment 应用</TabsTrigger>
          <TabsTrigger value="authorized">我授权的站点</TabsTrigger>
          <TabsTrigger value="docs">OAuth / Payment 文档</TabsTrigger>
        </TabsList>

        <TabsContent value="apps" className="w-full">
          <OAuthClientAppsCard
            enabled={enabled}
            disabledReason={disabledReason}
            clients={clients}
            isPending={isPending}
            onCreate={openCreateModal}
            onEdit={openEditModal}
            onResetSecret={resetSecret}
          />
        </TabsContent>

        <TabsContent value="payment" className="w-full">
          <div className="flex flex-col gap-4">
            <PaymentApplicationsCard
              enabled={paymentApplicationEnabled}
              disabledReason={paymentDisabledReason}
              applications={paymentApplications}
              isPending={isPending}
              onCreate={openPaymentCreateModal}
              onEdit={openPaymentEditModal}
              onResetSecret={resetPaymentSecret}
            />
            <PaymentTransactionsCard data={paymentTransactions} />
          </div>
        </TabsContent>

        <TabsContent value="authorized" className="w-full">
          <AuthorizedSitesCard
            sites={authorizedSites}
            isPending={isPending}
            onRevoke={revokeConsent}
          />
        </TabsContent>

        <TabsContent value="docs" className="w-full">
          <OAuthIntegrationDocs />
        </TabsContent>
      </Tabs>

      <OAuthClientFormModal
        key={editingClient?.id ?? "new-oauth-client"}
        open={createModalOpen}
        client={editingClient}
        isPending={isPending}
        onClose={closeFormModal}
        onSecret={(payload) => showOAuthSecret(payload, { refreshOnClose: true })}
        startTransition={startTransition}
      />

      <PaymentApplicationFormModal
        key={editingPaymentApplication?.id ?? "new-payment-application"}
        open={paymentModalOpen}
        application={editingPaymentApplication}
        isPending={isPending}
        onClose={closePaymentFormModal}
        onSecret={(payload) => showPaymentSecret(payload, { refreshOnClose: true })}
        startTransition={startTransition}
      />

      <SecretOnceModal secret={secretModal} onClose={closeSecretModal} />
    </div>
  )
}

function OAuthClientAppsCard({
  enabled,
  disabledReason,
  clients,
  isPending,
  onCreate,
  onEdit,
  onResetSecret,
}: {
  enabled: boolean
  disabledReason: string
  clients: OAuthClientListItem[]
  isPending: boolean
  onCreate: () => void
  onEdit: (client: OAuthClientListItem) => void
  onResetSecret: (client: OAuthClientListItem) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div>
          <CardTitle>开发者应用</CardTitle>
          <CardDescription>申请 OAuth 2.0 应用，审核通过后可使用 Authorization Code + PKCE 接入本站账号授权。</CardDescription>
        </div>
        <CardAction>
          <Button type="button" disabled={!enabled} onClick={onCreate}>
            <Plus data-icon="inline-start" />
            申请应用
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 py-4">
        {disabledReason ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {disabledReason}
          </div>
        ) : null}

        {clients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium">还没有 OAuth 应用</p>
            <p className="mt-2 text-sm text-muted-foreground">申请后等待管理员审核，通过后即可获取 appid/key 并接入授权流程。</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {clients.map((client) => (
              <article key={client.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{client.name}</h3>
                      <OAuthClientStatusBadge status={client.status} />
                    </div>
                    <p className="mt-2 break-all text-xs text-muted-foreground">appid: <code>{client.clientId}</code></p>
                    {client.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{client.description}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(client.status === "PENDING" || client.status === "REJECTED") && enabled ? (
                      <Button type="button" variant="outline" onClick={() => onEdit(client)}>
                        修改后重提
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" disabled={isPending} onClick={() => onResetSecret(client)}>
                      <RotateCcw data-icon="inline-start" />
                      重置 key
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-xs text-muted-foreground lg:grid-cols-3">
                  <div className="rounded-[16px] bg-muted/35 px-3 py-2">
                    <p className="font-medium text-foreground">回调地址</p>
                    <div className="mt-2 flex flex-col gap-1">
                      {client.redirectUris.map((uri) => <code key={uri} className="break-all">{uri}</code>)}
                    </div>
                  </div>
                  <div className="rounded-[16px] bg-muted/35 px-3 py-2">
                    <p className="font-medium text-foreground">权限范围</p>
                    <p className="mt-2">{client.scopes.join(" ")}</p>
                  </div>
                  <div className="rounded-[16px] bg-muted/35 px-3 py-2">
                    <p className="font-medium text-foreground">审核状态</p>
                    <p className="mt-2">创建：{formatDateTime(client.createdAt)}</p>
                    <p className="mt-1">审核：{client.reviewedAt ? formatDateTime(client.reviewedAt) : "待处理"}</p>
                    <p className="mt-1">key：{client.secretRotatedAt ? `重置于 ${formatDateTime(client.secretRotatedAt)}` : "创建时生成"}</p>
                  </div>
                </div>

                {client.reviewNote ? (
                  <div className="mt-3 rounded-[16px] border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                    审核备注：{client.reviewNote}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PaymentApplicationsCard({
  enabled,
  disabledReason,
  applications,
  isPending,
  onCreate,
  onEdit,
  onResetSecret,
}: {
  enabled: boolean
  disabledReason: string
  applications: PaymentApplicationListItem[]
  isPending: boolean
  onCreate: () => void
  onEdit: (application: PaymentApplicationListItem) => void
  onResetSecret: (application: PaymentApplicationListItem) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div>
          <CardTitle>Payment 应用</CardTitle>
          <CardDescription>申请第三方支付应用，审核通过后获取可用的 Payment ID 和 Secret Key，用于发起积分支付收款。</CardDescription>
        </div>
        <CardAction>
          <Button type="button" disabled={!enabled} onClick={onCreate}>
            <Plus data-icon="inline-start" />
            申请 Payment 应用
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 py-4">
        {disabledReason ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {disabledReason}
          </div>
        ) : null}

        {applications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium">还没有 Payment 应用</p>
            <p className="mt-2 text-sm text-muted-foreground">提交后等待管理员审核，通过后即可用 Payment ID 和 Secret Key 发起支付。Secret Key 只显示一次。</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {applications.map((application) => (
              <article key={application.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{application.name}</h3>
                      <PaymentApplicationStatusBadge status={application.status} />
                    </div>
                    <p className="mt-2 break-all text-xs text-muted-foreground">Payment ID: <code>{application.paymentId}</code></p>
                    {application.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{application.description}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(application.status === "PENDING" || application.status === "REJECTED") && enabled ? (
                      <Button type="button" variant="outline" onClick={() => onEdit(application)}>
                        修改后重提
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" disabled={isPending || !enabled} onClick={() => onResetSecret(application)}>
                      <RotateCcw data-icon="inline-start" />
                      重置 Secret Key
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-xs text-muted-foreground lg:grid-cols-3">
                  <div className="rounded-[16px] bg-muted/35 px-3 py-2">
                    <p className="font-medium text-foreground">网站地址</p>
                    <p className="mt-2 break-all">{application.homepageUrl || "未填写"}</p>
                  </div>
                  <div className="rounded-[16px] bg-muted/35 px-3 py-2">
                    <p className="font-medium text-foreground">支付回调</p>
                    <p className="mt-2 break-all">{application.callbackUrl}</p>
                  </div>
                  <div className="rounded-[16px] bg-muted/35 px-3 py-2">
                    <p className="font-medium text-foreground">审核与密钥</p>
                    <p className="mt-2">创建：{formatDateTime(application.createdAt)}</p>
                    <p className="mt-1">审核：{application.reviewedAt ? formatDateTime(application.reviewedAt) : "待处理"}</p>
                    <p className="mt-1">Secret Key：{application.secretRotatedAt ? `重置于 ${formatDateTime(application.secretRotatedAt)}` : "创建时生成"}</p>
                  </div>
                </div>
                {application.reviewNote ? (
                  <div className="mt-3 rounded-[16px] border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                    审核备注：{application.reviewNote}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PaymentTransactionsCard({ data }: { data: PaymentTransactionPageData }) {
  const pagination = data.pagination

  function buildPageHref(page: number) {
    const query = new URLSearchParams({
      tab: "oauth-apps",
      paymentOrderPage: String(page),
      paymentOrderPageSize: String(pagination.pageSize),
    })

    if (data.filters.keyword) {
      query.set("paymentOrderKeyword", data.filters.keyword)
    }

    if (data.filters.status !== "ALL") {
      query.set("paymentOrderStatus", data.filters.status)
    }

    return `/settings?${query.toString()}`
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div>
          <CardTitle>我的 Payment 订单</CardTitle>
          <CardDescription>查看当前账号名下 Payment 应用产生的订单，用于对账和排查回调状态。</CardDescription>
        </div>
        <CardAction>
          <Badge variant="secondary" className="rounded-full">共 {formatNumber(data.summary.total)} 单</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="grid gap-3 md:grid-cols-4">
          <PaymentMetric label="订单总额" value={`${formatCompactPointValue(data.summary.totalAmount)} 积分`} />
          <PaymentMetric label="平台手续费" value={`${formatCompactPointValue(data.summary.totalPlatformFee)} 积分`} />
          <PaymentMetric label="已完成" value={`${formatNumber(data.summary.completed)} 单`} />
          <PaymentMetric label="待处理" value={`${formatNumber(data.summary.pending + data.summary.processing)} 单`} />
        </div>

        <form className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-3 md:grid-cols-[minmax(180px,1fr)_150px_120px_auto]">
          <input type="hidden" name="tab" value="oauth-apps" />
          <input type="hidden" name="paymentOrderPage" value="1" />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">搜索订单</span>
            <Input name="paymentOrderKeyword" defaultValue={data.filters.keyword} placeholder="交易 ID / 业务订单号 / 应用名" className="h-10 rounded-full" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">状态</span>
            <select name="paymentOrderStatus" defaultValue={data.filters.status} className="h-10 rounded-full border border-border bg-background px-3 text-sm outline-hidden">
              {paymentTransactionStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">每页</span>
            <select name="paymentOrderPageSize" defaultValue={String(data.pagination.pageSize)} className="h-10 rounded-full border border-border bg-background px-3 text-sm outline-hidden">
              {[10, 20, 50].map((item) => <option key={item} value={item}>{item} 条</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit">筛选</Button>
            <Link href="/settings?tab=oauth-apps">
              <Button type="button" variant="outline">重置</Button>
            </Link>
          </div>
        </form>

        {data.transactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
            <p className="text-sm font-medium">当前没有 Payment 订单</p>
            <p className="mt-2 text-sm text-muted-foreground">当第三方服务成功创建支付交易后，订单会出现在这里。</p>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {data.transactions.map((transaction) => (
              <PaymentTransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </div>
        )}

        {pagination.totalPages > 1 ? (
          <PageNumberPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            hasPrevPage={pagination.hasPrevPage}
            hasNextPage={pagination.hasNextPage}
            buildHref={buildPageHref}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function PaymentMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function PaymentTransactionRow({ transaction }: { transaction: PaymentTransactionListItem }) {
  return (
    <article className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.3fr)_180px_220px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{transaction.description}</h3>
          <PaymentTransactionStatusBadge status={transaction.status} expired={transaction.expired} />
        </div>
        <p className="mt-2 break-all text-xs text-muted-foreground">交易 ID：<code>{transaction.transactionId}</code></p>
        <p className="mt-1 break-all text-xs text-muted-foreground">业务订单号：<code>{transaction.externalReference}</code></p>
        {transaction.errorMessage ? <p className="mt-2 text-xs text-muted-foreground">错误信息：{transaction.errorMessage}</p> : null}
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">{formatCompactPointValue(transaction.amount)} 积分</p>
        <p>平台手续费：{formatCompactPointValue(transaction.platformFee)} 积分</p>
        <p>应用：{transaction.application.name}</p>
        <p className="break-all">Payment ID：<code>{transaction.application.paymentId}</code></p>
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p>付款人：{transaction.payer ? `${transaction.payer.displayName} @${transaction.payer.username}` : "未支付"}</p>
        <p>创建：{formatDateTime(transaction.createdAt)}</p>
        <p>过期：{formatDateTime(transaction.expiresAt)}</p>
        {transaction.paidAt ? <p>支付：{formatDateTime(transaction.paidAt)}</p> : null}
      </div>
    </article>
  )
}

function AuthorizedSitesCard({
  sites,
  isPending,
  onRevoke,
}: {
  sites: OAuthAuthorizedSiteListItem[]
  isPending: boolean
  onRevoke: (site: OAuthAuthorizedSiteListItem) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div>
          <CardTitle>我授权的站点</CardTitle>
          <CardDescription>查看已经允许使用你账号登录的 OAuth 应用，可随时取消授权并撤销当前 token。</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 py-4">
        {sites.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium">还没有授权过第三方站点</p>
            <p className="mt-2 text-sm text-muted-foreground">当你在授权页点击同意后，应用会出现在这里。</p>
          </div>
        ) : (
          sites.map((site) => (
            <article key={site.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{site.name}</h3>
                    <OAuthClientStatusBadge status={site.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    授权范围：<code>{site.scopes.join(" ")}</code>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    首次授权：{formatDateTime(site.authorizedAt)} · 最近更新：{formatDateTime(site.updatedAt)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    当前有效 access token：{site.activeAccessTokenCount}，refresh token：{site.activeRefreshTokenCount}
                  </p>
                  {site.homepageUrl ? (
                    <p className="mt-2 break-all text-xs text-muted-foreground">主页：{site.homepageUrl}</p>
                  ) : null}
                </div>
                <Button type="button" variant="outline" disabled={isPending} onClick={() => onRevoke(site)}>
                  取消授权
                </Button>
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function OAuthIntegrationDocs() {
  const [oauthDemoOpen, setOauthDemoOpen] = useState(false)
  const [paymentDemoOpen, setPaymentDemoOpen] = useState(false)

  async function copyOAuthDemoCode() {
    try {
      await navigator.clipboard.writeText(oauthDemoCode)
      toast.success("示例代码已复制", "OAuth 文档")
    } catch {
      toast.error("复制失败，请手动复制", "OAuth 文档")
    }
  }

  async function copyPaymentDemoCode() {
    try {
      await navigator.clipboard.writeText(paymentDemoCode)
      toast.success("示例代码已复制", "Payment 文档")
    } catch {
      toast.error("复制失败，请手动复制", "Payment 文档")
    }
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <div>
            <CardTitle>接入文档</CardTitle>
            <CardDescription>OAuth 负责登录授权，Payment 负责用户确认后的积分支付。密钥只显示一次，请保存到服务端。</CardDescription>
          </div>
          <CardAction>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">OAuth PKCE</Badge>
              <Badge variant="secondary">Payment HMAC</Badge>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 py-5">
          <section className="grid gap-4 xl:grid-cols-2">
            <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge variant="outline">OAuth</Badge>
                  <h3 className="mt-3 text-base font-semibold">第三方登录授权</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    适合让其他站点使用本站账号登录。使用授权码 + PKCE，服务端换取 token 后读取用户信息。
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => setOauthDemoOpen(true)}>
                  <Code2 data-icon="inline-start" />
                  Node.js 示例
                </Button>
              </div>
              <EndpointGrid rows={oauthEndpointRows} />
            </article>

            <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge variant="outline">Payment</Badge>
                  <h3 className="mt-3 text-base font-semibold">积分支付收款</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    适合第三方网站创建订单后跳转本站，由用户登录并确认支付。平台手续费由后台统一设置。
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => setPaymentDemoOpen(true)}>
                  <Code2 data-icon="inline-start" />
                  Node.js 示例
                </Button>
              </div>
              <EndpointGrid rows={paymentEndpointRows} />
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-border p-4">
              <div>
                <h3 className="text-base font-semibold">OAuth 最小流程</h3>
                <p className="mt-1 text-sm text-muted-foreground">完整流程都在服务端闭环，浏览器只负责跳转授权页和接收回调。</p>
              </div>
              <FlowSteps steps={oauthFlowSteps} />
            </div>

            <div className="rounded-2xl border border-border p-4">
              <div>
                <h3 className="text-base font-semibold">Payment 最小流程</h3>
                <p className="mt-1 text-sm text-muted-foreground">不提供转账接口，只处理用户主动确认的第三方支付订单。</p>
              </div>
              <FlowSteps steps={paymentFlowSteps} />
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <ParameterReference title="授权请求参数" rows={authorizationParameterRows} />
            <ParameterReference title="Token 请求参数" rows={tokenParameterRows} />
          </div>

          <section className="rounded-2xl border border-dashed border-border bg-muted/20 p-4">
            <h3 className="text-sm font-semibold">OAuth 授权地址示例</h3>
            <code className="mt-3 block break-all text-xs leading-6 text-muted-foreground">
              /oauth/authorize?client_id=你的appid&amp;redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fcallback&amp;response_type=code&amp;scope=openid%20profile%20email&amp;state=随机state&amp;code_challenge=PKCE摘要&amp;code_challenge_method=S256
            </code>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              回调地址必须与应用配置完全一致。生产环境建议使用 https；本地演示可使用 localhost 或 127.0.0.1。
            </p>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <ParameterReference title="发起支付参数" rows={paymentCreateParameterRows} />
            <ParameterReference title="支付回调参数" rows={paymentCallbackParameterRows} />
          </div>

          <section className="rounded-2xl border border-dashed border-border bg-muted/20 p-4">
            <h3 className="text-sm font-semibold">Payment 签名字符串示例</h3>
            <code className="mt-3 block break-all text-xs leading-6 text-muted-foreground">
              amount=100&amp;description=购买VIP会员&amp;order_id=order_20251008_001
            </code>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              本实现不会开放 /payment/transfer/:payment_id；Payment 应用仅用于用户主动确认支付后的订单扣款。
            </p>
          </section>
        </CardContent>
      </Card>

      {oauthDemoOpen ? (
        <Modal
          open
          title="OAuth Node.js 最小示例"
          size="xl"
          onClose={() => setOauthDemoOpen(false)}
          footer={(
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={copyOAuthDemoCode}>
                <Copy data-icon="inline-start" />
                复制代码
              </Button>
              <Button type="button" onClick={() => setOauthDemoOpen(false)}>关闭</Button>
            </div>
          )}
        >
          <pre className="max-h-[65vh] overflow-auto rounded-xl border border-border bg-muted/35 p-4 text-xs leading-6">
            <code>{oauthDemoCode}</code>
          </pre>
        </Modal>
      ) : null}

      {paymentDemoOpen ? (
        <Modal
          open
          title="Payment Node.js 最小示例"
          size="xl"
          onClose={() => setPaymentDemoOpen(false)}
          footer={(
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={copyPaymentDemoCode}>
                <Copy data-icon="inline-start" />
                复制代码
              </Button>
              <Button type="button" onClick={() => setPaymentDemoOpen(false)}>关闭</Button>
            </div>
          )}
        >
          <pre className="max-h-[65vh] overflow-auto rounded-xl border border-border bg-muted/35 p-4 text-xs leading-6">
            <code>{paymentDemoCode}</code>
          </pre>
        </Modal>
      ) : null}
    </>
  )
}

function EndpointGrid({
  rows,
}: {
  rows: Array<{ label: string; value: string }>
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {rows.map((item) => (
        <div key={item.label} className="rounded-xl bg-muted/30 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
          <code className="mt-1 block break-all text-sm">{item.value}</code>
        </div>
      ))}
    </div>
  )
}

function FlowSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-4 flex flex-col gap-3">
      {steps.map((step, index) => (
        <li key={step} className="flex gap-3 text-sm leading-6 text-muted-foreground">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

function ParameterReference({
  title,
  rows,
}: {
  title: string
  rows: Array<{ name: string; description: string }>
}) {
  return (
    <section className="rounded-xl border border-border">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.name} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[180px_minmax(0,1fr)]">
            <code className="break-all text-foreground">{row.name}</code>
            <p className="leading-6 text-muted-foreground">{row.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function OAuthClientFormModal({
  open,
  client,
  isPending,
  onClose,
  onSecret,
  startTransition,
}: {
  open: boolean
  client: OAuthClientListItem | null
  isPending: boolean
  onClose: () => void
  onSecret: (payload: { clientId: string; clientSecret: string }) => void
  startTransition: ReturnType<typeof useTransition>[1]
}) {
  const router = useRouter()
  const [form, setForm] = useState<OAuthClientFormState>(() => getInitialForm(client))

  if (!open) {
    return null
  }

  function updateForm<K extends keyof OAuthClientFormState>(key: K, value: OAuthClientFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleScope(scope: string, checked: boolean) {
    setForm((current) => {
      const next = checked
        ? Array.from(new Set([...current.scopes, scope]))
        : current.scopes.filter((item) => item !== scope)

      return {
        ...current,
        scopes: next.includes("openid") ? next : ["openid", ...next],
      }
    })
  }

  function submit() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/oauth/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: client ? "update" : "create",
            id: client?.id,
            name: form.name,
            description: form.description,
            homepageUrl: form.homepageUrl,
            logoUrl: form.logoUrl,
            redirectUris: form.redirectUris,
            scopes: form.scopes,
          }),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok || result?.code !== 0) {
          throw new Error(result?.message ?? "提交 OAuth 应用失败")
        }

        toast.success(client ? "OAuth 应用已重新提交审核" : "OAuth 应用申请已提交", "OAuth 应用")
        if (!client) {
          onSecret({
            clientId: String(result.data?.client?.clientId ?? ""),
            clientSecret: String(result.data?.clientSecret ?? ""),
          })
        }
        if (client) {
          router.refresh()
        }
        onClose()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "提交 OAuth 应用失败", "OAuth 应用")
      }
    })
  }

  return (
    <FormModal
      open
      title={client ? "修改 OAuth 应用" : "申请 OAuth 应用"}
      description="回调地址必须精确匹配。生产环境仅允许 https，本地开发允许 localhost / 127.0.0.1。"
      size="lg"
      closeDisabled={isPending}
      closeOnEscape={!isPending}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      footer={({ formId }) => (
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>取消</Button>
          <Button type="submit" form={formId} disabled={isPending}>{isPending ? "提交中..." : "提交审核"}</Button>
        </div>
      )}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">应用名称 *</span>
          <Input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="例如 我的社区登录" required />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">应用主页</span>
          <Input value={form.homepageUrl} onChange={(event) => updateForm("homepageUrl", event.target.value)} placeholder="https://example.com" />
        </label>
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">应用描述</span>
        <Textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} rows={4} placeholder="说明应用用途，方便管理员审核。" />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Logo 地址</span>
        <Input value={form.logoUrl} onChange={(event) => updateForm("logoUrl", event.target.value)} placeholder="https://example.com/logo.png" />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">回调地址 *</span>
        <Textarea value={form.redirectUris} onChange={(event) => updateForm("redirectUris", event.target.value)} rows={5} placeholder={"每行一个，例如\nhttps://example.com/auth/callback\nhttp://localhost:3000/auth/callback"} required />
        <span className="text-xs text-muted-foreground">授权时传入的 redirect_uri 必须与这里其中一项完全一致。</span>
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">权限范围</span>
        <div className="grid gap-2">
          {scopeOptions.map((scope) => (
            <label key={scope.value} className="flex items-start gap-3 rounded-xl border border-border px-3 py-2">
              <input
                type="checkbox"
                checked={form.scopes.includes(scope.value)}
                disabled={scope.value === "openid"}
                onChange={(event) => toggleScope(scope.value, event.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{scope.label}</span>
                <span className="text-xs leading-5 text-muted-foreground">{scope.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </FormModal>
  )
}

function PaymentApplicationFormModal({
  open,
  application,
  isPending,
  onClose,
  onSecret,
  startTransition,
}: {
  open: boolean
  application: PaymentApplicationListItem | null
  isPending: boolean
  onClose: () => void
  onSecret: (payload: { paymentId: string; secretKey: string }) => void
  startTransition: ReturnType<typeof useTransition>[1]
}) {
  const router = useRouter()
  const [form, setForm] = useState<PaymentApplicationFormState>(() => getInitialPaymentForm(application))

  if (!open) {
    return null
  }

  function updateForm<K extends keyof PaymentApplicationFormState>(key: K, value: PaymentApplicationFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function submit() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/payment/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: application ? "update" : "create",
            id: application?.id,
            name: form.name,
            description: form.description,
            homepageUrl: form.homepageUrl,
            callbackUrl: form.callbackUrl,
          }),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok || result?.code !== 0) {
          throw new Error(result?.message ?? "提交 Payment 应用失败")
        }

        toast.success(application ? "Payment 应用已重新提交审核" : "Payment 应用申请已提交", "Payment 应用")
        if (!application) {
          onSecret({
            paymentId: String(result.data?.application?.paymentId ?? ""),
            secretKey: String(result.data?.secretKey ?? ""),
          })
        }
        if (application) {
          router.refresh()
        }
        onClose()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "提交 Payment 应用失败", "Payment 应用")
      }
    })
  }

  return (
      <FormModal
        open
        title={application ? "修改 Payment 应用" : "申请 Payment 应用"}
        description="Payment 应用用于第三方网站发起积分支付。审核通过后才可调用支付接口；回调地址会在支付成功后通过浏览器 GET 跳转访问。"
      size="lg"
      closeDisabled={isPending}
      closeOnEscape={!isPending}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      footer={({ formId }) => (
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>取消</Button>
          <Button type="submit" form={formId} disabled={isPending}>{isPending ? "提交中..." : "提交审核"}</Button>
        </div>
      )}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">应用名称 *</span>
          <Input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="例如 我的在线商店" required />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">网站地址</span>
          <Input value={form.homepageUrl} onChange={(event) => updateForm("homepageUrl", event.target.value)} placeholder="https://example.com" />
        </label>
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">支付回调地址 *</span>
        <Input value={form.callbackUrl} onChange={(event) => updateForm("callbackUrl", event.target.value)} placeholder="https://example.com/payment/callback" required />
        <span className="text-xs text-muted-foreground">支付成功后，用户浏览器会携带 transaction_id、amount、status、signature 等查询参数跳转到此地址。</span>
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">应用描述</span>
        <Textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} rows={4} placeholder="说明支付用途，方便你后续识别应用。" />
      </label>
    </FormModal>
  )
}

function SecretOnceModal({
  secret,
  onClose,
}: {
  secret: SecretOnceState | null
  onClose: () => void
}) {
  if (!secret) {
    return null
  }
  const currentSecret = secret

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} 已复制`, currentSecret.namespace)
    } catch {
      toast.error("复制失败，请手动复制", currentSecret.namespace)
    }
  }

  return (
    <Modal
      open
      title={currentSecret.title}
      description={currentSecret.description}
      size="md"
      onClose={onClose}
      footer={(
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>我已保存</Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-3">
        {currentSecret.rows.map((row) => (
          <SecretRow key={row.label} label={row.label} value={row.value} onCopy={() => copy(row.value, row.copyLabel)} />
        ))}
        <div className="rounded-xl border border-dashed border-border bg-muted/35 px-4 py-3 text-xs leading-6 text-muted-foreground">
          {currentSecret.warning}
        </div>
      </div>
    </Modal>
  )
}

function SecretRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-muted/25 px-3 py-2">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button type="button" variant="outline" size="sm" onClick={onCopy}>
          <Copy data-icon="inline-start" />
          复制
        </Button>
      </div>
      <code className="block break-all text-sm">{value}</code>
    </div>
  )
}

function OAuthClientStatusBadge({ status }: { status: OAuthClientListItem["status"] }) {
  if (status === "APPROVED") {
    return (
      <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
        <CheckCircle2 data-icon="inline-start" />
        已通过
      </Badge>
    )
  }

  if (status === "REJECTED") {
    return <Badge className="border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">已驳回</Badge>
  }

  if (status === "DISABLED") {
    return <Badge className="border-transparent bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200">已禁用</Badge>
  }

  return (
    <Badge className="border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
      <KeyRound data-icon="inline-start" />
      待审核
    </Badge>
  )
}

function PaymentTransactionStatusBadge({
  status,
  expired,
}: {
  status: PaymentTransactionListItem["status"]
  expired?: boolean
}) {
  if (status === "COMPLETED") {
    return (
      <Badge variant="secondary">
        <CheckCircle2 data-icon="inline-start" />
        已完成
      </Badge>
    )
  }

  if (status === "PENDING") {
    return (
      <Badge variant="outline">
        <ReceiptText data-icon="inline-start" />
        {expired ? "已过期" : "待支付"}
      </Badge>
    )
  }

  if (status === "PROCESSING") {
    return <Badge variant="outline">处理中</Badge>
  }

  if (status === "FAILED") {
    return <Badge variant="outline">失败</Badge>
  }

  if (status === "CANCELLED") {
    return <Badge variant="outline">已取消</Badge>
  }

  return <Badge variant="outline">已退款</Badge>
}

function PaymentApplicationStatusBadge({ status }: { status: PaymentApplicationListItem["status"] }) {
  if (status === "ACTIVE") {
    return (
      <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
        <CreditCard data-icon="inline-start" />
        已通过
      </Badge>
    )
  }

  if (status === "REJECTED") {
    return <Badge className="border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">已驳回</Badge>
  }

  if (status === "DISABLED") {
    return <Badge className="border-transparent bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200">已禁用</Badge>
  }

  return (
    <Badge className="border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
      <KeyRound data-icon="inline-start" />
      待审核
    </Badge>
  )
}
