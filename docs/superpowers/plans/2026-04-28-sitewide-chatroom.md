# Sitewide Chatroom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sitewide chatroom that can be toggled from admin settings and appears as the first item in the private-message list when enabled.

**Architecture:** Reuse the existing message center, `Conversation`, and `DirectMessage` tables instead of creating a second chat system. Model the chatroom as a single `GROUP` conversation with a stable synthetic inbox ID and a site-setting flag stored in `appStateJson`, then branch the message center UI by `kind` so direct messages and the sitewide room can coexist cleanly.

**Tech Stack:** Next.js App Router, React 19, Prisma/PostgreSQL, existing admin site-settings pipeline, existing SSE inbox stream.

---

### Task 1: Add the admin toggle and site-settings plumbing

**Files:**
- Modify: `src/lib/site-settings-app-state.types.ts`
- Modify: `src/lib/site-settings-app-state.interaction.ts`
- Modify: `src/lib/site-settings-defaults.ts`
- Modify: `src/lib/site-settings.ts`
- Modify: `src/lib/admin-site-settings-interaction.ts`
- Modify: `src/components/admin/admin-site-settings.shared.tsx`
- Modify: `src/components/admin/admin-interaction-settings-form.tsx`

- [ ] **Step 1: Write the failing test for the new app-state setting**

```ts
import test from "node:test"
import assert from "node:assert/strict"

import {
  mergeSiteChatSettings,
  resolveSiteChatSettings,
} from "@/lib/site-settings-app-state"

test("site chat defaults to disabled and round-trips through appStateJson", () => {
  const initial = resolveSiteChatSettings({})
  assert.equal(initial.enabled, false)

  const appStateJson = mergeSiteChatSettings(null, { enabled: true })
  const resolved = resolveSiteChatSettings({ appStateJson })

  assert.equal(resolved.enabled, true)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `tsx --test test/site-chat-settings.test.ts`
Expected: FAIL because `resolveSiteChatSettings` and `mergeSiteChatSettings` do not exist yet.

- [ ] **Step 3: Implement the minimal site-settings support**

```ts
export interface SiteChatSettings {
  enabled: boolean
}

export function resolveSiteChatSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
} = {}): SiteChatSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const siteChat = isRecord(siteSettingsState.siteChat) ? siteSettingsState.siteChat : {}

  return {
    enabled: typeof siteChat.enabled === "boolean" ? siteChat.enabled : options.enabledFallback ?? false,
  }
}

export function mergeSiteChatSettings(appStateJson: string | null | undefined, input: SiteChatSettings) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    siteChat: {
      enabled: Boolean(input.enabled),
    },
  })
}
```

- [ ] **Step 4: Thread the new field through admin draft, payload, save, and render**

```tsx
<AdminBooleanSelectField
  label="开启全站聊天室"
  checked={draft.siteChatEnabled}
  onChange={(value) => updateDraftField("siteChatEnabled", value)}
  description="开启后，私信页会在会话列表首位显示一个全站聊天室入口。"
/>
```

```ts
const appStateJson = mergeSiteChatSettings(appStateWithPostContentLengths, {
  enabled: siteChatEnabled,
})
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `tsx --test test/site-chat-settings.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add test/site-chat-settings.test.ts src/lib/site-settings-app-state.types.ts src/lib/site-settings-app-state.interaction.ts src/lib/site-settings-defaults.ts src/lib/site-settings.ts src/lib/admin-site-settings-interaction.ts src/components/admin/admin-site-settings.shared.tsx src/components/admin/admin-interaction-settings-form.tsx
git commit -m "feat: add sitewide chatroom setting"
```

### Task 2: Extend the message backend with a sitewide room

**Files:**
- Modify: `src/lib/message-types.ts`
- Modify: `src/lib/messages.ts`
- Modify: `src/lib/message-send-execution.ts`
- Modify: `src/app/api/messages/send/route.ts`
- Modify: `src/db/message-read-queries.ts`
- Modify: `src/db/message-write-queries.ts`
- Modify: `src/app/api/messages/stream/route.ts`

- [ ] **Step 1: Write the failing test for sitewide-room metadata**

```ts
import test from "node:test"
import assert from "node:assert/strict"

import { getSiteChatConversationKey } from "@/lib/messages"

test("site chat uses a stable synthetic inbox key", () => {
  assert.equal(getSiteChatConversationKey(), "site-chat")
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `tsx --test test/site-chat-message-metadata.test.ts`
Expected: FAIL because the helper and room metadata are not defined.

- [ ] **Step 3: Add a lightweight conversation kind and stable room helpers**

```ts
export type MessageConversationKind = "DIRECT" | "SITE_CHAT"

