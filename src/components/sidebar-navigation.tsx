"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { LevelIcon } from "@/components/level-icon"
import { useSiteSettingsContext } from "@/components/site-settings-provider"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { LeftSidebarDisplayMode, LeftSidebarNavigationMode } from "@/lib/site-settings"
import { getSidebarNavigationDisplayModeAttribute } from "@/lib/sidebar-navigation-preference"
import { cn } from "@/lib/utils"

interface SidebarZoneItem {
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

interface SidebarBoardItem {
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

interface SidebarNavigationProps {
  zones: SidebarZoneItem[]
  boards: SidebarBoardItem[]
  activeZoneSlug?: string
  activeBoardSlug?: string
  displayMode?: LeftSidebarDisplayMode
  navigationMode?: LeftSidebarNavigationMode
  collapsed?: boolean
  onToggle?: () => void
  stickyTopClass?: string
}

export function SidebarNavigation({
  zones,
  boards,
  activeZoneSlug,
  activeBoardSlug,
  displayMode = "DEFAULT",
  navigationMode = "DEFAULT",
  collapsed = false,
  onToggle,
  stickyTopClass = "top-14",
}: SidebarNavigationProps) {
  const { leftSidebarHome } = useSiteSettingsContext()

  if (displayMode === "HIDDEN") {
    return null
  }

  const isDocked = displayMode === "DOCKED" || displayMode === "DOCKED_OPEN"
  const isTreeMode = navigationMode === "TREE"
  const baseItemClass = "flex items-center gap-3 rounded-md px-4 py-2 text-[0.933rem] leading-5 transition-colors"
  const childItemClass = "flex items-center gap-2 rounded-md py-1.5 pr-3 pl-8 text-[0.875rem] leading-5 transition-colors"
  const activeItemClass = "bg-[linear-gradient(135deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.08)_50%,rgba(255,255,255,0.08)_75%,transparent_75%,transparent)] bg-size-[8px_8px] font-medium text-foreground"
  const inactiveItemClass = "text-muted-foreground hover:bg-accent hover:text-foreground"
  const visibleZones = zones.filter((zone) => !zone.hiddenFromSidebar)
  const visibleZoneIds = new Set(visibleZones.map((zone) => zone.id))
  const boardsByZoneId = new Map<string, SidebarBoardItem[]>()
  const looseBoards: SidebarBoardItem[] = []
  for (const board of boards) {
    if (!board.zoneId || !visibleZoneIds.has(board.zoneId)) {
      looseBoards.push(board)
      continue
    }
    const zoneBoards = boardsByZoneId.get(board.zoneId) ?? []
    zoneBoards.push(board)
    boardsByZoneId.set(board.zoneId, zoneBoards)
  }
  const showHomeEntry = leftSidebarHome.enabled
  const homeLabel = leftSidebarHome.name || "首页"
  const homeIcon = leftSidebarHome.icon || "🏠"

  return (
    <div
      className={cn(
        "forum-page-sidebar hidden lg:-ml-2 lg:block",
        isDocked && "forum-page-sidebar-docked lg:ml-0",
      )}
      data-sidebar-display-mode={getSidebarNavigationDisplayModeAttribute(displayMode)}
    >
      {isDocked ? (
        <button
          type="button"
          onClick={onToggle}
          className="forum-page-sidebar-docked-rail"
          aria-label={collapsed ? "展开左侧导航" : "收起左侧导航"}
          title={collapsed ? "展开左侧导航" : "收起左侧导航"}
        >
          <ChevronLeft className="forum-page-sidebar-docked-rail-icon h-4 w-4 transition-transform" />
        </button>
      ) : null}

      <aside
        className={cn(
          "forum-page-sidebar-inner sticky h-[calc(100vh-3.5rem)] overflow-hidden py-1 pr-4",
          stickyTopClass,
          isDocked && "forum-page-sidebar-docked-inner",
        )}
      >
        <ScrollArea className="forum-page-sidebar-scroll-area h-full">
          <div className="py-4">
            <div className={cn(showHomeEntry ? "mb-6" : "mb-3")}>
              <nav className="space-y-1">
                <div
                  className={cn(
                    "forum-page-sidebar-home-row flex items-center gap-2",
                    !showHomeEntry && "mb-2 justify-end",
                  )}
                >
                  {showHomeEntry ? (
                    <Link
                      href="/"
                      className={cn(
                        baseItemClass,
                        "forum-page-home-link flex-1",
                        !activeZoneSlug && !activeBoardSlug ? activeItemClass : inactiveItemClass,
                      )}
                      title={homeLabel}
                    >
                      <LevelIcon icon={homeIcon} className="h-4 w-4 text-lg" svgClassName="[&>svg]:block" />
                      <span>{homeLabel}</span>
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={onToggle}
                    className={cn(
                      "forum-page-sidebar-toggle inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      !showHomeEntry && "ml-auto",
                    )}
                    aria-label={collapsed ? "展开左侧导航" : "收起左侧导航"}
                    title={collapsed ? "展开左侧导航" : "收起左侧导航"}
                  >
                    <ChevronLeft className="forum-page-sidebar-toggle-icon h-4 w-4 transition-transform" />
                  </button>
                </div>

                {visibleZones.map((zone) => {
                  const isActive = activeZoneSlug === zone.slug
                  const zoneBoards = isTreeMode ? boardsByZoneId.get(zone.id) ?? [] : []

                  return isTreeMode ? (
                    <div key={zone.id} className="forum-page-sidebar-tree-group">
                      <Link
                        href={`/zones/${zone.slug}`}
                        className={cn(baseItemClass, "forum-page-sidebar-item", isActive ? activeItemClass : inactiveItemClass)}
                        title={zone.name}
                      >
                        <LevelIcon icon={zone.icon} className="h-4 w-4 text-lg" svgClassName="[&>svg]:block" />
                        <span className="forum-page-sidebar-item-label">{zone.name}</span>
                      </Link>
                      {zoneBoards.length > 0 ? (
                        <div className="forum-page-sidebar-tree-children mt-1 border-l border-border/70">
                          {zoneBoards.map((board) => {
                            const boardActive = activeBoardSlug === board.slug
                            return (
                              <Link
                                key={board.id}
                                href={`/boards/${board.slug}`}
                                className={cn(childItemClass, "forum-page-sidebar-item", boardActive ? activeItemClass : inactiveItemClass)}
                                title={board.name}
                              >
                                <LevelIcon icon={board.icon} className="h-4 w-4 text-lg" svgClassName="[&>svg]:block" />
                                <span className="forum-page-sidebar-item-label truncate">{board.name}</span>
                              </Link>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <Link
                      key={zone.id}
                      href={`/zones/${zone.slug}`}
                      className={cn(baseItemClass, "forum-page-sidebar-item", isActive ? activeItemClass : inactiveItemClass)}
                      title={zone.name}
                    >
                      <LevelIcon icon={zone.icon} className="h-4 w-4 text-lg" svgClassName="[&>svg]:block" />
                      <span className="forum-page-sidebar-item-label">{zone.name}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>

            {!isTreeMode ? (
              <div>
                <div className="forum-page-sidebar-section-header mb-2 px-4">
                  <div className="flex items-center justify-between">
                    <h3 className="forum-page-sidebar-section-title text-[0.8rem] font-semibold uppercase tracking-wider text-muted-foreground">兴趣节点</h3>
                    <Link href="/funs" className="forum-page-sidebar-section-link text-[0.8rem] text-muted-foreground hover:text-foreground">全部</Link>
                    <div className="forum-page-sidebar-section-divider mx-auto hidden h-px w-8 bg-border" />
                  </div>
                </div>
                <nav className="space-y-1">
                  {boards.map((board) => {
                    const isActive = activeBoardSlug === board.slug

                    return (
                      <Link
                        key={board.id}
                        href={`/boards/${board.slug}`}
                        className={cn(baseItemClass, "forum-page-sidebar-item", isActive ? activeItemClass : inactiveItemClass)}
                        title={board.name}
                      >
                        <LevelIcon icon={board.icon} className="h-4 w-4 text-lg" svgClassName="[&>svg]:block" />
                        <span className="forum-page-sidebar-item-label truncate">{board.name}</span>
                      </Link>
                    )
                  })}
                </nav>
              </div>
            ) : looseBoards.length > 0 ? (
              <div>
                <div className="forum-page-sidebar-section-header mb-2 px-4">
                  <div className="flex items-center justify-between">
                    <h3 className="forum-page-sidebar-section-title text-[0.8rem] font-semibold uppercase tracking-wider text-muted-foreground">其他节点</h3>
                    <Link href="/funs" className="forum-page-sidebar-section-link text-[0.8rem] text-muted-foreground hover:text-foreground">全部</Link>
                    <div className="forum-page-sidebar-section-divider mx-auto hidden h-px w-8 bg-border" />
                  </div>
                </div>
                <nav className="space-y-1">
                  {looseBoards.map((board) => {
                    const isActive = activeBoardSlug === board.slug

                    return (
                      <Link
                        key={board.id}
                        href={`/boards/${board.slug}`}
                        className={cn(baseItemClass, "forum-page-sidebar-item", isActive ? activeItemClass : inactiveItemClass)}
                        title={board.name}
                      >
                        <LevelIcon icon={board.icon} className="h-4 w-4 text-lg" svgClassName="[&>svg]:block" />
                        <span className="forum-page-sidebar-item-label truncate">{board.name}</span>
                      </Link>
                    )
                  })}
                </nav>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </aside>
    </div>
  )
}
