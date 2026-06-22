import { config as loadDotenv } from "dotenv"
import { resolve } from "node:path"

import { resolveTurnstileCaptchaRepair } from "@/lib/admin-captcha-settings"
import { mergeSmsProviderSettings, resolveSmsProviderSettings } from "@/lib/site-settings-app-state"
import { resolveCaptchaSensitiveConfig } from "@/lib/site-settings-sensitive-state"

loadDotenv({ path: resolve(process.cwd(), ".env") })

async function main() {
  const { prisma } = await import("@/db/client")
  prismaDisconnect = () => prisma.$disconnect()

  const settings = await prisma.siteSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      registerCaptchaMode: true,
      loginCaptchaMode: true,
      turnstileSiteKey: true,
      appStateJson: true,
      sensitiveStateJson: true,
    },
  })

  if (!settings) {
    console.log("未找到站点设置，无需修复。")
    return
  }

  const smsProviderSettings = resolveSmsProviderSettings({ appStateJson: settings.appStateJson })
  const captchaSensitiveConfig = resolveCaptchaSensitiveConfig(settings.sensitiveStateJson)
  const repair = resolveTurnstileCaptchaRepair({
    registerCaptchaMode: settings.registerCaptchaMode,
    loginCaptchaMode: settings.loginCaptchaMode,
    smsCaptchaMode: smsProviderSettings.captchaMode,
    turnstileSiteKey: settings.turnstileSiteKey,
    turnstileSecretKey: captchaSensitiveConfig.turnstileSecretKey,
  })

  if (!repair.requiresRepair) {
    console.log("Turnstile 验证码配置完整或未启用，无需修复。")
    return
  }

  const appStateJson = mergeSmsProviderSettings(settings.appStateJson, {
    ...smsProviderSettings,
    captchaMode: repair.smsCaptchaMode,
  })

  await prisma.siteSetting.update({
    where: { id: settings.id },
    data: {
      registerCaptchaMode: repair.registerCaptchaMode,
      loginCaptchaMode: repair.loginCaptchaMode,
      turnstileSiteKey: null,
      appStateJson,
    },
  })

  console.log("已修复 Turnstile 验证码锁定：缺少密钥的 TURNSTILE 模式已改为 OFF。")
  console.log(`注册验证码：${settings.registerCaptchaMode} -> ${repair.registerCaptchaMode}`)
  console.log(`登录验证码：${settings.loginCaptchaMode} -> ${repair.loginCaptchaMode}`)
  console.log(`短信发送前校验：${smsProviderSettings.captchaMode} -> ${repair.smsCaptchaMode}`)
}

let prismaDisconnect: (() => Promise<void>) | null = null

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    if (prismaDisconnect) {
      await prismaDisconnect()
    }
  })
