# Plugin System Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完善插件系统的更新链路、补齐缺失 hook 接线，并修复若干 hook 契约与 payload bug。

**Architecture:** 以现有 `addons-host` 的 action / waterfall / asyncWaterfall 体系为中心，优先修复“catalog 已声明但业务链路未完全执行”的问题；新增 hook 只选择最自然的评论内容改写点，保持向后兼容。帖子、评论、通知的 after hook 尽量复用现有 runtime query / mapper 产出标准 `Addon*Record` 快照，避免在业务层拼装半成品 payload。

**Tech Stack:** Next.js 16、TypeScript、Prisma、Node test runner (`tsx --test`)

---

### Task 1: 补齐帖子更新链路插件能力

**Files:**
- Modify: `src/lib/post-update-service.ts`
- Modify: `src/app/api/posts/update/route.ts`
- Modify: `src/app/write/page.tsx`

- [ ] **Step 1: 接入编辑态标题 waterfall**

在 `src/lib/post-update-service.ts` 里为普通编辑模式接入 `post.title.value`，执行顺序保持和创建帖子一致：先跑 waterfall，再做敏感词处理，再落库。

- [ ] **Step 2: 复用插件 captcha 到帖子编辑**

在 `src/app/write/page.tsx` 的编辑模式中渲染 `post.create.captcha`；在 `src/lib/post-update-service.ts` 读取 addon form fields，并在普通编辑模式复用 `verifyCreatePostCaptchaWithAddonProviders()`。

- [ ] **Step 3: 透传请求上下文**

给 `updatePostFlow()` 增加 `request` 入参，并在 `src/app/api/posts/update/route.ts` 传入，用于 captcha provider、hook 上下文和后续扩展。

### Task 2: 修复 after hook 快照 payload

**Files:**
- Modify: `src/lib/post-update-service.ts`
- Modify: `src/lib/comment-update-service.ts`
- Modify: `src/lib/notification-writes.ts`
- Modify: `src/addons-host/runtime/posts.ts`
- Modify: `src/addons-host/runtime/comments.ts`
- Modify: `src/addons-host/runtime/notifications.ts`

- [ ] **Step 1: 为 post/comment after hook 查询标准快照**

复用 `queryAddonPosts()` / `queryAddonComments()` 按 ID 回查最新记录，并把 `post` / `comment` 加入 `post.update.after`、`comment.update.after` payload。

- [ ] **Step 2: 修复通知 after hook 空 payload**

让 `notification.create.after` 在单条通知创建后带上标准 `notification` 快照；批量创建保留兼容行为，但仍使用结构化 payload。

- [ ] **Step 3: 复用现有 notification mapper**

在 `src/addons-host/runtime/notifications.ts` 导出 mapper，避免 `src/lib/notification-writes.ts` 手工组装 `AddonNotificationRecord`。

### Task 3: 新增评论内容 waterfall hook

**Files:**
- Modify: `src/addons-host/types.ts`
- Modify: `src/addons-host/hook-catalog.ts`
- Modify: `src/lib/comment-create-service.ts`
- Modify: `src/lib/comment-update-service.ts`
- Modify: `docs/插件 Hook 清单.md`
- Modify: `docs/插件系统开发文档.md`

- [ ] **Step 1: 声明 `comment.content.value`**

把 `comment.content.value` 加入 waterfall hook 名单、类型映射和 catalog，返回值类型为 `string`。

- [ ] **Step 2: 在评论创建/编辑链路执行**

在评论创建和评论编辑里先执行 `comment.content.value`，再做敏感词与 mention 解析，保持插件改写结果进入后续宿主主链。

- [ ] **Step 3: 同步用户提示语义**

如果 hook 或敏感词处理改写了评论内容，`contentAdjusted` 统一反映为 `true`。

### Task 4: 验证与回归

**Files:**
- Create: `test/addon-hook-payloads.test.ts`

- [ ] **Step 1: 为新增/修复的 payload builder 加回归测试**

补最小纯函数测试，覆盖通知 after payload 映射、评论内容改写布尔语义等稳定逻辑。

- [ ] **Step 2: 跑测试与类型检查**

Run: `pnpm test`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS
