export interface AdminMessageParticipantItem {
  id: number
  username: string
  displayName: string
  avatarPath: string | null
  role: string
  status: string
  unreadCount: number
  archivedAt: string | null
}

export interface AdminMessageConversationItem {
  id: string
  participants: AdminMessageParticipantItem[]
  title: string
  subtitle: string
  preview: string
  latestSenderName: string | null
  messageCount: number
  unreadTotal: number
  archivedParticipantCount: number
  createdAt: string
  updatedAt: string
  lastMessageAt: string
}

export interface AdminMessageRecordItem {
  id: string
  body: string
  preview: string
  senderId: number
  senderUsername: string
  senderName: string
  senderAvatarPath: string | null
  createdAt: string
}

export interface AdminMessagePagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export interface AdminMessageConversationDetail extends AdminMessageConversationItem {
  messages: AdminMessageRecordItem[]
  messagePagination: AdminMessagePagination
  hasMoreMessages: boolean
}

export interface AdminMessageListResult {
  conversations: AdminMessageConversationItem[]
  activeConversation: AdminMessageConversationDetail | null
  filters: {
    keyword: string
    sort: string
    detailPageSize: number
  }
  summary: {
    conversationTotal: number
    messageTotal: number
    unreadTotal: number
    archivedParticipantCount: number
  }
  pagination: AdminMessagePagination
}
