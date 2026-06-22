import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { HelpDocumentPageContent } from "@/components/help-document-page-content"
import { HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { PostTableOfContents } from "@/components/post/post-table-of-contents"
import { SiteHeader } from "@/components/site-header"
import { getHomeAnnouncements } from "@/lib/announcements"
import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { renderMarkdown } from "@/lib/markdown/render"
import { normalizeRenderedMarkdownHtmlHeadings } from "@/lib/markdown/toc"
import { getHelpDocumentPageData } from "@/lib/site-documents"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"

interface HelpPageProps {
  params: Promise<{ slug?: string[] }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: HelpPageProps): Promise<Metadata> {
  const { slug } = await params
  const [settings, helpData] = await Promise.all([
    getSiteSettings(),
    getHelpDocumentPageData(slug),
  ])

  return {
    title: helpData.activeItem ? `${helpData.activeItem.title} - 帮助文档 - ${settings.siteName}` : `帮助文档 - ${settings.siteName}`,
    description: helpData.activeItem?.content.slice(0, 120) || `查看 ${settings.siteName} 的帮助文档与使用说明。`,
    openGraph: {
      title: helpData.activeItem ? `${helpData.activeItem.title} - 帮助文档 - ${settings.siteName}` : `帮助文档 - ${settings.siteName}`,
      description: settings.siteDescription,
      type: "website",
    },
  }
}

export default async function HelpPage({ params }: HelpPageProps) {
  const { slug } = await params
  const currentUserPromise = getCurrentUser()
  const settingsPromise = getSiteSettings()
  const [helpData, settings, boards, zones, currentUser, hotTopics, announcements] = await Promise.all([
    getHelpDocumentPageData(slug),
    settingsPromise,
    getBoards(),
    getZones(),
    currentUserPromise,
    settingsPromise.then((settings) => getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount)),
    getHomeAnnouncements(3),
  ])

  if (slug?.length && !helpData.activeItem) {
    notFound()
  }

  const sidebarUser = await resolveSidebarUser(currentUser, settings)
  const renderedActiveItemHtml = helpData.activeItem?.content.trim()
    ? renderMarkdown(helpData.activeItem.content, settings.markdownEmojiMap)
    : ""
  const normalizedActiveItemMarkdown = normalizeRenderedMarkdownHtmlHeadings(renderedActiveItemHtml, new Map())
  const helpTableOfContents = normalizedActiveItemMarkdown.headings

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={(
            <main className="py-1 pb-12 mt-6">
              <div className="space-y-6">
                <AddonSlotRenderer slot="help.page.before" />
                <AddonSurfaceRenderer surface="help.page" props={{ helpData }}>
                  <>
                    <AddonSlotRenderer slot="help.document.before" />
                    <AddonSurfaceRenderer surface="help.document" props={{ helpData }}>
                      <HelpDocumentPageContent
                        items={helpData.items}
                        activeItem={helpData.activeItem}
                        activeItemHtml={normalizedActiveItemMarkdown.html}
                      />
                    </AddonSurfaceRenderer>
                    <AddonSlotRenderer slot="help.document.after" />
                  </>
                </AddonSurfaceRenderer>
                <AddonSlotRenderer slot="help.page.after" />
              </div>
            </main>
          )}
          rightSidebar={(
            <aside className="mt-6 hidden pb-12 lg:block lg:h-full">
              <AddonSlotRenderer slot="help.sidebar.before" />
              <AddonSurfaceRenderer surface="help.sidebar" props={{ announcements, hotTopics, settings }}>
                <div className="mobile-sidebar-stack flex min-w-0 w-full max-w-full flex-col gap-4 lg:isolate lg:h-full">
                  {helpTableOfContents.length > 0 ? (
                    <div className="min-h-0 w-full lg:sticky lg:top-20 lg:z-10 lg:self-start">
                      <PostTableOfContents items={helpTableOfContents} title="帮助目录" ariaLabel="帮助文档目录" />
                    </div>
                  ) : null}
                  <div className="relative z-0 min-w-0">
                    <HomeSidebarPanels
                      user={sidebarUser}
                      hotTopics={hotTopics}
                      announcements={announcements}
                      showAnnouncements={settings.homeSidebarAnnouncementsEnabled}
                      siteName={settings.siteName}
                      siteDescription={settings.siteDescription}
                      siteLogoPath={settings.siteLogoPath}
                      siteIconPath={settings.siteIconPath}
                      sticky={false}
                    />
                  </div>
                </div>
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="help.sidebar.after" />
            </aside>
          )}
        />
      </div>
    </div>
  )
}
