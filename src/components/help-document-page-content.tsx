"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronLeft, ChevronRight, ExternalLink, Pin } from "lucide-react"

import { MarkdownContentClient as MarkdownContent } from "@/components/markdown-content-client"
import { Button } from "@/components/ui/button"
import type { SiteDocumentItem } from "@/lib/site-documents"
import { cn } from "@/lib/utils"

interface HelpDocumentPageContentProps {
  items: SiteDocumentItem[]
  activeItem: SiteDocumentItem | null
  activeItemHtml?: string
}

export function HelpDocumentPageContent({ items, activeItem, activeItemHtml }: HelpDocumentPageContentProps) {
  const [navOpen, setNavOpen] = useState(true)

  return (
    <div>
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs shadow-black/5 dark:shadow-black/30">
        <div className={cn("grid transition-[grid-template-columns] duration-200 ease-out", navOpen && "xl:grid-cols-[240px_minmax(0,1fr)]")}>
          {navOpen ? (
            <aside className="border-b border-border xl:border-b-0 xl:border-r">
              <div className="p-2">
                <div className="mb-2 flex items-center justify-between gap-3 px-2 py-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">帮助文档</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">共 {items.length} 篇内容</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 rounded-full px-3 text-xs"
                    onClick={() => setNavOpen(false)}
                  >
                    收起
                    <ChevronLeft data-icon="inline-end" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {items.map((item) => {
                    const isActive = item.sourceType === "DOCUMENT" && activeItem?.id === item.id
                    const content = (
                      <div className="flex min-w-0 items-center gap-2">
                        {item.isPinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-orange-500" /> : null}
                        <span style={{ color: item.titleColor ?? undefined }} className={item.titleBold ? "truncate font-semibold" : "truncate font-medium"}>
                          {item.title}
                        </span>
                        {item.isExternal ? <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                      </div>
                    )

                    const className = isActive
                      ? "block rounded-[14px] border border-foreground/10 bg-accent px-2.5 py-2 text-[13px]"
                      : "block rounded-[14px] border border-transparent px-2.5 py-2 text-[13px] transition-colors hover:border-border hover:bg-accent/60"

                    if (item.isExternal) {
                      return <a key={item.id} href={item.href} target="_blank" rel="noreferrer" className={className}>{content}</a>
                    }

                    return <Link key={item.id} href={item.href} className={className}>{content}</Link>
                  })}

                  {items.length === 0 ? <div className="rounded-[14px] border border-dashed border-border px-3 py-4 text-xs leading-6 text-muted-foreground">当前还没有已发布帮助文档。</div> : null}
                </div>
              </div>
            </aside>
          ) : null}

          <div className="p-5 md:p-6">
            {!navOpen ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-dashed border-border bg-muted/20 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground">帮助目录已收起</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full px-3 text-xs"
                  onClick={() => setNavOpen(true)}
                >
                  展开目录
                  <ChevronRight data-icon="inline-end" />
                </Button>
              </div>
            ) : null}
            {activeItem ? (
              <article className="flex min-h-[420px] flex-col">
                <h2 style={{ color: activeItem.titleColor ?? undefined }} className={activeItem.titleBold ? "text-2xl font-semibold" : "text-2xl font-medium"}>
                  {activeItem.title}
                </h2>
                <MarkdownContent content={activeItem.content} html={activeItemHtml} emptyText="暂无帮助文档正文" className="markdown-body mt-4 max-w-none flex-1 text-sm prose prose-sm prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1" />
                <div className="mt-6 border-t border-border pt-3 text-xs text-muted-foreground">
                  更新时间 {activeItem.publishedAtText}
                </div>
              </article>
            ) : (
              <div className="px-1 py-6 text-sm leading-7 text-muted-foreground">
                当前没有可直接阅读的帮助正文文档。你仍然可以从左侧点击已配置的帮助链接。
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
