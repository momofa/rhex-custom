export type AddonManagementAction = "sync" | "clear-cache" | "enable" | "disable" | "remove"

export interface AddonAdminItem {
  id: string
  name: string
  author: string | null
  version: string
  description: string
  enabled: boolean
  stateLabel: "enabled" | "disabled"
  loadError: string | null
  warnings: string[]
  permissions: string[]
  installedAt: string | null
  disabledAt: string | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
  counts: {
    slots: number
    surfaces: number
    publicPages: number
    adminPages: number
    publicApis: number
    adminApis: number
    providers: number
    hooks: number
  }
  paths: {
    publicPage: string
    adminPage: string
    publicApiBase: string
    adminApiBase: string
    assetBase: string
  }
  canEnable: boolean
  canDisable: boolean
  canRemove: boolean
}

export interface AddonsAdminData {
  storageMode: "database" | "file"
  items: AddonAdminItem[]
  summary: {
    total: number
    enabled: number
    disabled: number
    errored: number
  }
}

export interface AddonLifecycleLogItem {
  id: string
  action: string
  status: string
  message: string | null
  createdAt: string
}

export interface AddonExtensionPointItem {
  label: string
  meta: string
  description?: string
}

export interface AddonAdminDetailData {
  storageMode: "database" | "file"
  item: AddonAdminItem
  logs: AddonLifecycleLogItem[]
}

export interface AddonInstallPermissionItem {
  key: string
  risk: "normal" | "sensitive"
}

export interface AddonInstallProvidesPreview {
  slots: string[]
  surfaces: string[]
  pages: string[]
  adminPages: string[]
  publicApis: string[]
  adminApis: string[]
  backgroundJobs: string[]
  providers: string[]
  hooks: string[]
}

export interface AddonInstallPreviewData {
  addonId: string
  name: string
  version: string
  description: string | null
  permissions: AddonInstallPermissionItem[]
  provides: AddonInstallProvidesPreview
  installAction: "install" | "upgrade" | "overwrite"
  existingVersion: string | null
  hasExisting: boolean
  requiresReplaceConfirmation: boolean
  enableAfterInstall: boolean
  relationBlockingIssues: string[]
  relationWarnings: string[]
  canInstall: boolean
}
