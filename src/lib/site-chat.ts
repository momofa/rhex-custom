import type { MessageConversationListItem, MessageParticipantProfile } from "@/lib/message-types"

export const SITE_CHAT_CONVERSATION_ID = "site-chat"
export const SITE_CHAT_ROOM_DB_ID = SITE_CHAT_CONVERSATION_ID
export const SITE_CHAT_TITLE = "全站聊天室"
export const SITE_CHAT_SUBTITLE = "全站在线聊天"
export const SITE_CHAT_EMPTY_PREVIEW = "聊天室已开启，发一条消息开始聊天吧"
export const SITE_CHAT_UPDATED_AT_PLACEHOLDER = "待聊天"
export const SITE_CHAT_PARTICIPANT_ID = 0
export const SITE_CHAT_PARTICIPANT_USERNAME = "__site_chat__"

export function isSiteChatConversationId(value: string | null | undefined) {
  return value === SITE_CHAT_CONVERSATION_ID
}

export function createSiteChatParticipant(): MessageParticipantProfile {
  return {
    id: SITE_CHAT_PARTICIPANT_ID,
    username: SITE_CHAT_PARTICIPANT_USERNAME,
    displayName: SITE_CHAT_TITLE,
    avatarPath: null,
    isCurrentUser: false,
  }
}

export function insertSiteChatConversationFirst(
  conversations: MessageConversationListItem[],
  siteChatConversation: MessageConversationListItem,
) {
  return [
    siteChatConversation,
    ...conversations.filter((conversation) => conversation.id !== siteChatConversation.id),
  ]
}
