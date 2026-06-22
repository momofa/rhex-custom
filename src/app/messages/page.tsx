import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AddonSlotRenderer, AddonSurfaceRenderBoundary } from "@/addons-host"
import { SiteHeader } from "@/components/site-header"
import { getCurrentUser } from "@/lib/auth"
import { getMessageCenterData } from "@/lib/messages"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"

import { MessagesClient } from "@/components/message/messages-client"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `私信 - ${settings.siteName}`,
  }
}

export default async function MessagesPage(props: PageProps<"/messages">) {
  const searchParams = await props.searchParams
  const currentUser = await getCurrentUser()
  const conversationId = readSearchParam(searchParams?.conversation)
  const settings = await getSiteSettings()

  if (!settings.messageEnabled) {
    notFound()
  }

  const data = currentUser ? await getMessageCenterData(currentUser.id, conversationId) : null

  return (
    <div className="min-h-screen ">
      <SiteHeader />
      <AddonSurfaceRenderBoundary
        surface="messages.page"
        pathname="/messages"
        props={{
          conversationId,
          currentUser,
          data,
        }}
      >
        <MessagesClient
          currentUser={currentUser}
          initialData={data}
          conversationId={conversationId}
          messageImageUploadEnabled={Boolean(settings.messageImageUploadEnabled)}
          messageFileUploadEnabled={Boolean(settings.messageFileUploadEnabled)}
          pageBefore={<AddonSlotRenderer slot="messages.page.before" />}
          pageAfter={<AddonSlotRenderer slot="messages.page.after" />}
          headerBefore={<AddonSlotRenderer slot="messages.header.before" />}
          headerAfter={<AddonSlotRenderer slot="messages.header.after" />}
          sidebarBefore={<AddonSlotRenderer slot="messages.sidebar.before" />}
          sidebarAfter={<AddonSlotRenderer slot="messages.sidebar.after" />}
          threadBefore={<AddonSlotRenderer slot="messages.thread.before" />}
          threadAfter={<AddonSlotRenderer slot="messages.thread.after" />}
        />
      </AddonSurfaceRenderBoundary>
    </div>
  )
}
