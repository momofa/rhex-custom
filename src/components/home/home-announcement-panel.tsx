import Link from "next/link"
import { Clock3, ExternalLink, Megaphone, Pin } from "lucide-react"

import type { AnnouncementItem } from "@/lib/announcements"

interface HomeAnnouncementPanelProps {
  announcements: AnnouncementItem[]
}

export function HomeAnnouncementPanel({ announcements }: HomeAnnouncementPanelProps) {
  return (
    <section className="mobile-sidebar-section rounded-xl border border-border bg-card p-4 shadow-xs shadow-black/5 dark:shadow-black/30">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-sky-500" />
          <div>
            <h3 className="font-semibold">站内公告</h3>
          </div>
        </div>
        <Link href="/announcements" className="text-xs text-muted-foreground transition hover:text-foreground">更多公告</Link>
      </div>

      {announcements.length > 0 ? (
        <div className="space-y-1.5">
          {announcements.map((announcement) => {
            const body = (
              <div className="flex items-center gap-2">
                {announcement.isPinned ? <Pin className="h-3 w-3 shrink-0 text-orange-500" /> : null}
                <p style={{ color: announcement.titleColor ?? undefined }} className={announcement.titleBold ? "min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground" : "min-w-0 flex-1 truncate text-[13px] font-medium text-foreground"}>
                  {announcement.title}
                </p>
                {announcement.isExternal ? <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
                <AnnouncementTimeHint publishedAtText={announcement.publishedAtText} />
              </div>
            )

            if (announcement.isExternal) {
              return (
                <a key={announcement.id} href={announcement.href} target="_blank" rel="noreferrer" className="block rounded-[16px]  transition hover:border-foreground/15 hover:bg-accent/40">
                  {body}
                </a>
              )
            }

            return (
              <Link key={announcement.id} href={announcement.href} className="block rounded-[16px] transition hover:border-foreground/15 hover:bg-accent/40">
                {body}
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="rounded-[18px] border border-dashed border-border px-3 py-4 text-xs leading-6 text-muted-foreground">
          当前还没有已发布公告，运营发布后会显示在这里。
        </div>
      )}
    </section>
  )
}

function AnnouncementTimeHint({ publishedAtText }: { publishedAtText: string }) {
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title={`发布时间：${publishedAtText}`}
      aria-label={`发布时间：${publishedAtText}`}
    >
      <Clock3 className="h-3.5 w-3.5" />
    </span>
  )
}
