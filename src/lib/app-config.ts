import {
  revalidateTag,
  unstable_cache,
} from "next/cache"

import {
  createSiteSettingsAppStateRecord,
  findSiteSettingsAppStateRecord,
  updateSiteSettingsAppState,
} from "@/db/app-config-queries"
import { SITE_SETTINGS_CACHE_TAG } from "@/lib/site-settings"




const APP_CONFIG_KEYS = {
  gobang: "app.gobang",
  selfServeAds: "app.self-serve-ads",
  yinYangContract: "app.yinyang-contract",
} as const

export const APP_CONFIG_CACHE_TAG = "app-config"



export type AppConfigValue = Record<string, boolean | number | string>

type PluginStateRecord = {
  AppId: string
  enabled: boolean
  installedAt: string | null
  uninstalledAt: string | null
  config: Record<string, unknown>
  status: string
  version: string | null
  sourceDir: string | null
  lastActivatedAt: string | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
  failureCount: number
}

type PluginStateMap = Record<string, PluginStateRecord>

function parsePluginState(raw: string | null | undefined): PluginStateMap {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as PluginStateMap
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function serializePluginState(state: PluginStateMap) {
  return JSON.stringify(state)
}

async function getOrCreateSiteSettingsRecord() {
  const existing = await findSiteSettingsAppStateRecord()

  if (existing) {
    return existing
  }

  return createSiteSettingsAppStateRecord()
}


async function readStateMap() {
  const settings = await getOrCreateSiteSettingsRecord()
  return {
    settings,
    state: parsePluginState(settings.appStateJson),
  }
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "on"].includes(normalized)) return true
    if (["false", "0", "off"].includes(normalized)) return false
  }
  return fallback
}

import { parseSafeInteger } from "@/lib/shared/safe-integer"

function normalizeNumber(value: unknown, fallback: number) {
  return parseSafeInteger(value) ?? fallback
}


function normalizeText(value: unknown, fallback: string) {
  const resolved = String(value ?? fallback).trim()
  return resolved || fallback
}

function normalizeConfig(defaults: AppConfigValue, input?: Record<string, unknown>): AppConfigValue {
  const next = { ...defaults }
  for (const key of Object.keys(defaults)) {
    const fallback = defaults[key]
    const rawValue = input?.[key]
    if (typeof fallback === "boolean") {
      next[key] = normalizeBoolean(rawValue, fallback)
    } else if (typeof fallback === "number") {
      next[key] = normalizeNumber(rawValue, fallback)
    } else {
      next[key] = normalizeText(rawValue, fallback)
    }
  }
  return next
}

async function upsertAppConfig(configKey: string, defaults: AppConfigValue, input?: Record<string, unknown>) {
  const { settings, state } = await readStateMap()
  const previous = state[configKey]
  const nextConfig = normalizeConfig(defaults, {
    ...(previous?.config ?? {}),
    ...(input ?? {}),
  })

  state[configKey] = {
    AppId: configKey,
    enabled: true,
    installedAt: previous?.installedAt ?? new Date().toISOString(),
    uninstalledAt: null,
    config: nextConfig,
    status: "active",
    version: previous?.version ?? "hosted",
    sourceDir: previous?.sourceDir ?? "src",
    lastActivatedAt: previous?.lastActivatedAt ?? new Date().toISOString(),
    lastErrorAt: null,
    lastErrorMessage: null,
    failureCount: 0,
  }

  await updateSiteSettingsAppState(settings.id, serializePluginState(state))
  revalidateAppConfigCache()


  return nextConfig
}

function revalidateAppConfigTag(tag: string) {
  try {
    revalidateTag(tag, "max")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.startsWith("Invariant: static generation store missing in revalidateTag")
      || message.includes('used "revalidateTag ')
    ) {
      return
    }

    throw error
  }
}

export function revalidateAppConfigCache() {
  revalidateAppConfigTag(APP_CONFIG_CACHE_TAG)
  revalidateAppConfigTag(SITE_SETTINGS_CACHE_TAG)
}

