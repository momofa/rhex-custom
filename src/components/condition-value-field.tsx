"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AccessThresholdOption } from "@/lib/access-threshold-options"

export type ConditionValueFieldMode = "text" | "number" | "user-level" | "vip-level" | "datetime-local" | "verification-type"

interface ConditionValueFieldProps {
  mode?: ConditionValueFieldMode
  value: string
  placeholder?: string
  userLevelOptions?: AccessThresholdOption[]
  vipLevelOptions?: AccessThresholdOption[]
  verificationTypeOptions?: AccessThresholdOption[]
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

function padDateTimeValue(unit: number) {
  return String(unit).padStart(2, "0")
}

function normalizeDateTimeLocalValue(value: string) {
  if (!value) {
    return ""
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return value
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return [
    parsedDate.getFullYear(),
    padDateTimeValue(parsedDate.getMonth() + 1),
    padDateTimeValue(parsedDate.getDate()),
  ].join("-") + `T${padDateTimeValue(parsedDate.getHours())}:${padDateTimeValue(parsedDate.getMinutes())}`
}

function getConditionSelectOptions(
  mode: ConditionValueFieldMode,
  userLevelOptions: AccessThresholdOption[],
  vipLevelOptions: AccessThresholdOption[],
  verificationTypeOptions: AccessThresholdOption[],
) {
  if (mode === "user-level") {
    return userLevelOptions.filter((option) => option.value !== "0")
  }

  if (mode === "vip-level") {
    return vipLevelOptions.filter((option) => option.value !== "0")
  }

  if (mode === "verification-type") {
    return verificationTypeOptions
  }

  return null
}

export function ConditionValueField({
  mode = "text",
  value,
  placeholder,
  userLevelOptions = [],
  vipLevelOptions = [],
  verificationTypeOptions = [],
  onChange,
  disabled = false,
  className = "h-11 rounded-full border border-border bg-background px-4 text-sm outline-hidden",
}: ConditionValueFieldProps) {
  const selectOptions = getConditionSelectOptions(mode, userLevelOptions, vipLevelOptions, verificationTypeOptions)

  if (selectOptions && selectOptions.length > 0) {
    const selectedValue = value || selectOptions[0]?.value || ""

    return (
      <Select
        value={selectedValue}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className={className}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {selectOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    )
  }

  if (mode === "verification-type") {
    return (
      <Input
        type="text"
        value=""
        onChange={() => undefined}
        className={className}
        placeholder={placeholder ?? "暂无认证类型"}
        disabled
      />
    )
  }

  const inputType = mode === "datetime-local"
    ? "datetime-local"
    : mode === "number"
      ? "number"
      : "text"

  return (
    <Input
      type={inputType}
      value={mode === "datetime-local" ? normalizeDateTimeLocalValue(value) : value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}
