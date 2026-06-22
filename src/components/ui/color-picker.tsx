"use client"

import { useMemo, useState } from "react"
import { Paintbrush, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function normalizeHexColor(value: string, fallback: string) {
  const trimmed = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback
}

interface ColorPickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  presets?: readonly string[]
  fallbackColor?: string
  popoverTitle?: string
  description?: string
  containerClassName?: string
  triggerClassName?: string
  contentClassName?: string
  hideLabel?: boolean
  allowClear?: boolean
  clearLabel?: string
}

export function ColorPicker({
  value,
  onChange,
  label = "颜色",
  placeholder,
  presets = [],
  fallbackColor = "#64748b",
  popoverTitle,
  description,
  containerClassName,
  triggerClassName,
  contentClassName,
  hideLabel = false,
  allowClear = false,
  clearLabel = "清空",
}: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const normalizedValue = useMemo(
    () => normalizeHexColor(value || fallbackColor, fallbackColor),
    [fallbackColor, value],
  )
  const displayValue = value || placeholder || normalizedValue

  return (
    <div className={cn("space-y-2", containerClassName)}>
      {hideLabel ? null : <p className="text-sm font-medium">{label}</p>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-full border border-border bg-background px-3 text-xs text-left transition-colors hover:bg-accent",
            triggerClassName,
          )}
        >
          <span className="truncate">{displayValue}</span>
          <span className="ml-2 flex items-center gap-2">
            <span
              className="h-4 w-4 rounded-full border border-border"
              style={{ backgroundColor: normalizeHexColor(value || normalizedValue, fallbackColor) }}
            />
            <Paintbrush className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </PopoverTrigger>
        <PopoverContent
          className={cn("w-[296px] space-y-3 p-3", contentClassName)}
          align="start"
          sideOffset={8}
        >
          <PopoverHeader>
            <PopoverTitle className="text-xs">{popoverTitle ?? `选择${label}`}</PopoverTitle>
          </PopoverHeader>

          <div className="flex items-center gap-2">
            <input
              type="color"
              value={normalizedValue}
              onChange={(event) => onChange(event.target.value)}
              className="h-9 w-11 cursor-pointer rounded-lg border border-border bg-background p-1"
              aria-label={`选择${label}`}
            />
            <Input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className="h-9 rounded-full bg-background px-3 text-xs"
              placeholder={placeholder ?? fallbackColor}
            />
            {allowClear ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full px-2.5 text-xs"
                onClick={() => {
                  onChange("")
                  setOpen(false)
                }}
              >
                <X className="h-3.5 w-3.5" />
                {clearLabel}
              </Button>
            ) : null}
          </div>

          {presets.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {presets.map((preset) => {
                const active = normalizedValue.toLowerCase() === preset.toLowerCase()
                return (
                  <button
                    key={`${label}-${preset}`}
                    type="button"
                    className={cn(
                      "h-7 w-7 rounded-full border border-border transition-transform hover:scale-105",
                      active ? "ring-2 ring-foreground/20 ring-offset-1 ring-offset-background" : "",
                    )}
                    style={{ backgroundColor: preset }}
                    onClick={() => {
                      onChange(preset)
                      setOpen(false)
                    }}
                    aria-label={`使用颜色 ${preset}`}
                  />
                )
              })}
            </div>
          ) : null}

          {description ? (
            <p className="text-[11px] leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}
