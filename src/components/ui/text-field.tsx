import type { HTMLInputTypeAttribute } from "react"

import { cn } from "@/lib/utils"

interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  type?: HTMLInputTypeAttribute
  autoComplete?: string
  background?: "background" | "card"
  inputClassName?: string
  containerClassName?: string
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
  autoComplete,
  background = "background",
  inputClassName,
  containerClassName,
}: TextFieldProps) {
  return (
    <div className={cn("space-y-2", containerClassName)}>
      <p className="text-sm font-medium">{label}{required ? " *" : ""}</p>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className={cn(
          "h-11 w-full rounded-full border border-border px-4 text-sm outline-hidden",
          background === "card" ? "bg-card" : "bg-background",
          inputClassName,
        )}
      />
    </div>
  )
}
