import { Tooltip } from "@/components/ui/tooltip"
import { VipLevelIcon } from "@/components/vip/vip-level-icon"

interface VipBadgeProps {
  level?: number | null
  compact?: boolean
  showIcon?: boolean
}

function getVipBadgeClasses(compact: boolean) {
  return compact
    ? "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]"
    : "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]"
}

function getVipBadgeStyle(level: number) {
  const colorVariableName = level >= 3
    ? "--vip-name-color-vip3"
    : level === 2
      ? "--vip-name-color-vip2"
      : "--vip-name-color-vip1"

  return {
    color: `var(${colorVariableName})`,
    borderColor: `color-mix(in srgb, var(${colorVariableName}) 34%, transparent)`,
    background: `linear-gradient(180deg, color-mix(in srgb, var(${colorVariableName}) 13%, white), color-mix(in srgb, var(${colorVariableName}) 7%, white))`,
  }
}

export function VipBadge({ level = 1, compact = false, showIcon = false }: VipBadgeProps) {
  const normalizedLevel = Math.max(1, level ?? 1)
  const label = `VIP${normalizedLevel} 会员`

  return (
    <Tooltip content={label}>
      <span className={getVipBadgeClasses(compact)} style={getVipBadgeStyle(normalizedLevel)} aria-label={label}>
        {showIcon ? (
          <VipLevelIcon
            level={normalizedLevel}
            className={compact ? "size-3.5" : "size-4"}
            title={label}
          />
        ) : null}
        VIP{normalizedLevel}
      </span>
    </Tooltip>
  )
}
