import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import {
  AddonRenderBlock,
  AddonSlotRenderer,
  AddonSurfaceRenderer,
  executeAddonSlot,
} from "@/addons-host"
import { AuthPanelNotice, AuthShell } from "@/components/auth/auth-shell"
import { RegisterForm } from "@/components/auth/register-form"
import { listAddonExternalAuthEntries } from "@/lib/addon-external-auth-providers"
import { getCurrentUser } from "@/lib/auth"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `注册 - ${settings.siteName}`,
    description: `注册 ${settings.siteName} 账户，加入社区讨论并建立你的个人主页。`,
  }
}

export default async function RegisterPage(props: PageProps<"/register">) {
  const searchParams = await props.searchParams
  const [
    user,
    settings,
    addonExternalAuthEntries,
    addonBeforeFieldBlocks,
    addonCaptchaBlocks,
    addonAfterFieldBlocks,
  ] = await Promise.all([
    getCurrentUser(),
    getSiteSettings(),
    listAddonExternalAuthEntries(),
    executeAddonSlot("auth.register.form.before"),
    executeAddonSlot("auth.register.captcha"),
    executeAddonSlot("auth.register.form.after"),
  ])

  if (user) {
    redirect("/")
  }

  const authSlotProps = {
    externalAuthEntries: addonExternalAuthEntries,
    registrationEnabled: settings.registrationEnabled,
    settings,
  }
  const renderPage = (page: ReactNode, props = authSlotProps) => (
    <>
      <AddonSlotRenderer slot="auth.register.page.before" props={props} />
      <AddonSurfaceRenderer surface="auth.register.page" props={props}>
        {page}
      </AddonSurfaceRenderer>
      <AddonSlotRenderer slot="auth.register.page.after" props={props} />
    </>
  )

  if (!settings.registrationEnabled) {
    return renderPage(
      <AuthShell
        showcaseName={settings.siteName}
        showShowcase={settings.authPageShowcaseEnabled}
        panelTitle="注册暂未开放"
        panelDescription="稍后再回来看看，或先使用现有账号继续访问社区。"
        panelBefore={<AddonSlotRenderer slot="auth.register.panel.before" props={authSlotProps} />}
        panelAfter={<AddonSlotRenderer slot="auth.register.panel.after" props={authSlotProps} />}
        panelSurface="auth.register.panel"
        surfaceProps={authSlotProps}
        footer={(
          <p className="text-sm text-muted-foreground">
            已有账户？<Link href="/login" className="font-medium text-foreground hover:underline">去登录</Link>
          </p>
        )}
      >
        <AuthPanelNotice title="当前无法创建新账户">
          当前站点已关闭新用户注册，请稍后再试或联系管理员。
        </AuthPanelNotice>
      </AuthShell>
    )
  }

  const inviterUsername = readSearchParam(searchParams?.invite) ?? readSearchParam(searchParams?.inviter) ?? ""
  const inviteCode = readSearchParam(searchParams?.code) ?? ""
  const authError = readSearchParam(searchParams?.authError) ?? ""
  const registerSlotProps = {
    ...authSlotProps,
    authError,
    inviteCode,
    inviterUsername,
  }

  return renderPage(
    <AuthShell
      showcaseName={settings.siteName}
      showShowcase={settings.authPageShowcaseEnabled}
      panelTitle="创建账户"
      panelDescription="花一分钟创建账户，马上开始你的浏览、回复和收藏。"
      panelBefore={<AddonSlotRenderer slot="auth.register.panel.before" props={registerSlotProps} />}
      panelAfter={<AddonSlotRenderer slot="auth.register.panel.after" props={registerSlotProps} />}
      panelSurface="auth.register.panel"
      surfaceProps={registerSlotProps}
      beforeForm={(
        <>
          {authError ? <AuthPanelNotice tone="destructive" title="注册未完成">{authError}</AuthPanelNotice> : null}
          {inviterUsername ? (
            <AuthPanelNotice title="邀请关系已带入">
              当前通过用户 <span className="font-medium text-foreground">{inviterUsername}</span> 的邀请进入注册。
            </AuthPanelNotice>
          ) : null}
          {inviteCode ? (
            <AuthPanelNotice title="邀请码已带入">
              当前注册链接已带入邀请码 <span className="font-mono font-medium text-foreground">{inviteCode}</span>。
            </AuthPanelNotice>
          ) : null}
        </>
      )}
      footer={(
        <p className="text-sm text-muted-foreground">
          已有账户？<Link href="/login" className="font-medium text-foreground hover:underline">去登录</Link>
        </p>
      )}
    >
      <AddonSurfaceRenderer surface="auth.register.form" props={registerSlotProps}>
        <RegisterForm
          settings={settings}
          addonBeforeFields={renderAddonBlocks(addonBeforeFieldBlocks)}
          addonCaptcha={renderAddonBlocks(addonCaptchaBlocks)}
          addonAfterFields={renderAddonBlocks(addonAfterFieldBlocks)}
          addonExternalAuthEntries={addonExternalAuthEntries}
        />
      </AddonSurfaceRenderer>
    </AuthShell>,
    registerSlotProps,
  )
}

function renderAddonBlocks(blocks: Awaited<ReturnType<typeof executeAddonSlot>>) {
  if (blocks.length === 0) {
    return null
  }

  return (
    <>
      {blocks.map((block) => {
        const blockKey = `${block.addon.manifest.id}:${block.key}`

        return (
          <AddonRenderBlock
            key={blockKey}
            addonId={block.addon.manifest.id}
            blockKey={blockKey}
            result={block.result}
          />
        )
      })}
    </>
  )
}
