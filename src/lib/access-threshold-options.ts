import type { LevelDefinitionItem } from "@/lib/level-system"

export interface AccessThresholdOption {
  value: string
  label: string
  description: string
}

export function buildUserLevelThresholdOptions(levels: LevelDefinitionItem[]): AccessThresholdOption[] {
  return [
    {
      value: "0",
      label: "公开可见",
      description: "不限制用户等级，所有满足节点权限的用户都可以查看。",
    },
    ...levels.map((level) => ({
      value: String(level.level),
      label: `Lv.${level.level} · ${level.name}`,
      description: `至少达到 Lv.${level.level} 才能查看帖子正文。`,
    })),
  ]
}

export function buildVipLevelThresholdOptions(maxVipLevel = 3): AccessThresholdOption[] {
  return [
    {
      value: "0",
      label: "不限制 VIP",
      description: "不限制 VIP 等级，仅按普通用户等级门槛判断。",
    },
    ...Array.from({ length: Math.max(0, maxVipLevel) }, (_, index) => {
      const vipLevel = index + 1

      return {
        value: String(vipLevel),
        label: `VIP${vipLevel}`,
        description: `至少达到 VIP${vipLevel} 才能查看帖子正文。`,
      }
    }),
  ]
}
