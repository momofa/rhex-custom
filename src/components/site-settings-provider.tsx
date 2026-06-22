"use client"

import { createContext, useContext, useMemo } from "react"

import { normalizeEditorToolbarSettings, type EditorToolbarSettings } from "@/lib/editor-toolbar-settings"
import { DEFAULT_MARKDOWN_EMOJI_ITEMS, type MarkdownEmojiItem } from "@/lib/markdown-emoji"
import type { LeftSidebarDisplayMode, LeftSidebarHomeSettings, LeftSidebarNavigationMode } from "@/lib/site-settings"
import { DEFAULT_VIP_LEVEL_ICONS, normalizeVipLevelIcons, type VipLevelIcons } from "@/lib/vip-level-icons"

interface SiteSettingsContextValue {
  markdownEmojiMap: MarkdownEmojiItem[]
  markdownImageUploadEnabled: boolean
  leftSidebarDisplayMode: LeftSidebarDisplayMode
  leftSidebarNavigationMode: LeftSidebarNavigationMode
  leftSidebarHome: LeftSidebarHomeSettings
  vipLevelIcons: VipLevelIcons
  editorToolbar: EditorToolbarSettings
}

const defaultSiteSettingsContextValue: SiteSettingsContextValue = {
  markdownEmojiMap: DEFAULT_MARKDOWN_EMOJI_ITEMS,
  markdownImageUploadEnabled: true,
  leftSidebarDisplayMode: "DEFAULT",
  leftSidebarNavigationMode: "DEFAULT",
  leftSidebarHome: {
    enabled: true,
    name: "首页",
    icon: "🏠",
  },
  vipLevelIcons: DEFAULT_VIP_LEVEL_ICONS,
  editorToolbar: normalizeEditorToolbarSettings(),
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>(defaultSiteSettingsContextValue)

interface SiteSettingsProviderProps {
  children: React.ReactNode
  markdownEmojiMap?: MarkdownEmojiItem[]
  markdownImageUploadEnabled?: boolean
  leftSidebarDisplayMode?: LeftSidebarDisplayMode
  leftSidebarNavigationMode?: LeftSidebarNavigationMode
  leftSidebarHome?: LeftSidebarHomeSettings
  vipLevelIcons?: VipLevelIcons
  editorToolbar?: EditorToolbarSettings
}

export function SiteSettingsProvider({ children, markdownEmojiMap, markdownImageUploadEnabled = true, leftSidebarDisplayMode = "DEFAULT", leftSidebarNavigationMode = "DEFAULT", leftSidebarHome, vipLevelIcons, editorToolbar }: SiteSettingsProviderProps) {
  const value = useMemo<SiteSettingsContextValue>(() => ({
    markdownEmojiMap: markdownEmojiMap && markdownEmojiMap.length > 0 ? markdownEmojiMap : DEFAULT_MARKDOWN_EMOJI_ITEMS,
    markdownImageUploadEnabled,
    leftSidebarDisplayMode,
    leftSidebarNavigationMode,
    leftSidebarHome: leftSidebarHome ?? defaultSiteSettingsContextValue.leftSidebarHome,
    vipLevelIcons: normalizeVipLevelIcons(vipLevelIcons),
    editorToolbar: normalizeEditorToolbarSettings(editorToolbar),
  }), [editorToolbar, leftSidebarDisplayMode, leftSidebarHome, leftSidebarNavigationMode, markdownEmojiMap, markdownImageUploadEnabled, vipLevelIcons])

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>
}

export function useSiteSettingsContext() {
  return useContext(SiteSettingsContext)
}

export function useMarkdownEmojiMap(override?: MarkdownEmojiItem[]) {
  const context = useSiteSettingsContext()
  if (override && override.length > 0) {
    return override
  }
  return context.markdownEmojiMap
}

export function useMarkdownImageUploadEnabled(override?: boolean) {
  const context = useSiteSettingsContext()
  if (typeof override === "boolean") {
    return override
  }
  return context.markdownImageUploadEnabled
}

export function useVipLevelIcons(override?: VipLevelIcons) {
  const context = useSiteSettingsContext()
  if (override) {
    return normalizeVipLevelIcons(override)
  }
  return context.vipLevelIcons
}

export function useEditorToolbarSettings(override?: EditorToolbarSettings) {
  const context = useSiteSettingsContext()
  if (override) {
    return normalizeEditorToolbarSettings(override)
  }
  return context.editorToolbar
}
