"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import { Plus } from "lucide-react"

import { FormModal } from "@/components/ui/modal"
import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

interface FriendLinkApplicationDialogProps {
  announcement: string
  disabled?: boolean
  buttonClassName?: string
}

const INITIAL_FORM = {
  name: "",
  url: "",
  placementPageUrl: "",
  logoPath: "",
}

export function FriendLinkApplicationDialog({ announcement, disabled = false, buttonClassName }: FriendLinkApplicationDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)

  const canSubmit = useMemo(
    () => form.name.trim() && form.url.trim() && form.placementPageUrl.trim() && !submitting,
    [form.name, form.url, form.placementPageUrl, submitting],
  )

  function closeDialog() {
    if (submitting) {
      return
    }

    setOpen(false)
  }

  function updateField<K extends keyof typeof INITIAL_FORM>(key: K, value: (typeof INITIAL_FORM)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch("/api/friend-links/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const result = await response.json()

      if (!response.ok) {
        toast.error(result.message ?? "申请提交失败", "提交失败")
        return
      }

      toast.success(result.message ?? "申请已提交，请等待审核", "提交成功")
      setForm(INITIAL_FORM)
      setOpen(false)
    } catch {
      toast.error("申请提交失败，请稍后重试", "提交失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} disabled={disabled} className={cn("rounded-full px-5", buttonClassName)}>
        <Plus className="mr-2 h-4 w-4" />
        申请友情链接
      </Button>
      <FormModal
        open={open}
        onClose={closeDialog}
        closeDisabled={submitting}
        closeOnEscape={!submitting}
        size="lg"
        title="申请友情链接"
        description="提交时会自动检查你填写的页面是否已放置本站链接，命中后将直接通过。"
        onSubmit={handleSubmit}
        formClassName="space-y-4 sm:space-y-5"
        footer={({ formId }) => (
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={closeDialog} disabled={submitting} className="w-full sm:w-auto">
              取消
            </Button>
            <Button type="submit" form={formId} disabled={!canSubmit} className="w-full sm:w-auto">
              {submitting ? "提交中..." : "提交申请"}
            </Button>
          </div>
        )}
      >
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <p className="text-sm font-medium">友情链接公告</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">{announcement}</p>
        </section>

        <Field label="网站名称" hint="请输入您的网站名称">
          <input value={form.name} onChange={(event) => updateField("name", event.target.value)} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-hidden" placeholder="请输入您的网站名称" maxLength={40} />
        </Field>

        <Field label="网站链接" hint="请输入您的网站地址（以 http 开头）">
          <input value={form.url} onChange={(event) => updateField("url", event.target.value)} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-hidden" placeholder="请输入您的网站地址（以 http 开头）" />
        </Field>

        <Field label="友情链接所在页面" hint="请输入已放置本站链接的页面地址，提交时会自动检测">
          <input value={form.placementPageUrl} onChange={(event) => updateField("placementPageUrl", event.target.value)} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-hidden" placeholder="请输入友情链接所在页面 URL（以 http 开头）" />
        </Field>

        <Field label="LOGO URL" hint="仅支持填写图片 URL，例如：https://example.com/logo.png">
          <div className="space-y-3 rounded-xl border border-dashed border-border bg-card/60 p-4">
            <input value={form.logoPath} onChange={(event) => updateField("logoPath", event.target.value)} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-hidden" placeholder="请输入 LOGO 图片 URL" />
            {form.logoPath ? (
              <div className="relative h-16 w-32 overflow-hidden rounded-xl border border-border bg-white p-2">
                <Image src={form.logoPath} alt={`${form.name || "友情链接"} logo`} fill unoptimized className="object-contain p-2" />
              </div>
            ) : null}
          </div>
        </Field>
      </FormModal>
    </>
  )
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <p className="text-xs leading-6 text-muted-foreground">{hint}</p>
      {children}
    </label>
  )
}
