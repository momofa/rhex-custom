"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import { AdminSettingsSubTabs } from "@/components/admin/admin-settings-sub-tabs"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getAdminSettingsHref, getAdminSettingsSectionTabs } from "@/lib/admin-settings-navigation"
import {
  getAdminSettingsGroups,
  getAdminSettingsGroupForSection,
  type AdminSettingsSectionKey,
} from "@/lib/admin-navigation"
import type { AdminManagementTier, AdminPermissionKey } from "@/lib/admin-permission-policy"
import { cn } from "@/lib/utils"

interface AdminSettingsWorkspaceProps {
  currentSection: AdminSettingsSectionKey
  currentSectionLabel: string
  currentSubTab?: string
  currentSubTabLabel?: string
  adminTier?: AdminManagementTier
  effectivePermissions?: AdminPermissionKey[]
  children: ReactNode
}

export function AdminSettingsWorkspace({
  currentSection,
  currentSectionLabel,
  currentSubTab,
  currentSubTabLabel,
  adminTier,
  effectivePermissions,
  children,
}: AdminSettingsWorkspaceProps) {
  const activeGroup = getAdminSettingsGroupForSection(currentSection)
  const sectionTabs = getAdminSettingsSectionTabs(currentSection)
  const effectivePermissionSet = effectivePermissions ? new Set(effectivePermissions) : undefined
  const settingsGroups = getAdminSettingsGroups(adminTier, effectivePermissionSet)

  return (
    <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
   
        <Card>

          <CardContent className="space-y-4">
            {settingsGroups.map((group, groupIndex) => (
              <div key={group.key} className="space-y-2">
                {groupIndex > 0 ? <Separator /> : null}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">
                    {group.label}
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {group.sections.length}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  {group.sections.map((section) => {
                    const active = section.key === currentSection
                    return (
                      <Link
                        key={section.key}
                        href={getAdminSettingsHref(section.key)}
                        className={cn(
                          buttonVariants({
                            variant: active ? "default" : "outline",
                            size: "sm",
                          }),
                          "h-auto w-full justify-start rounded-xl px-3 py-2 text-left",
                        )}
                      >
                        <span className="truncate">{section.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>

      <div className="space-y-6">
        <Card>
          <CardHeader >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                {activeGroup.label}
              </Badge>
         
            </div>
            <CardTitle>{currentSectionLabel}</CardTitle>
            {currentSubTabLabel && currentSubTabLabel !== currentSectionLabel ? (
              <p className="text-sm text-muted-foreground">{currentSubTabLabel}</p>
            ) : null}
          </CardHeader>
          {sectionTabs.length > 1 ? (
            <CardContent>
              <AdminSettingsSubTabs
                items={sectionTabs.map((tab) => ({
                  key: tab.key,
                  label: tab.label,
                  href: getAdminSettingsHref(currentSection, tab.key),
                }))}
                activeKey={currentSubTab ?? sectionTabs[0]?.key ?? ""}
              />
            </CardContent>
          ) : null}
        </Card>

        {children}
      </div>
    </div>
  )
}
