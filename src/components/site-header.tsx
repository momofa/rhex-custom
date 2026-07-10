import { promises as fs } from "node:fs"
import path from "node:path"

import Image from "next/image"
import Link from "next/link"
import { cache, Suspense } from "react"

import { HeaderUserActions } from "@/components/header-user-actions"
import { HeaderTopAppNavigation } from "@/components/header-top-app-navigation"
import { MobileHeaderQuickActions } from "@/components/mobile-header-quick-actions"
import { ThemeToggle } from "@/components/theme-toggle"
import { getBoards } from "@/lib/boards"
import { SearchForm } from "@/components/search-form"
import { resolveSiteIconPath } from "@/lib/site-branding"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"
import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"

const SITE_LOGO_HEIGHT = 32

type SiteLogoDisplaySize = {
  width: number
  height: number
}

function parseSvgLength(value?: string | null) {
  if (!value) {
    return null
  }

  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)/)
  if (!match) {
    return null
  }

  const parsed = Number(match[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function readUint24LE(buffer: Buffer, offset: number) {
  return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16)
}

function readImageSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    }
  }

  if (buffer.length >= 10 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1
        continue
      }

      const marker = buffer[offset + 1]
      const length = buffer.readUInt16BE(offset + 2)
      if (length < 2) {
        return null
      }

      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return {
          width: buffer.readUInt16BE(offset + 7),
          height: buffer.readUInt16BE(offset + 5),
        }
      }

      offset += 2 + length
    }
  }

  if (buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "GIF") {
    return {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8),
    }
  }

  if (buffer.length >= 30 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buffer.toString("ascii", 12, 16)
    if (chunk === "VP8X") {
      return {
        width: readUint24LE(buffer, 24) + 1,
        height: readUint24LE(buffer, 27) + 1,
      }
    }

    if (chunk === "VP8 " && buffer.length >= 30) {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      }
    }

    if (chunk === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
      return {
        width: 1 + (((buffer[22] & 0x3f) << 8) | buffer[21]),
        height: 1 + (((buffer[24] & 0x0f) << 10) | (buffer[23] << 2) | ((buffer[22] & 0xc0) >> 6)),
      }
    }
  }

  const svgText = buffer.toString("utf8", 0, Math.min(buffer.length, 4096))
  if (svgText.includes("<svg")) {
    const svgTag = svgText.match(/<svg\b[^>]*>/i)?.[0] ?? ""
    const width = parseSvgLength(svgTag.match(/\bwidth=["']([^"']+)["']/i)?.[1])
    const height = parseSvgLength(svgTag.match(/\bheight=["']([^"']+)["']/i)?.[1])
    if (width && height) {
      return { width, height }
    }

    const viewBox = svgTag.match(/\bviewBox=["']([^"']+)["']/i)?.[1]
    const viewBoxParts = viewBox?.trim().split(/[\s,]+/).map(Number) ?? []
    if (viewBoxParts.length === 4 && viewBoxParts.every((item) => Number.isFinite(item)) && viewBoxParts[2] > 0 && viewBoxParts[3] > 0) {
      return {
        width: viewBoxParts[2],
        height: viewBoxParts[3],
      }
    }
  }

  return null
}

