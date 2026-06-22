"use client"

import type { LucideIcon } from "lucide-react"
import { ExternalLink, Mail, Phone } from "lucide-react"

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { type MarkdownLinkHintKind, getMarkdownLinkHint } from "@/lib/markdown/link-hint"

const ICON_BY_KIND: Record<MarkdownLinkHintKind, LucideIcon> = {
  "external-site": ExternalLink,
  "mailto": Mail,
  "tel": Phone,
}

interface MarkdownLinkIndicatorProps {
  href: string
}

export function MarkdownLinkIndicator({ href }: MarkdownLinkIndicatorProps) {
  const hint = getMarkdownLinkHint(href)

  if (!hint) {
    return null
  }

  const HintIcon = ICON_BY_KIND[hint.kind]

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={120}
        closeDelay={80}
        render={
          <span className="md-link-icon inline-flex size-4 shrink-0 translate-y-[0.02em] items-center justify-center rounded-full border border-border/70 bg-muted/70 text-muted-foreground transition-colors duration-150 hover:border-foreground/15 hover:bg-accent hover:text-foreground" />
        }
      >
        <HintIcon className="size-2.5" aria-hidden="true" strokeWidth={2.35} />
      </HoverCardTrigger>
      <HoverCardContent side="top" align="center" className="w-72 p-3">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground">
              <HintIcon className="size-4" aria-hidden="true" strokeWidth={2.1} />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm font-semibold leading-none text-foreground">{hint.title}</p>
              <p className="text-[13px] leading-5 text-muted-foreground">{hint.description}</p>
            </div>
          </div>
          {hint.detail ? (
            <div className="break-all rounded-md border border-border bg-muted/60 px-2.5 py-2 font-mono text-[12px] leading-5 text-foreground/80">
              {hint.detail}
            </div>
          ) : null}
          <p className="text-[12px] leading-5 text-muted-foreground">{hint.footnote}</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