export function getSiteChatConversationKey() {
  return "site-chat"
}
```

```ts
const SITE_CHAT_CONVERSATION_KEY = "site-chat"
const SITE_CHAT_TITLE = "全站聊天室"
const SITE_CHAT_USERNAME = "__site_chat__"
```

- [ ] **Step 4: Implement room resolution, message send, read, and stream support**

```ts
if (conversationId === SITE_CHAT_CONVERSATION_KEY) {
  return getSiteChatConversationDetail(currentUserId)
}
```

```ts
if (input.conversationId === getSiteChatConversationKey()) {
  return executeSiteChatSend({ body: input.body }, options)
}
```

```ts
await messageEventBus.publish({
  type: "message.created",
  conversationId: SITE_CHAT_CONVERSATION_KEY,
  messageId: data.id,
  content: data.content,
  senderId: options.sender.id,
  senderUsername: options.sender.username,
  senderDisplayName: getUserDisplayName(options.sender, options.sender.username),
  senderAvatarPath: options.sender.avatarPath ?? null,
  recipientId: participant.userId,
  recipientUnreadMessageCount: unreadCount,
  createdAtLabel: data.createdAt,
  occurredAt: data.occurredAt,
})
```

- [ ] **Step 5: Run targeted tests and type-check**

Run: `tsx --test test/site-chat-message-metadata.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add test/site-chat-message-metadata.test.ts src/lib/message-types.ts src/lib/messages.ts src/lib/message-send-execution.ts src/app/api/messages/send/route.ts src/db/message-read-queries.ts src/db/message-write-queries.ts src/app/api/messages/stream/route.ts
git commit -m "feat: add sitewide chatroom backend"
```

### Task 3: Render the sitewide room in the message center

**Files:**
- Modify: `src/components/message/messages-client.tsx`
- Modify: `src/components/message/message-conversation-sidebar.tsx`
- Modify: `src/components/message/message-thread-panel.tsx`
- Modify: `src/app/messages/page.tsx`

- [ ] **Step 1: Write the failing UI-adjacent test for list ordering**

```ts
import test from "node:test"
import assert from "node:assert/strict"

import { insertSiteChatConversationFirst } from "@/lib/messages"

test("site chat is inserted at the front of the inbox list", () => {
  const conversations = insertSiteChatConversationFirst(
    [{ id: "direct-1", title: "Alice" }],
    { id: "site-chat", title: "全站聊天室" },
  )

  assert.deepEqual(conversations.map((item) => item.id), ["site-chat", "direct-1"])
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `tsx --test test/site-chat-ordering.test.ts`
Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Update the sidebar and thread panel to branch on `kind`**

```tsx
const isSiteChat = conversation.kind === "SITE_CHAT"
const profileHref = isSiteChat || !mainParticipant?.username ? null : `/users/${mainParticipant.username}`
```

```tsx
const sendPayload = conversation.kind === "SITE_CHAT"
  ? { conversationId: conversation.id, body: content }
  : { recipientId: recipient.id, body: content }
```

```tsx
{conversation.kind === "SITE_CHAT" ? "全站在线聊天" : "实时会话"}
```

- [ ] **Step 4: Insert the room at the front of the list when enabled**

```ts
const conversations = siteChatConversation
  ? insertSiteChatConversationFirst(databaseConversations, siteChatConversation)
  : databaseConversations
```

- [ ] **Step 5: Run targeted tests and type-check**

Run: `tsx --test test/site-chat-ordering.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add test/site-chat-ordering.test.ts src/components/message/messages-client.tsx src/components/message/message-conversation-sidebar.tsx src/components/message/message-thread-panel.tsx src/app/messages/page.tsx src/lib/messages.ts
git commit -m "feat: surface sitewide chatroom in inbox"
```

### Task 4: Verify the admin flow and runtime behavior

**Files:**
- Modify: `src/components/message/messages-client.tsx` (only if verification finds defects)
- Modify: `src/components/message/message-thread-panel.tsx` (only if verification finds defects)

- [ ] **Step 1: Start from a clean dev-server state**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Verify admin settings behavior in the browser**

Run: Open `/admin/settings/interaction/comments`
Expected: The page shows the new “开启全站聊天室” control and saving persists after refresh.

- [ ] **Step 3: Verify inbox ordering and room rendering**

Run: Open `/messages`
Expected: When the toggle is on, “全站聊天室” is the first item in the sidebar and opens a non-profile-linked chat thread.

- [ ] **Step 4: Verify real-time sending behavior**

Run: Send a message in `/messages?conversation=site-chat`
Expected: The message appears immediately in the thread, the conversation stays pinned first, and other connected users receive the SSE event.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "test: verify sitewide chatroom flow"
```
