"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"

const Toaster = ({ closeButton, toastOptions, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const resolvedToastOptions = toastOptions ?? {}

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton={closeButton ?? true}
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        ...resolvedToastOptions,
        classNames: {
          ...resolvedToastOptions.classNames,
          toast: "cn-toast",
        },
        closeButtonAriaLabel: resolvedToastOptions.closeButtonAriaLabel ?? "关闭通知",
      }}
      {...props}
    />
  )
}

export { Toaster }