const getSiteLogoDisplaySize = cache(async (logoPath?: string | null): Promise<SiteLogoDisplaySize | null> => {
  if (!logoPath || /^[a-z][a-z\d+.-]*:\/\//i.test(logoPath)) {
    return null
  }

  const pathname = logoPath.split(/[?#]/, 1)[0]
  let decodedPathname: string

  try {
    decodedPathname = decodeURIComponent(pathname)
  } catch {
    decodedPathname = pathname
  }

  const relativePath = decodedPathname.replace(/^\/+/, "")
  if (!relativePath || relativePath.startsWith("..")) {
    return null
  }

  const candidatePaths = [
    path.join(process.cwd(), relativePath),
    path.join(process.cwd(), "public", relativePath),
  ]

  for (const candidatePath of candidatePaths) {
    try {
      const stat = await fs.stat(candidatePath)
      if (!stat.isFile()) {
        continue
      }

      const imageSize = readImageSize(await fs.readFile(candidatePath))
      if (!imageSize) {
        continue
      }

      return {
        height: SITE_LOGO_HEIGHT,
        width: Math.max(1, Math.round((imageSize.width / imageSize.height) * SITE_LOGO_HEIGHT)),
      }
    } catch {
      continue
    }
  }

  return null
})

function SiteLogoMark({ logoPath, iconPath, logoSize }: { logoPath?: string | null; iconPath?: string | null; logoSize?: SiteLogoDisplaySize | null }) {
  if (logoPath) {
    const width = logoSize?.width ?? SITE_LOGO_HEIGHT
    const height = logoSize?.height ?? SITE_LOGO_HEIGHT

    return (
      <div className="flex h-8 shrink-0 items-center">
        <Image
          src={logoPath}
          alt="站点 Logo"
          width={width}
          height={height}
          priority
          sizes={`${width}px`}
          unoptimized
          className="h-8 w-auto max-w-none"
        />
      </div>
    )
  }

  return (
    <div className="flex h-8 shrink-0 items-center">
      <Image
        src={resolveSiteIconPath(iconPath)}
        alt=""
        width={32}
        height={32}
        unoptimized
        className="h-8 w-auto max-w-none"
      />
    </div>
  )
}

export async function SiteHeader() {
  const [settings, zones, boards] = await Promise.all([getSiteSettings(), getZones(), getBoards()])
  const logoSize = await getSiteLogoDisplaySize(settings.siteLogoPath)

  return (
    <header className="relative z-50 w-full border-b border-border/70 bg-background sm:sticky sm:top-0 sm:bg-background/80 sm:backdrop-blur-sm">
      <div className="mx-auto max-w-[1200px] px-1">
        <AddonSlotRenderer slot="layout.header.before" props={{ settings }} />
        <AddonSurfaceRenderer surface="layout.header" props={{ settings }}>
          <div className="grid h-14 grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="-mr-6 hidden h-14 items-center lg:col-span-2 lg:flex">
              <AddonSlotRenderer slot="layout.header.left" props={{ settings }} />
              <Link href="/" className="flex items-center gap-2 text-xl leading-none">
                <SiteLogoMark logoPath={settings.siteLogoPath} iconPath={settings.siteIconPath} logoSize={logoSize} />
                {settings.siteLogoText && settings.siteLogoText.trim() !== "" ? (
                  <div className="hidden shrink-0 whitespace-nowrap font-bold tracking-tight sm:inline-block">{settings.siteLogoText}</div>
                ) : null}
              </Link>
            </div>

            <div className="flex h-14 items-center justify-between gap-3 lg:col-span-10">
              <div className="flex items-center gap-2 lg:hidden">
                <Link href="/" className="flex items-center gap-2 text-base font-bold leading-none">
                  <SiteLogoMark logoPath={settings.siteLogoPath} iconPath={settings.siteIconPath} logoSize={logoSize} />
                  <span className="sr-only">{settings.siteLogoText}</span>
                </Link>
                <Suspense fallback={null}>
                  <MobileHeaderQuickActions
                    checkInEnabled={settings.checkInEnabled}
                    appLinks={settings.headerAppLinks}
                    search={settings.search}
                    zones={zones}
                    boards={boards}
                  />
                </Suspense>
              </div>

              <div className="hidden flex-1 md:block">
                <div className="ml-4 max-w-md">
                  <Suspense fallback={<div className="h-9 w-full rounded-full border border-border bg-muted/50" aria-hidden="true" />}>
                    <SearchForm compact appLinks={settings.headerAppLinks} appIconName={settings.headerAppIconName} search={settings.search} />
                  </Suspense>
                </div>
                <AddonSlotRenderer slot="layout.header.center" props={{ settings }} />
              </div>

              <div className="ml-auto flex h-14 items-center gap-1.5">
                <AddonSlotRenderer slot="layout.header.right" props={{ settings }} />
                <Suspense fallback={null}>
                  <HeaderTopAppNavigation links={settings.topHeaderAppLinks} />
                </Suspense>
                <ThemeToggle />
                <Suspense fallback={null}>
                  <HeaderUserActions messageEnabled={settings.messageEnabled} />
                </Suspense>
              </div>
            </div>
          </div>
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="layout.header.after" props={{ settings }} />
      </div>
    </header>
  )
}
