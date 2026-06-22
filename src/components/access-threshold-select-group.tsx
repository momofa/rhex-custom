"use client"

import type { AccessThresholdOption } from "@/lib/access-threshold-options"

interface AccessThresholdSelectGroupProps {
  levelValue: string
  vipLevelValue: string
  levelOptions: AccessThresholdOption[]
  vipLevelOptions: AccessThresholdOption[]
  onLevelChange: (value: string) => void
  onVipLevelChange: (value: string) => void
  levelLabel?: string
  vipLevelLabel?: string
  levelDescriptionBuilder?: (option: AccessThresholdOption | undefined) => string | undefined
  vipLevelDescriptionBuilder?: (option: AccessThresholdOption | undefined) => string | undefined
  disabled?: boolean
}

export function AccessThresholdSelectGroup({
  levelValue,
  vipLevelValue,
  levelOptions,
  vipLevelOptions,
  onLevelChange,
  onVipLevelChange,
  levelLabel = "最低浏览等级",
  vipLevelLabel = "最低 VIP 浏览等级",
  levelDescriptionBuilder,
  vipLevelDescriptionBuilder,
  disabled = false,
}: AccessThresholdSelectGroupProps) {
  const currentLevelOption = levelOptions.find((item) => item.value === levelValue) ?? levelOptions[0]
  const currentVipLevelOption = vipLevelOptions.find((item) => item.value === vipLevelValue) ?? vipLevelOptions[0]
  const levelDescription = levelDescriptionBuilder ? levelDescriptionBuilder(currentLevelOption) : currentLevelOption?.description
  const vipLevelDescription = vipLevelDescriptionBuilder ? vipLevelDescriptionBuilder(currentVipLevelOption) : currentVipLevelOption?.description

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <p className="text-sm font-medium">{levelLabel}</p>
        <select
          value={levelValue}
          onChange={(event) => onLevelChange(event.target.value)}
          className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-hidden"
          disabled={disabled}
        >
          {levelOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {levelDescription ? <p className="text-xs leading-6 text-muted-foreground">{levelDescription}</p> : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">{vipLevelLabel}</p>
        <select
          value={vipLevelValue}
          onChange={(event) => onVipLevelChange(event.target.value)}
          className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-hidden"
          disabled={disabled}
        >
          {vipLevelOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {vipLevelDescription ? <p className="text-xs leading-6 text-muted-foreground">{vipLevelDescription}</p> : null}
      </div>
    </div>
  )
}
