// Centralized Redis key scopes to avoid scattered string literals across the codebase.
// Each export represents the first segment(s) passed to `createRedisKey`.
//
// Keep this file free of runtime logic: exports are plain `as const` strings so they
// can be safely tree-shaken and referenced from both runtime and test code.

export const REDIS_KEY_SCOPES = {
  backgroundJobs: {
    root: "background-jobs",
    stream: ["background-jobs", "stream"],
    group: ["background-jobs", "group"],
    delayed: ["background-jobs", "delayed"],
    deadLetter: ["background-jobs", "dead-letter"],
    index: ["background-jobs", "index"],
    executionLog: ["background-jobs", "execution-log"],
    idempotency: ["background-jobs", "idem"],
  },
  rssHarvest: {
    sourceRuntimeItems: ["rss-harvest", "source-runtime", "items"],
  },
  powCaptcha: {
    consume: "pow-captcha-consume",
  },
  builtinCaptcha: {
    consume: "builtin-captcha-consume",
  },
  messages: {
    eventPubSub: ["message-events", "pubsub"],
    unreadCount: ["messages", "unread-count"],
    userCacheVersion: ["messages", "user-cache-version"],
    conversationList: ["messages", "conversation-list"],
    siteChatVersion: ["messages", "site-chat-version"],
    siteChatMessages: ["messages", "site-chat-messages"],
  },
  notifications: {
    eventPubSub: ["notification-events", "pubsub"],
    unreadCount: ["notifications", "unread-count"],
  },
} as const
