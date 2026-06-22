import { countAdminMessageSummary, findAdminMessageConversationDetail, findAdminMessageConversationsPage } from "@/db/admin-message-queries"
import { ConversationKind, type Prisma } from "@/db/types"

import { apiError } from "@/lib/api-route"
import { ensureAdminActorPermission } from "@/lib/admin-scope-permissions"
import { formatDateTime } from "@/lib/formatters"
import { summarizeMessagePreview } from "@/lib/message-media"
import { requireSiteAdminActor } from "@/lib/moderator-permissions"
import { normalizePageSize, normalizePositiveInteger } from "@/lib/shared/normalizers"
import { getUserDisplayName } from "@/lib/user-display"
import type {
  AdminMessageConversationDetail,
  AdminMessageConversationItem,
  AdminMessageListResult,
  AdminMessageParticipantItem,
  AdminMessageRecordItem,
} from "@/lib/admin-message-management"

export interface AdminMessageQuery {
  keyword?: string
  sort?: string
  page?: number
  pageSize?: number
  detailPage?: number
  detailPageSize?: number
  conversationId?: string
}

type AdminMessageSort = "newest" | "oldest"
type AdminMessageConversationRecord = Awaited<ReturnType<typeof findAdminMessageConversationsPage>>[number]
type AdminMessageConversationDetailRecord = NonNullable<Awaited<ReturnType<typeof findAdminMessageConversationDetail>>>

function normalizeAdminMessageSort(sort?: string): AdminMessageSort {
  return sort === "oldest" ? "oldest" : "newest"
}

function normalizeAdminMessageQuery(query: AdminMessageQuery = {}) {
  return {
    keyword: String(query.keyword ?? "").trim().slice(0, 80),
    sort: normalizeAdminMessageSort(query.sort),
    page: normalizePositiveInteger(query.page, 1),
    pageSize: normalizePageSize(query.pageSize),
    detailPage: normalizePositiveInteger(query.detailPage, 1),
    detailPageSize: normalizePageSize(query.detailPageSize),
    conversationId: String(query.conversationId ?? "").trim(),
  }
}

function buildAdminMessageWhere(query: ReturnType<typeof normalizeAdminMessageQuery>): Prisma.ConversationWhereInput {
  const where: Prisma.ConversationWhereInput = {
    kind: ConversationKind.DIRECT,
    messages: {
      some: {},
    },
  }

  if (!query.keyword) {
    return where
  }

  const parsedUserId = Number(query.keyword)
  const canSearchUserId = Number.isSafeInteger(parsedUserId) && parsedUserId > 0

  return {
    ...where,
    OR: [
      {
        id: {
          contains: query.keyword,
          mode: "insensitive",
        },
      },
      {
        messages: {
          some: {
            body: {
              contains: query.keyword,
              mode: "insensitive",
            },
          },
        },
      },
      {
        participants: {
          some: {
            user: {
              username: {
                contains: query.keyword,
                mode: "insensitive",
              },
            },
          },
        },
      },
      {
        participants: {
          some: {
            user: {
              nickname: {
                contains: query.keyword,
                mode: "insensitive",
              },
            },
          },
        },
      },
      ...(canSearchUserId
        ? [
            {
              participants: {
                some: {
                  userId: parsedUserId,
                },
              },
            } satisfies Prisma.ConversationWhereInput,
          ]
        : []),
    ],
  }
}

function buildAdminMessageOrderBy(sort: AdminMessageSort): Prisma.ConversationOrderByWithRelationInput[] {
  return sort === "oldest"
    ? [{ lastMessageAt: "asc" }, { createdAt: "asc" }]
    : [{ lastMessageAt: "desc" }, { createdAt: "desc" }]
}

function mapParticipant(participant: AdminMessageConversationRecord["participants"][number]): AdminMessageParticipantItem {
  const displayName = getUserDisplayName(participant.user)

  return {
    id: participant.user.id,
    username: participant.user.username,
    displayName,
    avatarPath: participant.user.avatarPath,
    role: participant.user.role,
    status: participant.user.status,
    unreadCount: participant.unreadCount,
    archivedAt: participant.archivedAt ? formatDateTime(participant.archivedAt) : null,
  }
}

function buildConversationTitle(participants: AdminMessageParticipantItem[]) {
  return participants.map((participant) => participant.displayName).join(" 与 ") || "私信会话"
}

function buildConversationSubtitle(participants: AdminMessageParticipantItem[]) {
  return participants.map((participant) => `@${participant.username} #${participant.id}`).join(" / ")
}

function mapConversation(record: AdminMessageConversationRecord): AdminMessageConversationItem {
  const participants = record.participants.map(mapParticipant)
  const latestMessage = record.messages[0]

  return {
    id: record.id,
    participants,
    title: buildConversationTitle(participants),
    subtitle: buildConversationSubtitle(participants),
    preview: latestMessage ? summarizeMessagePreview(latestMessage.body) : "暂无消息",
    latestSenderName: latestMessage ? getUserDisplayName(latestMessage.sender) : null,
    messageCount: record._count.messages,
    unreadTotal: participants.reduce((total, participant) => total + participant.unreadCount, 0),
    archivedParticipantCount: participants.filter((participant) => participant.archivedAt).length,
    createdAt: formatDateTime(record.createdAt),
    updatedAt: formatDateTime(record.updatedAt),
    lastMessageAt: formatDateTime(record.lastMessageAt),
  }
}

