"use client"

import type { SiteSettingsData } from "@/lib/site-settings.types"

interface RhexClientSessionUser {
  id: number
  username: string
  nickname: string | null
  avatarPath: string | null
  role: string
  status: string
  level: number
  points: number
  vipLevel: number | null
  vipExpiresAt: string | null
}

interface RhexClientSession {
  isAuthenticated: boolean
  user: RhexClientSessionUser | null
}

type RhexClientSite = SiteSettingsData

interface RhexClientGlobalBootstrap {
  sdkVersion: 1
  session: RhexClientSession
  site: RhexClientSite | null
}

interface RhexClientWindow {
  _rhex?: RhexClientGlobalBootstrap
}

interface RhexGlobalSdkBootstrapProps {
  session: RhexClientSession
  site: RhexClientSite
}

export function RhexGlobalSdkBootstrap({
  session,
  site,
}: RhexGlobalSdkBootstrapProps) {
  if (typeof window !== "undefined") {
    const clientWindow = window as unknown as RhexClientWindow
    const current = clientWindow._rhex
    clientWindow._rhex = {
      ...current,
      sdkVersion: 1,
      session,
      site,
    }
  }

  return null
}
