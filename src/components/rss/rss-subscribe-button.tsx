import Link from "next/link"
import { Rss } from "lucide-react"

interface RssSubscribeButtonProps {
  href: string
  label?: string
  className?: string
  showLabel?: boolean
}

export function RssSubscribeButton({ href, label = "订阅 RSS", className, showLabel = true }: RssSubscribeButtonProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className={className ?? "inline-flex items-center gap-1 rounded-full border border-border bg-background/85 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"}
    >
      <Rss className="h-3.5 w-3.5" />
      {showLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </Link>
  )
}
