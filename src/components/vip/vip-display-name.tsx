import { VipNameTooltip } from "@/components/vip/vip-name-tooltip"
import { cn } from "@/lib/utils"
import { getVipNameClass } from "@/lib/vip-status"

interface VipDisplayNameProps {
  name: string
  isVip?: boolean
  vipLevel?: number | null
  emphasize?: boolean
  medium?: boolean
  interactive?: boolean
  className?: string
}

export function VipDisplayName({
  name,
  isVip,
  vipLevel,
  emphasize = false,
  medium = false,
  interactive = false,
  className,
}: VipDisplayNameProps) {
  return (
    <VipNameTooltip isVip={isVip} level={vipLevel}>
      <span className={cn(getVipNameClass(isVip, vipLevel, { emphasize, medium, interactive }), className)}>
        {name}
      </span>
    </VipNameTooltip>
  )
}
