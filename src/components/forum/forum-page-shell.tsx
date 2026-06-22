"use client"

import { cloneElement, isValidElement, useSyncExternalStore, type ReactNode } from "react"
import { PanelRightOpen } from "lucide-react"

import { SidebarNavigation } from "@/components/sidebar-navigation"
import { useSiteSettingsContext } from "@/components/site-settings-provider"
import { Button } from "@/components/ui/rbutton"
import { Sidebar, SidebarContent, SidebarProvider, useSidebar } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import type { LeftSidebarDisplayMode } from "@/lib/site-settings"
import { cn } from "@/lib/utils"
import {
  getSidebarNavigationDisplayModeAttribute,
  readSidebarNavigationCollapsedSnapshot,
  setSidebarNavigationCollapsedPreference,
  subscribeSidebarNavigationPreference,
} from "@/lib/sidebar-navigation-preference"

interface ForumPageShellZoneItem {
  id: string
  slug: string
  name: string
  icon: string
  hiddenFromSidebar?: boolean
  minViewPoints?: number
  minViewLevel?: number
  vipViewOnly?: boolean
  minViewVipLevel?: number
}

interface ForumPageShellBoardItem {
  id: string
  zoneId?: string | null
  slug: string
  name: string
  icon: string
  minViewPoints?: number
  minViewLevel?: number
  vipViewOnly?: boolean
  minViewVipLevel?: number
}

interface ForumPageShellProps {
  zones: ForumPageShellZoneItem[]
  boards: ForumPageShellBoardItem[]
  activeZoneSlug?: string
  activeBoardSlug?: string
  main: ReactNode
  rightSidebar?: ReactNode
  leftSidebarDisplayModeOverride?: LeftSidebarDisplayMode
  sidebarStickyTopClass?: string
}

const FORUM_MOBILE_SIDEBAR_BREAKPOINT = 1024

type MobileRightSidebarElementProps = {
  className?: string
  "data-mobile-right-sidebar"?: string
}

function normalizeMobileRightSidebarClassName(className?: string) {
  const filteredClassName = (className ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token !== "hidden" && token !== "lg:block" && token !== "mt-6" && token !== "pb-12")
    .join(" ")

  return cn(filteredClassName, "mt-0 block pb-6")
}

function buildMobileRightSidebarContent(rightSidebar: ReactNode) {
  if (!rightSidebar) {
    return null
  }

  if (isValidElement<MobileRightSidebarElementProps>(rightSidebar)) {
    return cloneElement(rightSidebar, {
      className: normalizeMobileRightSidebarClassName(rightSidebar.props.className),
      "data-mobile-right-sidebar": "true",
    })
  }

  return (
    <div data-mobile-right-sidebar="true" className="pb-6">
      {rightSidebar}
    </div>
  )
}

function MobileRightSidebarToggle() {
  const { openMobile, setOpenMobile } = useSidebar()

  if (openMobile) {
    return null
  }

  return (
    <Button
      type="button"
      variant="outline"
      aria-label="打开全局右侧栏"
      aria-expanded={openMobile}
      className="fixed top-1/2 right-0 z-[60] h-11 -translate-y-1/2 rounded-r-none rounded-l-[18px] border-r-0 border-border bg-background/95 px-3 text-foreground shadow-lg shadow-black/15 backdrop-blur-md lg:hidden"
      onClick={() => setOpenMobile(true)}
    >
      <PanelRightOpen data-icon="inline-start" />
    </Button>
  )
}

function MobileRightSidebarSheet({ content }: { content: ReactNode }) {
  return (
    <Sidebar
      side="right"
      className="bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted))_100%)] text-foreground"
    >

      <SidebarContent className="px-0 pb-4 pt-0">
        {content}
      </SidebarContent>
    </Sidebar>
  )
}

export function ForumPageShell({
  zones,
  boards,
  activeZoneSlug,
  activeBoardSlug,
  main,
  rightSidebar,
  leftSidebarDisplayModeOverride,
  sidebarStickyTopClass,
}: ForumPageShellProps) {
  const { leftSidebarDisplayMode, leftSidebarNavigationMode } = useSiteSettingsContext()
  const resolvedLeftSidebarDisplayMode = leftSidebarDisplayModeOverride ?? leftSidebarDisplayMode
  const sidebarCollapsed = useSyncExternalStore(subscribeSidebarNavigationPreference, readSidebarNavigationCollapsedSnapshot, () => false)
  const shouldUseMobileRightSidebar = useIsMobile(FORUM_MOBILE_SIDEBAR_BREAKPOINT)
  const mobileRightSidebar = buildMobileRightSidebarContent(rightSidebar)
  const hasRightSidebar = Boolean(rightSidebar)

  function handleToggleSidebar() {
    setSidebarNavigationCollapsedPreference(!sidebarCollapsed)
  }

  return (
    <SidebarProvider mobileBreakpoint={FORUM_MOBILE_SIDEBAR_BREAKPOINT} className="min-h-0 flex-col bg-transparent">
      {shouldUseMobileRightSidebar && mobileRightSidebar ? (
        <>
          <MobileRightSidebarToggle />
          <MobileRightSidebarSheet content={mobileRightSidebar} />
        </>
      ) : null}

      <div
        className="forum-page-shell grid grid-cols-1 gap-6"
        data-sidebar-display-mode={getSidebarNavigationDisplayModeAttribute(resolvedLeftSidebarDisplayMode)}
        data-has-right-sidebar={hasRightSidebar ? "true" : "false"}
      >
        <SidebarNavigation
          zones={zones}
          boards={boards}
          activeZoneSlug={activeZoneSlug}
          activeBoardSlug={activeBoardSlug}
          displayMode={resolvedLeftSidebarDisplayMode}
          navigationMode={leftSidebarNavigationMode}
          collapsed={sidebarCollapsed}
          onToggle={handleToggleSidebar}
          stickyTopClass={sidebarStickyTopClass}
        />
        <div className="forum-page-main min-w-0" data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}>{main}</div>
        <div className="forum-page-right-sidebar min-w-0 w-full justify-self-end *:w-full *:max-w-full">{rightSidebar}</div>
      </div>
    </SidebarProvider>
  )
}
