"use client"

import Image from "next/image"
import Link from "next/link"

import type { SelfServeAdItem } from "@/lib/self-serve-ads.shared"

type SelfServeAdsGridProps = {
  imageSlots: SelfServeAdItem[]
  textSlots: SelfServeAdItem[]
  placeholderLabel: string
  variant?: "sidebar" | "page"
}

const IMAGE_AD_ASPECT_CLASS_NAME = "aspect-[16/3]"
const IMAGE_AD_IMAGE_SIZES = "(max-width: 768px) calc(100vw - 40px), (max-width: 1280px) 50vw, 560px"

function buildPurchaseHref(slotType: "IMAGE" | "TEXT", slotIndex: number) {
  return `/funs/self-serve-ads/purchase?slotType=${slotType}&slotIndex=${slotIndex}`
}

function formatExpiryText(item: SelfServeAdItem) {
  return item.endsAt ? `到期：${item.endsAt}` : "到期时间待确认"
}

export function SelfServeAdsGrid({ imageSlots, textSlots, placeholderLabel, variant = "sidebar" }: SelfServeAdsGridProps) {
  const isPage = variant === "page"

  return (
    <div className={isPage ? "flex flex-col gap-5" : "flex flex-col gap-2.5"}>
      {imageSlots.length > 0 ? (
        <div className={isPage ? "grid gap-3 md:grid-cols-2" : "flex flex-col gap-2"}>
          {imageSlots.map((item) => (
            <ImageAdSlot key={item.id} item={item} placeholderLabel={placeholderLabel} isPage={isPage} />
          ))}
        </div>
      ) : null}

      {textSlots.length > 0 ? (
        <div className={isPage ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "grid grid-cols-2 gap-2"}>
          {textSlots.map((item) => (
            <TextAdSlot key={item.id} item={item} placeholderLabel={placeholderLabel} isPage={isPage} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ImageAdSlot({ item, placeholderLabel, isPage }: { item: SelfServeAdItem; placeholderLabel: string; isPage: boolean }) {
  if (item.isPlaceholder) {
    return (
      <Link
        href={buildPurchaseHref("IMAGE", item.slotIndex)}
        className={isPage
          ? `flex ${IMAGE_AD_ASPECT_CLASS_NAME} w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-background px-4 py-5 text-sm font-medium text-muted-foreground transition hover:border-foreground/20 hover:text-foreground`
          : `flex ${IMAGE_AD_ASPECT_CLASS_NAME} w-full items-center justify-center rounded-xl border border-dashed border-border bg-background text-xs font-medium text-muted-foreground transition hover:border-foreground/20 hover:text-foreground`}
      >
        <span>{placeholderLabel || "点击购买"}</span>
        {isPage ? <span className="text-xs font-normal">图片广告位 #{item.slotIndex + 1}</span> : null}
      </Link>
    )
  }

  return (
    <a
      href={item.linkUrl ?? "#"}
      target="_blank"
      rel="noreferrer"
      className={isPage
        ? "group block overflow-hidden rounded-xl border border-border bg-background transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5"
        : "group block overflow-hidden rounded-xl border border-border bg-background transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5"}
    >
      <div className={`relative ${IMAGE_AD_ASPECT_CLASS_NAME} w-full bg-muted/20`}>
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={`图片广告位 ${item.slotIndex + 1}`}
            fill
            sizes={isPage ? IMAGE_AD_IMAGE_SIZES : "320px"}
            unoptimized
            className="object-contain"
          />
        ) : null}
      </div>
      {isPage ? (
        <div className="border-t border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
          {formatExpiryText(item)}
        </div>
      ) : null}
    </a>
  )
}

function TextAdSlot({ item, placeholderLabel, isPage }: { item: SelfServeAdItem; placeholderLabel: string; isPage: boolean }) {
  if (item.isPlaceholder) {
    return (
      <Link
        href={buildPurchaseHref("TEXT", item.slotIndex)}
        className={isPage
          ? "flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-background px-4 py-4 text-sm font-medium text-muted-foreground transition hover:border-foreground/20 hover:text-foreground"
          : "flex items-center justify-center rounded-xl border border-dashed border-border bg-background px-3 py-2 text-[11px] text-muted-foreground transition hover:border-foreground/20 hover:text-foreground"}
      >
        <span>{placeholderLabel || "点击购买"}</span>
        {isPage ? <span className="text-xs font-normal">文字广告位 #{item.slotIndex + 1}</span> : null}
      </Link>
    )
  }

  return (
    <a
      href={item.linkUrl ?? "#"}
      target="_blank"
      rel="noreferrer"
      className={isPage
        ? "flex min-h-[96px] flex-col justify-between rounded-xl border border-border px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5"
        : "rounded-xl px-3 py-2 text-center transition hover:opacity-90"}
      style={{ color: item.textColor ?? "#0f172a", backgroundColor: item.backgroundColor ?? "#f8fafc" }}
    >
      <span className={isPage ? "break-words text-sm font-medium" : "block truncate text-[11px] font-medium"}>{item.title}</span>
      {isPage ? <span className="mt-3 block text-xs opacity-75">{formatExpiryText(item)}</span> : null}
    </a>
  )
}
