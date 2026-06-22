import type { LucideIcon } from "lucide-react"
import { CircleAlert } from "lucide-react"
import type { ReactNode } from "react"

import { AddonSurfaceRenderer } from "@/addons-host"
import type { AddonSurfaceKey, AddonSurfaceProps } from "@/addons-host/types"
import { AuthShowcase } from "@/components/auth/auth-showcase"
import { SiteHeader } from "@/components/site-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AuthShellProps {
  showcaseName: string
  showShowcase?: boolean
  panelTitle: string
  panelDescription: string
  beforeForm?: ReactNode
  panelBefore?: ReactNode
  panelAfter?: ReactNode
  panelSurface?: AddonSurfaceKey
  surfaceProps?: AddonSurfaceProps
  footer: ReactNode
  children: ReactNode
}

interface AuthPanelNoticeProps {
  children: ReactNode
  title?: string
  icon?: LucideIcon
  tone?: "default" | "destructive" | "success"
}

export async function AuthShell({
  showcaseName,
  showShowcase = true,
  panelTitle,
  panelDescription,
  beforeForm,
  panelBefore,
  panelAfter,
  panelSurface,
  surfaceProps,
  footer,
  children,
}: AuthShellProps) {
  const panel = (
    <Card className="auth-panel rounded-[32px] border border-border/70 py-0">
      <CardHeader className="gap-2 px-6 pt-6 lg:px-7 lg:pt-7">
        <CardTitle className="text-2xl font-semibold tracking-tight">{panelTitle}</CardTitle>
        <CardDescription className="text-sm leading-6">
          {panelDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-6 pb-6 lg:px-7">
        {beforeForm ? <div className="flex flex-col gap-3">{beforeForm}</div> : null}
        {children}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3 border-border/70 px-6 py-5 lg:px-7">
        {footer}
      </CardFooter>
    </Card>
  )
  const panelSurfaceContent = panelSurface ? (
    <AddonSurfaceRenderer surface={panelSurface} props={surfaceProps}>
      {panel}
    </AddonSurfaceRenderer>
  ) : (
    panel
  )

  return (
    <div className="auth-page min-h-screen">
      <SiteHeader />
      <main className={cn(
        "px-4 py-8 lg:px-6 lg:py-10",
        showShowcase ? "mx-auto max-w-6xl" : "mx-auto max-w-[560px]"
      )}>
        <div className={cn(
          "grid gap-6",
          showShowcase ? "lg:grid-cols-[minmax(0,1.04fr)_minmax(0,560px)] lg:items-start" : "grid-cols-1"
        )}>
          {showShowcase ? (
            <section className="relative hidden items-center justify-center p-4 lg:sticky lg:flex">
              <AuthShowcase siteName={showcaseName} />
            </section>
          ) : null}

          <div className="flex flex-col gap-3">
            {panelBefore}
            {panelSurfaceContent}
            {panelAfter}
          </div>
        </div>
      </main>
    </div>
  )
}

export function AuthPanelNotice({
  children,
  title,
  icon: Icon = CircleAlert,
  tone = "default",
}: AuthPanelNoticeProps) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-2xl border px-4 py-3 text-sm",
        tone === "default" && "border-border/70 bg-secondary/40 text-muted-foreground",
        tone === "destructive" && "border-destructive/20 bg-destructive/5 text-destructive",
        tone === "success" && "border-primary/20 bg-primary/5 text-foreground"
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          tone === "default" && "bg-background text-foreground",
          tone === "destructive" && "bg-destructive/10 text-destructive",
          tone === "success" && "bg-primary/10 text-primary"
        )}
      >
        <Icon />
      </div>
      <div className="flex flex-col gap-1">
        {title ? (
          <p
            className={cn(
              "font-medium",
              tone === "default" && "text-foreground",
              tone === "destructive" && "text-destructive",
              tone === "success" && "text-foreground"
            )}
          >
            {title}
          </p>
        ) : null}
        <div>{children}</div>
      </div>
    </div>
  )
}
