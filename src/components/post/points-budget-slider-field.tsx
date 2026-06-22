"use client"

import { formatCompactPointValue } from "@/lib/formatters"

interface PointsBudgetSliderFieldProps {
  label: string
  pointName: string
  value: string
  min: number
  max: number
  currentBalance: number
  estimatedCost: number
  disabled?: boolean
  placeholder?: string
  onChange: (value: string) => void
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function formatInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

export function PointsBudgetSliderField({
  label,
  pointName,
  value,
  min,
  max,
  currentBalance,
  estimatedCost,
  disabled = false,
  placeholder,
  onChange,
}: PointsBudgetSliderFieldProps) {
  const normalizedMin = Math.max(1, Math.floor(min))
  const normalizedMax = Math.max(normalizedMin, Math.floor(max))
  const parsedValue = Number(value)
  const rangeValue = clampInteger(Number.isFinite(parsedValue) ? parsedValue : normalizedMin, normalizedMin, normalizedMax)
  const normalizedCost = formatInteger(estimatedCost)
  const afterBalance = currentBalance - normalizedCost
  const insufficient = afterBalance < 0

  return (
    <div className="space-y-2.5 rounded-[14px] border border-border bg-background/90 p-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-foreground">{label}</p>
        </div>
        <div className="inline-flex min-w-[78px] items-center justify-center rounded-full border border-border bg-secondary px-3 py-1 text-[11px] font-semibold text-foreground">
          {formatCompactPointValue(rangeValue)} {pointName}
        </div>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-3">
        <div className="rounded-[10px] bg-secondary/60 px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground">当前余额</p>
          <p className="mt-0.5 text-[11px] font-semibold">{formatCompactPointValue(currentBalance)}</p>
        </div>
        <div className="rounded-[10px] bg-secondary/60 px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground">本次消耗</p>
          <p className="mt-0.5 text-[11px] font-semibold">{formatCompactPointValue(normalizedCost)}</p>
        </div>
        <div className={insufficient ? "rounded-[10px] bg-red-50 px-2.5 py-2 text-red-700" : "rounded-[10px] bg-secondary/60 px-2.5 py-2"}>
          <p className="text-[10px] text-muted-foreground">发布后余额</p>
          <p className="mt-0.5 text-[11px] font-semibold">{formatCompactPointValue(afterBalance)}</p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_96px]">
        <div className="rounded-[10px] border border-border bg-card px-3 py-2.5">
          <input
            type="range"
            min={normalizedMin}
            max={normalizedMax}
            step={1}
            value={rangeValue}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground disabled:cursor-not-allowed"
          />
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{formatCompactPointValue(normalizedMin)}</span>
            <span>{formatCompactPointValue(normalizedMax)}</span>
          </div>
        </div>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-full min-h-9 w-full rounded-[10px] border border-border bg-card px-3 text-xs outline-hidden"
          placeholder={placeholder}
          disabled={disabled}
          inputMode="numeric"
        />
      </div>
    </div>
  )
}