function mapMessage(record: AdminMessageConversationDetailRecord["messages"][number]): AdminMessageRecordItem {
  return {
    id: record.id,
    body: record.body,
    preview: summarizeMessagePreview(record.body),
    senderId: record.senderId,
    senderUsername: record.sender.username,
    senderName: getUserDisplayName(record.sender),
    senderAvatarPath: record.sender.avatarPath,
    createdAt: formatDateTime(record.createdAt),
  }
}

function mapConversationDetail(
  record: AdminMessageConversationDetailRecord,
  messagePagination: AdminMessageConversationDetail["messagePagination"],
): AdminMessageConversationDetail {
  const participants = record.participants.map(mapParticipant)
  const messages = [...record.messages].reverse().map(mapMessage)
  const latestMessage = record.messages[0]

  return {
    id: record.id,
    participants,
    title: buildConversationTitle(participants),
    subtitle: buildConversationSubtitle(participants),
    preview: latestMessage ? summarizeMessagePreview(latestMessage.body) : "暂无消息",
    latestSenderName: latestMessage ? getUserDisplayName(latestMessage.sender) : null,
    messageCount: record._count.messages,
    unreadTotal: participants.reduce((total, participant) => total + participant.unreadCount, 0),
    archivedParticipantCount: participants.filter((participant) => participant.archivedAt).length,
    createdAt: formatDateTime(record.createdAt),
    updatedAt: formatDateTime(record.updatedAt),
    lastMessageAt: formatDateTime(record.lastMessageAt),
    messages,
    messagePagination,
    hasMoreMessages: record._count.messages > messages.length,
  }
}

export async function getAdminMessages(query: AdminMessageQuery = {}): Promise<AdminMessageListResult> {
  const actor = await requireSiteAdminActor()

  if (!actor) {
    apiError(403, "无权限访问私信记录")
  }
  await ensureAdminActorPermission(actor, "admin.operations.manage", "无权限访问私信记录")

  const normalizedQuery = normalizeAdminMessageQuery(query)
  const where = buildAdminMessageWhere(normalizedQuery)
  const orderBy = buildAdminMessageOrderBy(normalizedQuery.sort)
  const summary = await countAdminMessageSummary(where)
  const totalPages = Math.max(1, Math.ceil(summary.conversationTotal / normalizedQuery.pageSize))
  const page = Math.min(normalizedQuery.page, totalPages)
  const skip = (page - 1) * normalizedQuery.pageSize
  const conversations = await findAdminMessageConversationsPage(where, orderBy, skip, normalizedQuery.pageSize)
  const selectedConversationRequested =
    normalizedQuery.conversationId && conversations.some((conversation) => conversation.id === normalizedQuery.conversationId)
  const selectedConversationId = selectedConversationRequested
    ? normalizedQuery.conversationId
    : conversations[0]?.id
  const requestedDetailPage = selectedConversationRequested ? normalizedQuery.detailPage : 1
  const initialDetailSkip = (requestedDetailPage - 1) * normalizedQuery.detailPageSize
  let activeConversationRecord = selectedConversationId
    ? await findAdminMessageConversationDetail(selectedConversationId, initialDetailSkip, normalizedQuery.detailPageSize)
    : null
  const messageTotal = activeConversationRecord?._count.messages ?? 0
  const messageTotalPages = Math.max(1, Math.ceil(messageTotal / normalizedQuery.detailPageSize))
  const detailPage = Math.min(requestedDetailPage, messageTotalPages)
  const detailSkip = (detailPage - 1) * normalizedQuery.detailPageSize

  if (selectedConversationId && activeConversationRecord && detailSkip !== initialDetailSkip) {
    activeConversationRecord = await findAdminMessageConversationDetail(
      selectedConversationId,
      detailSkip,
      normalizedQuery.detailPageSize,
    )
  }

  const messagePagination = {
    page: detailPage,
    pageSize: normalizedQuery.detailPageSize,
    total: messageTotal,
    totalPages: messageTotalPages,
    hasPrevPage: detailPage > 1,
    hasNextPage: detailPage < messageTotalPages,
  }

  return {
    conversations: conversations.map(mapConversation),
    activeConversation: activeConversationRecord ? mapConversationDetail(activeConversationRecord, messagePagination) : null,
    filters: {
      keyword: normalizedQuery.keyword,
      sort: normalizedQuery.sort,
      detailPageSize: normalizedQuery.detailPageSize,
    },
    summary,
    pagination: {
      page,
      pageSize: normalizedQuery.pageSize,
      total: summary.conversationTotal,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
  }
}
