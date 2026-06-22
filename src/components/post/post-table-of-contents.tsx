"use client"

import { ListTree } from "lucide-react"
import { useEffect, useEffectEvent, useMemo, useRef, useState, type MouseEvent } from "react"

import type { MarkdownHeadingItem } from "@/lib/markdown/toc"
import { cn } from "@/lib/utils"

interface PostTableOfContentsProps {
  items: MarkdownHeadingItem[]
  title?: string
  ariaLabel?: string
}

const HEADING_SCROLL_OFFSET = 112
const MAX_TOC_INDENT_LEVEL = 3
const TOC_BASE_INDENT = 10
const TOC_INDENT_STEP = 14

function resolveHashHeadingId(items: MarkdownHeadingItem[]) {
  if (typeof window === "undefined") {
    return null
  }

  const hash = window.location.hash.replace(/^#/, "").trim()
  if (!hash) {
    return null
  }

  const decodedHash = decodeURIComponent(hash)
  return items.some((item) => item.id === decodedHash) ? decodedHash : null
}

export function PostTableOfContents({ items, title = "目录", ariaLabel = "帖子目录" }: PostTableOfContentsProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "")
  const navRef = useRef<HTMLElement | null>(null)
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>())
  const baseLevel = useMemo(
    () => items.reduce((currentMin, item) => Math.min(currentMin, item.level), items[0]?.level ?? 1),
    [items],
  )

  const syncActiveHeading = useEffectEvent(() => {
    const hashHeadingId = resolveHashHeadingId(items)
    if (hashHeadingId) {
      const target = document.getElementById(hashHeadingId)
      if (target && target.getBoundingClientRect().top <= window.innerHeight) {
        setActiveId((current) => current === hashHeadingId ? current : hashHeadingId)
        return
      }
    }

    let nextActiveId = items[0]?.id ?? ""

    for (const item of items) {
      const element = document.getElementById(item.id)
      if (!element) {
        continue
      }

      if (element.getBoundingClientRect().top - HEADING_SCROLL_OFFSET <= 0) {
        nextActiveId = item.id
        continue
      }

      break
    }

    setActiveId((current) => current === nextActiveId ? current : nextActiveId)
  })

  function handleAnchorClick(event: MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault()

    const target = document.getElementById(id)
    if (!target) {
      return
    }

    window.history.replaceState(null, "", `#${encodeURIComponent(id)}`)
    setActiveId((current) => current === id ? current : id)
    target.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  useEffect(() => {
    let frameId = 0

    const scheduleSync = () => {
      if (frameId) {
        return
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0
        syncActiveHeading()
      })
    }

    scheduleSync()
    window.addEventListener("scroll", scheduleSync, { passive: true })
    window.addEventListener("resize", scheduleSync)
    window.addEventListener("hashchange", scheduleSync)

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }

      window.removeEventListener("scroll", scheduleSync)
      window.removeEventListener("resize", scheduleSync)
      window.removeEventListener("hashchange", scheduleSync)
    }
  }, [items])

  useEffect(() => {
    if (!activeId) {
      return
    }

    const nav = navRef.current
    const activeLink = itemRefs.current.get(activeId)
    if (!nav || !activeLink) {
      return
    }

    const navRect = nav.getBoundingClientRect()
    const linkRect = activeLink.getBoundingClientRect()
    const padding = 12
    const visibleTop = nav.scrollTop + padding
    const visibleBottom = nav.scrollTop + nav.clientHeight - padding
    const linkTop = linkRect.top - navRect.top + nav.scrollTop
    const linkBottom = linkRect.bottom - navRect.top + nav.scrollTop

    if (linkTop >= visibleTop && linkBottom <= visibleBottom) {
      return
    }

    const nextScrollTop = linkTop - nav.clientHeight / 2 + activeLink.offsetHeight / 2
    const maxScrollTop = Math.max(nav.scrollHeight - nav.clientHeight, 0)
    nav.scrollTo({
      top: Math.min(Math.max(nextScrollTop, 0), maxScrollTop),
      behavior: "smooth",
    })
  }, [activeId])

  if (items.length === 0) {
    return null
  }

  return (
    <section className="mobile-sidebar-section flex w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs shadow-black/5 dark:shadow-black/30 lg:max-h-[calc(100dvh-6rem)]">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-4 py-3">
        <ListTree className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{title}</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <nav
          ref={navRef}
          aria-label={ariaLabel}
          className="max-h-[min(60dvh,28rem)] min-h-0 overflow-y-auto overscroll-contain px-2 py-2 [scrollbar-gutter:stable] lg:max-h-[calc(100dvh-9rem)]"
        >
          <div className="flex flex-col gap-1">
            {items.map((item) => {
              const indentLevel = Math.min(Math.max(item.level - baseLevel, 0), MAX_TOC_INDENT_LEVEL)
              const isActive = item.id === activeId

              return (
                <a
                  key={item.id}
                  ref={(node) => {
                    if (node) {
                      itemRefs.current.set(item.id, node)
                      return
                    }

                    itemRefs.current.delete(item.id)
                  }}
                  href={`#${item.id}`}
                  aria-current={isActive ? "location" : undefined}
                  title={item.text}
                  className={cn(
                    "block w-full min-w-0 truncate rounded-lg py-2 pr-3 text-[13px] leading-5 text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground",
                    isActive && "bg-accent text-foreground",
                  )}
                  style={{ paddingLeft: `${TOC_BASE_INDENT + indentLevel * TOC_INDENT_STEP}px` }}
                  onClick={(event) => handleAnchorClick(event, item.id)}
                >
                  {item.text}
                </a>
              )
            })}
          </div>
        </nav>
      </div>
    </section>
  )
}
