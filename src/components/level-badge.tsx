import { LevelIcon } from "@/components/level-icon"

interface LevelBadgeProps {
  level: number
  name: string
  color: string
  icon: string
  compact?: boolean
  size?: "default" | "large"
}

export function LevelBadge({ level, name, color, icon, compact = false, size }: LevelBadgeProps) {
  const resolvedSize = compact ? "compact" : (size ?? "default")
  const badgeClassName = resolvedSize === "compact"
    ? "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
    : resolvedSize === "large"
      ? "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
      : "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
  const iconClassName = resolvedSize === "compact"
    ? "size-3 text-[12px]"
    : resolvedSize === "large"
      ? "size-8 text-[30px]"
      : "size-3.5 text-[14px]"

  return (
    <span
      className={badgeClassName}
      style={{
        color,
        backgroundColor: `${color}1A`,
        border: `1px solid ${color}33`,
      }}
    >
      <LevelIcon icon={icon} color={color} className={iconClassName} emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
      <span>{name}</span>
      <span>Lv.{level}</span>
    </span>
  )
}

