import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface AuthFormSectionProps {
  title?: string
  description?: string
  children: ReactNode
}

interface AuthFieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  description?: ReactNode
  children: ReactNode
}

interface AuthInlineMessageProps {
  children: ReactNode
  tone?: "default" | "destructive" | "success"
}

export function AuthFormSection({
  title,
  description,
  children,
}: AuthFormSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      {title ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

export function AuthField({
  label,
  htmlFor,
  required = false,
  description,
  children,
}: AuthFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
          {required ? " *" : ""}
        </label>
        {description ? <div className="text-xs leading-5 text-muted-foreground">{description}</div> : null}
      </div>
      {children}
    </div>
  )
}

export function AuthInlineMessage({
  children,
  tone = "default",
}: AuthInlineMessageProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        tone === "default" && "border-border/70 bg-secondary/40 text-muted-foreground",
        tone === "destructive" && "border-destructive/20 bg-destructive/5 text-destructive",
        tone === "success" && "border-primary/20 bg-primary/5 text-foreground"
      )}
    >
      {children}
    </div>
  )
}
