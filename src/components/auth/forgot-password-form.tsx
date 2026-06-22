"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { SmsCaptchaDialog, type SmsCaptchaPayload } from "@/components/auth/sms-captcha-dialog"
import { Button } from "@/components/ui/rbutton"
import { TextField } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import type { SiteSettingsData } from "@/lib/site-settings"
import { SMS_CODE_COOLDOWN_SECONDS } from "@/lib/sms-verification"

export function ForgotPasswordForm({
  settings,
  smsAvailable,
}: {
  settings: SiteSettingsData
  smsAvailable: boolean
}) {
  const router = useRouter()
  const [channel, setChannel] = useState<"EMAIL" | "PHONE">("EMAIL")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [smsCaptchaOpen, setSmsCaptchaOpen] = useState(false)

  useEffect(() => {
    if (countdown <= 0) {
      return
    }

    const timer = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [countdown])

  async function sendCode(captchaPayload: SmsCaptchaPayload = {}) {
    const target = channel === "EMAIL" ? email.trim() : phone.trim()

    if (!target) {
      const errorMessage = channel === "EMAIL" ? "请先输入邮箱" : "请先输入手机号"
      setMessage(errorMessage)
      toast.warning(errorMessage, "找回密码")
      return
    }

    if (channel === "PHONE" && !smsAvailable) {
      const errorMessage = "当前站点未配置短信发送能力"
      setMessage(errorMessage)
      toast.warning(errorMessage, "找回密码")
      return
    }

    setSending(true)
    setMessage("")

    try {
      const response = await fetch("/api/auth/forgot-password/send-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(channel === "EMAIL" ? { channel, email } : { channel, phone, ...captchaPayload }),
      })

      const result = await response.json()

      if (!response.ok) {
        const errorMessage = result.message ?? "验证码发送失败"
        setMessage(errorMessage)
        toast.error(errorMessage, "找回密码")
        setSmsCaptchaOpen(false)
        return
      }

      const successMessage = result.message ?? (channel === "EMAIL" ? "验证码已发送到邮箱" : "验证码已发送到手机")
      setMessage(successMessage)
      toast.success(successMessage, "找回密码")
      setSmsCaptchaOpen(false)
      setCountdown(Number(result.data?.cooldownSeconds ?? SMS_CODE_COOLDOWN_SECONDS))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "验证码发送失败"
      setMessage(errorMessage)
      toast.error(errorMessage, "找回密码")
      setSmsCaptchaOpen(false)
    } finally {
      setSending(false)
    }
  }

  function handleSendCode() {
    if (sending || countdown > 0) {
      return
    }

    if (channel !== "PHONE" || settings.smsCaptchaMode === "OFF") {
      void sendCode()
      return
    }

    if (!phone.trim()) {
      setMessage("请先输入手机号")
      toast.warning("请先输入手机号", "找回密码")
      return
    }

    if (!smsAvailable) {
      setMessage("当前站点未配置短信发送能力")
      toast.warning("当前站点未配置短信发送能力", "找回密码")
      return
    }

    setSmsCaptchaOpen(true)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!(channel === "EMAIL" ? email.trim() : phone.trim()) || !code.trim() || !password || !confirmPassword) {
      const errorMessage = "请完整填写账号、验证码和新密码"
      setMessage(errorMessage)
      toast.warning(errorMessage, "找回密码")
      return
    }

    if (password !== confirmPassword) {
      const errorMessage = "两次输入的密码不一致"
      setMessage(errorMessage)
      toast.warning(errorMessage, "找回密码")
      return
    }

    setSubmitting(true)
    setMessage("")

    const response = await fetch("/api/auth/forgot-password/reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        email: channel === "EMAIL" ? email : undefined,
        phone: channel === "PHONE" ? phone : undefined,
        code,
        password,
        confirmPassword,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      const errorMessage = result.message ?? "重置密码失败"
      setMessage(errorMessage)
      toast.error(errorMessage, "找回密码")
      setSubmitting(false)
      return
    }

    const successMessage = result.message ?? "密码已重置，请重新登录"
    setMessage(successMessage)
    toast.success(successMessage, "找回密码")
    setSubmitting(false)
    router.push("/login")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button type="button" variant={channel === "EMAIL" ? "default" : "outline"} onClick={() => setChannel("EMAIL")}>邮箱</Button>
        {smsAvailable ? (
          <Button type="button" variant={channel === "PHONE" ? "default" : "outline"} onClick={() => setChannel("PHONE")}>手机</Button>
        ) : null}
      </div>

      {channel === "EMAIL" ? (
        <TextField label="邮箱" value={email} onChange={setEmail} placeholder="输入注册时绑定的邮箱" type="email" required background="card" />
      ) : (
        <TextField label="手机号" value={phone} onChange={setPhone} placeholder="输入已绑定手机号" type="tel" required background="card" />
      )}

      <div className="flex flex-col gap-3 rounded-xl">
        <TextField label={channel === "EMAIL" ? "邮箱验证码" : "短信验证码"} value={code} onChange={setCode} placeholder="输入 6 位验证码" required background="card" />
        <Button type="button" variant="outline" onClick={() => void handleSendCode()} disabled={sending || countdown > 0} className="w-full sm:w-auto">
          {sending ? "发送中..." : countdown > 0 ? `${countdown}s 后重发` : "发送验证码"}
        </Button>
      </div>

      <TextField label="新密码" value={password} onChange={setPassword} placeholder="输入新的登录密码" type="password" required background="card" />
      <TextField label="确认新密码" value={confirmPassword} onChange={setConfirmPassword} placeholder="再次输入新密码" type="password" required background="card" />

      <Button className="w-full" disabled={submitting}>
        {submitting ? "提交中..." : "重置密码"}
      </Button>

      <div className="rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
        {smsAvailable ? "支持通过已绑定邮箱或手机号找回密码，验证码 10 分钟内有效。" : "支持通过已绑定邮箱找回密码，验证码 10 分钟内有效。"}
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <SmsCaptchaDialog
        open={smsCaptchaOpen}
        mode={settings.smsCaptchaMode}
        siteKey={settings.turnstileSiteKey}
        sending={sending}
        onClose={() => setSmsCaptchaOpen(false)}
        onVerified={(payload) => sendCode(payload)}
      />
    </form>
  )
}

