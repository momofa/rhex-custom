"use client"

import { useState } from "react"

import { useAdminMutation } from "@/hooks/use-admin-mutation"
import { Button } from "@/components/ui/rbutton"
import { TextField } from "@/components/ui/text-field"
import { adminPost } from "@/lib/admin-client"
import {
  buildAdminSiteSettingsPayload,
  createAdminSiteSettingsDraft,
  SiteLogoUploadCard,
  uploadSiteLogoFile,
  type AdminSiteSettingsDraft,
  type AdminSiteSettingsInitialSettings,
} from "@/components/admin/admin-site-settings.shared"

interface AdminSiteSettingsFormProps {
  initialSettings: AdminSiteSettingsInitialSettings
}

export function AdminSiteSettingsForm({ initialSettings }: AdminSiteSettingsFormProps) {
  const [draft, setDraft] = useState(() => createAdminSiteSettingsDraft(initialSettings))
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [feedback, setFeedback] = useState("")
  const { isPending, runMutation } = useAdminMutation()

  function updateDraftField<Key extends keyof AdminSiteSettingsDraft>(field: Key, value: AdminSiteSettingsDraft[Key]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const {
    siteName,
    siteSlogan,
    siteDescription,
    siteLogoText,
    siteLogoPath,
    vipMonthlyPrice,
    vipQuarterlyPrice,
    vipYearlyPrice,
    postOfflinePrice,
    postOfflineVip1Price,
    postOfflineVip2Price,
    postOfflineVip3Price,
    uploadProvider,
    uploadLocalPath,
    uploadBaseUrl,
    uploadOssBucket,
    uploadOssRegion,
    uploadOssEndpoint,
  } = draft

  async function uploadSiteLogo(file: File) {
    setIsUploadingLogo(true)
    setFeedback("")

    try {
      updateDraftField("siteLogoPath", await uploadSiteLogoFile(file))
      setFeedback("站点 Logo 上传成功")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "站点 Logo 上传失败，请稍后再试")
    } finally {
      setIsUploadingLogo(false)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        setFeedback("")
        runMutation({
          mutation: () => adminPost("/api/admin/site-settings", buildAdminSiteSettingsPayload(draft), {
            defaultSuccessMessage: "保存成功",
            defaultErrorMessage: "保存失败",
          }),
          showSuccessToast: false,
          showErrorToast: false,
          onSuccess: (result) => {
            setFeedback(result.message)
          },
          onError: (error) => {
            setFeedback(error.message)
          },
        })
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="站点名称" value={siteName} onChange={(value) => updateDraftField("siteName", value)} placeholder="如 兴趣论坛" />
        <TextField label="Logo 文案" value={siteLogoText} onChange={(value) => updateDraftField("siteLogoText", value)} placeholder="如 兴趣论坛" />
      </div>
      <TextField label="站点 Slogan" value={siteSlogan} onChange={(value) => updateDraftField("siteSlogan", value)} placeholder="如 Waste your time on things you love" />
      <div className="space-y-2">
        <p className="text-sm font-medium">站点描述</p>
        <textarea value={siteDescription} onChange={(event) => updateDraftField("siteDescription", event.target.value)} className="min-h-[140px] w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-hidden" />
      </div>
      <SiteLogoUploadCard
        value={siteLogoPath}
        uploading={isUploadingLogo}
        onValueChange={(value) => updateDraftField("siteLogoPath", value)}
        onUpload={uploadSiteLogo}
        onClear={() => updateDraftField("siteLogoPath", "")}
      />
      <div className="rounded-xl border border-border p-5 space-y-5">
        <div>
          <h3 className="text-sm font-semibold">VIP 套餐价格</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <TextField label="月卡积分价格（VIP1）" value={vipMonthlyPrice} onChange={(value) => updateDraftField("vipMonthlyPrice", value)} placeholder="如 3000" />
            <TextField label="季卡积分价格（VIP2）" value={vipQuarterlyPrice} onChange={(value) => updateDraftField("vipQuarterlyPrice", value)} placeholder="如 8000" />
            <TextField label="年卡积分价格（VIP3）" value={vipYearlyPrice} onChange={(value) => updateDraftField("vipYearlyPrice", value)} placeholder="如 30000" />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold">作者下线帖子价格</h3>
          <p className="mt-1 text-xs text-muted-foreground">0 表示免费；普通用户与 VIP1 / VIP2 / VIP3 按当前身份分别结算。</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="普通用户积分价格" value={postOfflinePrice} onChange={(value) => updateDraftField("postOfflinePrice", value)} placeholder="如 50" />
            <TextField label="VIP1 积分价格" value={postOfflineVip1Price} onChange={(value) => updateDraftField("postOfflineVip1Price", value)} placeholder="如 30" />
            <TextField label="VIP2 积分价格" value={postOfflineVip2Price} onChange={(value) => updateDraftField("postOfflineVip2Price", value)} placeholder="如 20" />
            <TextField label="VIP3 积分价格" value={postOfflineVip3Price} onChange={(value) => updateDraftField("postOfflineVip3Price", value)} placeholder="如 0" />
          </div>
        </div>
      </div>


      <div className="rounded-xl border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold">上传存储设置</h3>
        <div className="space-y-2">
          <p className="text-sm font-medium">存储策略</p>
          <select value={uploadProvider} onChange={(event) => updateDraftField("uploadProvider", event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden">
            <option value="local">本地存储</option>
            <option value="oss">OSS（预留）</option>
          </select>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="本地上传目录" value={uploadLocalPath} onChange={(value) => updateDraftField("uploadLocalPath", value)} placeholder="如 uploads" />
          <TextField label="资源访问基础 URL" value={uploadBaseUrl} onChange={(value) => updateDraftField("uploadBaseUrl", value)} placeholder="留空则自动使用 /uploads" />
          <TextField label="OSS Bucket" value={uploadOssBucket} onChange={(value) => updateDraftField("uploadOssBucket", value)} placeholder="如 my-bucket" />
          <TextField label="OSS Region" value={uploadOssRegion} onChange={(value) => updateDraftField("uploadOssRegion", value)} placeholder="如 ap-guangzhou" />
          <TextField label="OSS Endpoint" value={uploadOssEndpoint} onChange={(value) => updateDraftField("uploadOssEndpoint", value)} placeholder="如 https://oss.example.com" />
        </div>
        <p className="text-xs leading-6 text-muted-foreground">当前先完整支持本地上传，OSS 配置项先保留在后台设置中，后续可继续接入真实云存储实现。</p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>{isPending ? "保存中..." : "保存站点设置"}</Button>
        {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
      </div>
    </form>
  )
}
