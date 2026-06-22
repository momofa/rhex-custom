export type HomeSidebarSlot = "home-right-top" | "home-right-middle" | "home-right-bottom"

export interface HomeSidebarPanelItem {
  id: string
  slot: HomeSidebarSlot
  order: number
  content: React.ReactNode
}

export interface HomeSidebarPanelGroups {
  top: HomeSidebarPanelItem[]
  middle: HomeSidebarPanelItem[]
  bottom: HomeSidebarPanelItem[]
}

function sortPanels(items: HomeSidebarPanelItem[]) {
  return [...items].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
}

export function groupHomeSidebarPanels(items: HomeSidebarPanelItem[]): HomeSidebarPanelGroups {
  return {
    top: sortPanels(items.filter((item) => item.slot === "home-right-top")),
    middle: sortPanels(items.filter((item) => item.slot === "home-right-middle")),
    bottom: sortPanels(items.filter((item) => item.slot === "home-right-bottom")),
  }
}
