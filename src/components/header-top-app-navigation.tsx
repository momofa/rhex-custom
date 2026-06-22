"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import type { CSSProperties } from "react"

import { LevelIcon } from "@/components/level-icon"
import type { SiteHeaderAppLinkItem } from "@/lib/site-header-app-links"
import { cn } from "@/lib/utils"

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href)
}

function normalizePathname(pathname: string) {
  if (pathname === "/") {
    return pathname
  }

  return pathname.replace(/\/+$/g, "") || "/"
}

function getInternalHrefParts(href: string) {
  if (isExternalHref(href)) {
    return null
  }

  try {
    const parsed = new URL(href, "http://local.invalid")

    return {
      pathname: normalizePathname(parsed.pathname),
      searchParams: parsed.searchParams,
      hasSearch: parsed.search.length > 0,
    }
  } catch {
    return null
  }
}

function matchesHrefSearchParams(
  currentSearchParams: Pick<URLSearchParams, "getAll" | "keys">,
  hrefSearchParams: URLSearchParams,
) {
  const names = new Set([
    ...hrefSearchParams.keys(),
    ...currentSearchParams.keys(),
  ])

  for (const name of names) {
    const expectedValues = hrefSearchParams.getAll(name)
    const currentValues = currentSearchParams.getAll(name)

    if (
      expectedValues.length !== currentValues.length
      || expectedValues.some((value, index) => currentValues[index] !== value)
    ) {
      return false
    }
  }

  return true
}

function isActiveHref(
  pathname: string,
  searchParams: Pick<URLSearchParams, "getAll" | "keys">,
  href: string,
) {
  const hrefParts = getInternalHrefParts(href)

  if (!hrefParts) {
    return false
  }

  const normalizedPathname = normalizePathname(pathname)
  if (hrefParts.hasSearch) {
    return normalizedPathname === hrefParts.pathname
      && matchesHrefSearchParams(searchParams, hrefParts.searchParams)
  }

  if (hrefParts.pathname === "/") {
    return normalizedPathname === "/"
  }

  return normalizedPathname === hrefParts.pathname
    || normalizedPathname.startsWith(`${hrefParts.pathname}/`)
}

export function HeaderTopAppNavigation({ links }: { links: SiteHeaderAppLinkItem[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (links.length === 0) {
    return null
  }

  return (
    <nav aria-label="顶部应用导航" className="hidden min-w-0 max-w-[min(44vw,460px)] items-center gap-2 overflow-hidden lg:flex">
      {links.map((item) => {
        const external = isExternalHref(item.href)
        const active = isActiveHref(pathname, searchParams, item.href)
        const hasIcon = item.icon.trim().length > 0
        const foregroundColor = active
          ? item.activeTextColor || item.textColor
          : item.textColor
        const linkStyle: CSSProperties = {
          ...(foregroundColor ? { color: foregroundColor } : {}),
          ...(active && item.activeBackgroundColor ? { backgroundColor: item.activeBackgroundColor } : {}),
          ...(item.bold ? { fontWeight: 700 } : {}),
          ...(item.fontSizePx ? { fontSize: `${item.fontSizePx}px` } : {}),
        }
        const iconStyle: CSSProperties = {
          color: item.iconColor || foregroundColor || "currentColor",
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer noopener" : undefined}
            className={cn(
              "inline-flex h-10 max-w-40 shrink-0 items-center gap-2 rounded-xl px-3 text-base font-medium leading-none text-foreground transition-colors hover:bg-muted",
              active ? "bg-muted" : "bg-transparent",
            )}
            style={linkStyle}
            aria-current={active ? "page" : undefined}
          >
            {hasIcon ? (
              <span className="inline-flex size-5 shrink-0 items-center justify-center text-foreground" style={iconStyle}>
                <LevelIcon icon={item.icon} className="size-5 text-[20px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" title={item.name} />
              </span>
            ) : null}
            <span className="min-w-0 truncate">{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
