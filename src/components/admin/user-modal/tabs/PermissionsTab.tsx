"use client"

import type { AdminUserListResult } from "@/lib/admin-user-management"
import { ADMIN_PERMISSION_CATALOG } from "@/lib/admin-permission-catalog"

import { ActionButtons } from "@/components/admin/user-modal/components/ActionButtons"
import { TextAreaField } from "@/components/admin/user-modal/components/FormFields"
import { PermissionEditor } from "@/components/admin/user-modal/components/PermissionEditor"
import { UserInfoGrid } from "@/components/admin/user-modal/components/UserInfo"
import type { UserActionsState } from "@/components/admin/user-modal/hooks/use-user-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

export function PermissionsTab({
  activeUser,
  moderatorScopeOptions,
  actorUserId,
  actorCanDemoteAdmins,
  isModerator,
  permissions,
  isPending,
}: {
  activeUser: {
    id: number
    username: string
    role: string
    effectiveAdminPermissions?: string[]
    editableAdminPermissions?: string[]
    canEditAdminPermissions?: boolean
  }
  moderatorScopeOptions: AdminUserListResult["moderatorScopeOptions"]
  actorUserId: number
  actorCanDemoteAdmins: boolean
  isModerator: boolean
  permissions: UserActionsState["permissions"]
  isPending: boolean
}) {
  const canPromoteModerator = activeUser.role === "USER"
  const canSetAdmin = activeUser.role !== "ADMIN"
  const canDemote = activeUser.role === "MODERATOR"
    || (activeUser.role === "ADMIN" && actorCanDemoteAdmins && activeUser.id !== actorUserId)
  const editableAdminPermissions = new Set(activeUser.editableAdminPermissions ?? [])
  const effectiveAdminPermissions = new Set(activeUser.effectiveAdminPermissions ?? [])
  const canEditAdminPermissions = Boolean(activeUser.canEditAdminPermissions)
  const adminPermissionGrants = new Map(permissions.state.adminPermissionGrants.map((item) => [item.permissionKey, item.allowed]))
  const groupedAdminPermissions = ADMIN_PERMISSION_CATALOG
    .filter((item) => editableAdminPermissions.has(item.key))
    .reduce<Record<string, typeof ADMIN_PERMISSION_CATALOG[number][]>>((groups, item) => {
      const key = item.group
      groups[key] = [...(groups[key] ?? []), item]
      return groups
    }, {})

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-border p-4">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold">权限身份</h4>
          <p className="text-xs text-muted-foreground">提权、降权和版主管辖范围配置集中在这里。</p>
        </div>
        <div className="mt-4">
          <UserInfoGrid
            compact
            columnsClassName="sm:grid-cols-2 xl:grid-cols-3"
            items={[
              { label: "当前角色", value: activeUser.role },
              { label: "分区授权", value: `${permissions.state.zoneScopes.length} 个` },
              { label: "节点授权", value: `${permissions.state.boardScopes.length} 个` },
            ]}
          />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <TextAreaField label="操作备注" value={permissions.state.message} onChange={permissions.setMessage} placeholder="记录提权、降权或权限调整原因" rows={4} />
          <ActionButtons
            items={[
              {
                key: "promote-moderator",
                label: isPending ? "处理中..." : "设为版主",
                hidden: !canPromoteModerator,
                disabled: isPending,
                onClick: () => permissions.runPermissionAction("user.promoteModerator"),
              },
              {
                key: "set-admin",
                label: isPending ? "处理中..." : "设为管理员",
                hidden: !canSetAdmin,
                disabled: isPending,
                onClick: () => permissions.runPermissionAction("user.setAdmin", `确认将 @${activeUser.username} 提升为管理员吗？`),
              },
              {
                key: "demote",
                label: isPending ? "处理中..." : "降为普通用户",
                hidden: !canDemote,
                disabled: isPending,
                onClick: () => permissions.runPermissionAction("user.demoteToUser", `确认将 @${activeUser.username} 降为普通用户吗？`),
              },
            ]}
          />
          {permissions.state.feedback ? <p className="text-xs text-muted-foreground">{permissions.state.feedback}</p> : null}
        </div>
      </section>

      {activeUser.role === "ADMIN" ? (
        <section className="rounded-xl border border-border p-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold">管理员动态权限</h4>
            <p className="text-xs text-muted-foreground">
              超级管理员可以为管理员授予站点、应用、插件、主题等高风险权限；未授权的权限保持默认规则。
            </p>
          </div>
          {canEditAdminPermissions && Object.keys(groupedAdminPermissions).length > 0 ? (
            <div className="mt-4 flex flex-col gap-4">
              {Object.entries(groupedAdminPermissions).map(([group, items]) => (
                <div key={group} className="rounded-xl border border-border/70 bg-secondary/15 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-muted-foreground">{getAdminPermissionGroupLabel(group)}</p>
                    <Badge variant="outline" className="rounded-full text-[10px]">{items.length} 项</Badge>
                  </div>
                  <div className="flex flex-col gap-3">
                    {items.map((item) => {
                      const grant = adminPermissionGrants.get(item.key)
                      const defaultAllowed = effectiveAdminPermissions.has(item.key)
                      const checked = grant ?? defaultAllowed
                      const overrideText = grant === undefined
                        ? (defaultAllowed ? "默认允许" : "默认关闭")
                        : (grant ? "已覆盖为允许" : "已覆盖为拒绝")

                      return (
                        <div key={item.key} className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">{item.label}</p>
                              {"highRisk" in item && item.highRisk ? <Badge variant="destructive" className="rounded-full text-[10px]">高风险</Badge> : null}
                              <Badge variant={grant === undefined ? "secondary" : "default"} className="rounded-full text-[10px]">
                                {overrideText}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                          </div>
                          <Switch
                            checked={checked}
                            onCheckedChange={(value) => permissions.toggleAdminPermissionGrant(item.key, Boolean(value))}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {permissions.state.adminPermissionFeedback ? <p className="text-xs text-muted-foreground">{permissions.state.adminPermissionFeedback}</p> : null}
              <Button type="button" disabled={isPending} className="h-9 rounded-full px-4 text-xs" onClick={permissions.saveAdminPermissions}>
                {isPending ? "保存中..." : "保存管理员动态权限"}
              </Button>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
              {activeUser.id === actorUserId ? "不能编辑自己的管理员权限。" : "只有超级管理员可以编辑其他管理员的动态权限。"}
            </div>
          )}
        </section>
      ) : null}

      {isModerator && moderatorScopeOptions ? (
        <section className="rounded-xl border border-border p-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold">版主管辖范围</h4>
            <p className="text-xs text-muted-foreground">分区授权自动覆盖分区下全部节点；“可改设置”控制结构编辑，“可提金库”控制节点金库提取权限。</p>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <PermissionEditor
              title="分区授权"
              items={moderatorScopeOptions.zones.map((zone) => ({
                id: zone.id,
                label: zone.name,
                description: `/${zone.slug}`,
              }))}
              activeScopes={permissions.state.zoneScopes}
              onToggle={permissions.toggleZoneScope}
              onToggleEdit={permissions.toggleZoneScopeEdit}
              onToggleWithdraw={permissions.toggleZoneScopeWithdraw}
            />
            <PermissionEditor
              title="节点授权"
              items={moderatorScopeOptions.boards.map((board) => ({
                id: board.id,
                label: board.name,
                description: `${board.zoneName ? `${board.zoneName} / ` : ""}/${board.slug}`,
              }))}
              activeScopes={permissions.state.boardScopes}
              onToggle={permissions.toggleBoardScope}
              onToggleEdit={permissions.toggleBoardScopeEdit}
              onToggleWithdraw={permissions.toggleBoardScopeWithdraw}
            />
            {permissions.state.scopeFeedback ? <p className="text-xs text-muted-foreground">{permissions.state.scopeFeedback}</p> : null}
            <Button type="button" disabled={isPending} className="h-9 rounded-full px-4 text-xs" onClick={permissions.saveModeratorScopes}>
              {isPending ? "保存中..." : "保存版主管辖范围"}
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
          当前用户不是版主，无需配置版主管辖范围。
        </section>
      )}
    </div>
  )
}

function getAdminPermissionGroupLabel(group: string) {
  switch (group) {
    case "dashboard":
      return "控制台"
    case "content":
      return "内容与版块"
    case "users":
      return "用户与身份"
    case "operations":
      return "运营与风控"
    case "system":
      return "系统核心"
    default:
      return "其他权限"
  }
}