export const GOBANG_DEFAULT_CONFIG = {
  enabled: true,
  dailyFreeGames: 1,
  dailyVipFreeGames: 2,
  dailyNormalGameLimit: 3,
  dailyVipGameLimit: 5,
  ticketCost: 10,
  aiLevel: 2,
  winReward: 20,
  matchLabel: "五子棋人机对战",
} satisfies AppConfigValue

export const SELF_SERVE_ADS_DEFAULT_CONFIG = {
  enabled: true,
  visibleOnHome: true,
  visibleOnPostDetail: false,
  visibleOnGlobalSidebar: false,
  cardTitle: "推广广告位",

  sidebarSlot: "home-right-middle",
  sidebarOrder: 40,
  imageSlotCount: 2,
  textSlotCount: 6,
  imagePriceMonthly: 300,
  imagePriceQuarterly: 800,
  imagePriceSemiAnnual: 1500,
  imagePriceYearly: 2800,
  textPriceMonthly: 120,
  textPriceQuarterly: 320,
  textPriceSemiAnnual: 600,
  textPriceYearly: 1100,
  placeholderLabel: "点击购买",
} satisfies AppConfigValue

export const YINYANG_CONTRACT_DEFAULT_CONFIG = {
  enabled: true,
  entryLabel: "阴阳契",
  taxRateBps: 1000,
  minStakePoints: 10,
  maxStakePoints: 500,
  dailyCreateLimit: 5,
  dailyAcceptLimit: 10,
} satisfies AppConfigValue


async function readGobangAppConfig() {
  const { state } = await readStateMap()
  return normalizeConfig(GOBANG_DEFAULT_CONFIG, state[APP_CONFIG_KEYS.gobang]?.config)
}

const getPersistentGobangAppConfig = unstable_cache(
  readGobangAppConfig,
  ["app-config:gobang"],
  {
    tags: [APP_CONFIG_CACHE_TAG, SITE_SETTINGS_CACHE_TAG],
    revalidate: 60,
  },
)

export async function getGobangAppConfig() {
  return getPersistentGobangAppConfig()
}

export async function updateGobangAppConfig(input: Record<string, unknown>) {
  return upsertAppConfig(APP_CONFIG_KEYS.gobang, GOBANG_DEFAULT_CONFIG, input)
}

async function readSelfServeAdsAppConfig() {
  const { state } = await readStateMap()
  return normalizeConfig(SELF_SERVE_ADS_DEFAULT_CONFIG, state[APP_CONFIG_KEYS.selfServeAds]?.config)
}

const getPersistentSelfServeAdsAppConfig = unstable_cache(
  readSelfServeAdsAppConfig,
  ["app-config:self-serve-ads"],
  {
    tags: [APP_CONFIG_CACHE_TAG, SITE_SETTINGS_CACHE_TAG],
    revalidate: 60,
  },
)

export async function getSelfServeAdsAppConfig() {
  return getPersistentSelfServeAdsAppConfig()
}

export async function updateSelfServeAdsAppConfig(input: Record<string, unknown>) {
  return upsertAppConfig(APP_CONFIG_KEYS.selfServeAds, SELF_SERVE_ADS_DEFAULT_CONFIG, input)
}

async function readYinYangContractAppConfig() {
  const { state } = await readStateMap()
  return normalizeConfig(YINYANG_CONTRACT_DEFAULT_CONFIG, state[APP_CONFIG_KEYS.yinYangContract]?.config)
}

const getPersistentYinYangContractAppConfig = unstable_cache(
  readYinYangContractAppConfig,
  ["app-config:yinyang-contract"],
  {
    tags: [APP_CONFIG_CACHE_TAG, SITE_SETTINGS_CACHE_TAG],
    revalidate: 60,
  },
)

export async function getYinYangContractAppConfig() {
  return getPersistentYinYangContractAppConfig()
}

export async function updateYinYangContractAppConfig(input: Record<string, unknown>) {
  return upsertAppConfig(APP_CONFIG_KEYS.yinYangContract, YINYANG_CONTRACT_DEFAULT_CONFIG, input)
}

