import { normalizeLeftSidebarDisplayMode, type LeftSidebarDisplayMode } from "@/lib/site-settings-app-state"

export const SIDEBAR_COLLAPSED_STORAGE_KEY = "rhex:sidebar-navigation-collapsed"
const SIDEBAR_COLLAPSED_DOCKED_STORAGE_KEY = "rhex:sidebar-navigation-collapsed:docked"
const SIDEBAR_COLLAPSED_DOCKED_OPEN_STORAGE_KEY = "rhex:sidebar-navigation-collapsed:docked-open"
const SIDEBAR_COLLAPSED_CHANGE_EVENT = "rhex:sidebar-navigation-collapsed-change"

function getSidebarNavigationStorageKey(mode: LeftSidebarDisplayMode) {
  if (mode === "DOCKED_OPEN") {
    return SIDEBAR_COLLAPSED_DOCKED_OPEN_STORAGE_KEY
  }

  return mode === "DOCKED" ? SIDEBAR_COLLAPSED_DOCKED_STORAGE_KEY : SIDEBAR_COLLAPSED_STORAGE_KEY
}

function getDefaultSidebarCollapsed(mode: LeftSidebarDisplayMode) {
  return mode === "DOCKED" || mode === "HIDDEN"
}

function readSidebarNavigationDisplayModeFromDocument(): LeftSidebarDisplayMode {
  if (typeof document === "undefined") {
    return "DEFAULT"
  }

  return normalizeLeftSidebarDisplayMode(document.documentElement.dataset.sidebarDisplayMode, "DEFAULT")
}

function readStoredSidebarNavigationCollapsed(mode: LeftSidebarDisplayMode) {
  if (typeof window === "undefined") {
    return getDefaultSidebarCollapsed(mode)
  }

  try {
    const stored = window.localStorage.getItem(getSidebarNavigationStorageKey(mode))
    return stored === null ? getDefaultSidebarCollapsed(mode) : stored === "1"
  } catch {
    return getDefaultSidebarCollapsed(mode)
  }
}

function writeSidebarNavigationCollapsedDataset(collapsed: boolean) {
  if (typeof document === "undefined") {
    return
  }

  document.documentElement.dataset.sidebarCollapsed = collapsed ? "true" : "false"
}

export function getSidebarNavigationDisplayModeAttribute(mode?: LeftSidebarDisplayMode) {
  switch (normalizeLeftSidebarDisplayMode(mode, "DEFAULT")) {
    case "HIDDEN":
      return "hidden"
    case "DOCKED":
      return "docked"
    case "DOCKED_OPEN":
      return "docked-open"
    default:
      return "default"
  }
}

export function getSidebarNavigationInitScript() {
  return `
    try {
      var mode = (document.documentElement.dataset.sidebarDisplayMode || "").trim().toUpperCase().replace(/-/g, "_");
      var storageKey = mode === "DOCKED_OPEN"
        ? ${JSON.stringify(SIDEBAR_COLLAPSED_DOCKED_OPEN_STORAGE_KEY)}
        : mode === "DOCKED"
        ? ${JSON.stringify(SIDEBAR_COLLAPSED_DOCKED_STORAGE_KEY)}
        : ${JSON.stringify(SIDEBAR_COLLAPSED_STORAGE_KEY)};
      var stored = window.localStorage.getItem(storageKey);
      var collapsed = stored === null
      ? mode === "DOCKED" || mode === "HIDDEN"
        : stored === "1";
      document.documentElement.dataset.sidebarCollapsed = collapsed ? "true" : "false";
    } catch (_error) {
      var fallbackMode = (document.documentElement.dataset.sidebarDisplayMode || "").trim().toUpperCase().replace(/-/g, "_");
      document.documentElement.dataset.sidebarCollapsed = fallbackMode === "DOCKED" || fallbackMode === "HIDDEN" ? "true" : "false";
    }
  `
}

export function readSidebarNavigationCollapsedSnapshot() {
  if (typeof document === "undefined") {
    return false
  }

  return document.documentElement.dataset.sidebarCollapsed === "true"
}

export function subscribeSidebarNavigationPreference(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined
  }

  const handleChange = () => {
    onStoreChange()
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === SIDEBAR_COLLAPSED_STORAGE_KEY ||
      event.key === SIDEBAR_COLLAPSED_DOCKED_STORAGE_KEY ||
      event.key === SIDEBAR_COLLAPSED_DOCKED_OPEN_STORAGE_KEY
    ) {
      onStoreChange()
    }
  }

  window.addEventListener(SIDEBAR_COLLAPSED_CHANGE_EVENT, handleChange)
  window.addEventListener("storage", handleStorage)

  return () => {
    window.removeEventListener(SIDEBAR_COLLAPSED_CHANGE_EVENT, handleChange)
    window.removeEventListener("storage", handleStorage)
  }
}

export function setSidebarNavigationCollapsedPreference(collapsed: boolean) {
  if (typeof document === "undefined") {
    return
  }

  const mode = readSidebarNavigationDisplayModeFromDocument()
  if (mode === "HIDDEN") {
    return
  }

  try {
    window.localStorage.setItem(getSidebarNavigationStorageKey(mode), collapsed ? "1" : "0")
  } catch {
    // Ignore storage failures and still update the in-memory DOM snapshot.
  }

  writeSidebarNavigationCollapsedDataset(collapsed)

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_CHANGE_EVENT))
  }
}

export function resetSidebarNavigationCollapsedPreference() {
  const mode = readSidebarNavigationDisplayModeFromDocument()
  writeSidebarNavigationCollapsedDataset(readStoredSidebarNavigationCollapsed(mode))
}
