# Task Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a task center with `新手任务 / 日常任务 / 挑战任务` and a true admin task editor, where operators can create, edit, sort, enable, pause, duplicate, and archive tasks, and each task can configure fixed or random point rewards.

**Architecture:** Replace the previous fixed catalog approach with a database-backed task-definition system. Admins create tasks from supported condition templates rather than arbitrary code expressions. Task definitions live in dedicated Prisma models, user progress lives in separate progress and event-ledger tables, and the settlement engine evaluates active tasks by template type when existing business events occur. Reward and target values are snapshotted into each user cycle so later admin edits do not mutate in-flight progress.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma, existing admin CRUD patterns, existing `point-center` / `PointLog` pipeline, `tsx --test`, `npx tsc --noEmit`.

---

## Scope Decisions

- v1 is an open task editor, but not an arbitrary rule-expression engine.
- Admins can create unlimited tasks, but the completion condition must come from a supported template list.
- v1 categories stay fixed as:
  - `NEWBIE`
  - `DAILY`
  - `CHALLENGE`
- v1 cycle types stay fixed as:
  - `PERMANENT`
  - `DAILY`
  - `WEEKLY`
- Every task has its own:
  - title
  - description
  - category
  - cycle type
  - condition template
  - target count
  - enabled/status switch
  - sort order
  - reward mode
  - reward amount or random range
  - optional active time window
- Reward modes:
  - `FIXED`: single integer reward
  - `RANDOM`: inclusive integer range `[min, max]`
- Rewards auto-settle on completion. v1 does not add a manual claim layer.
- `签到` belongs to `日常任务`; when task center is enabled, the daily sign-in reward is sourced from the sign-in task definition rather than the old static sign-in field.
- Content-based tasks count only when content is publicly effective:
  - immediate `NORMAL` content counts on create
  - `PENDING` content counts on admin approval
- Admin edits affect future qualifying events, but existing started cycles keep their own snapshotted target and reward settings.

## Supported Task Templates For v1

### Core Community Templates

- `CHECK_IN_COUNT`
- `APPROVED_POST_COUNT`
- `APPROVED_COMMENT_COUNT`
- `GIVEN_LIKE_COUNT`
- `RECEIVED_LIKE_COUNT`
- `APPROVED_COMMENT_DISTINCT_POST_COUNT`

### Extended Templates

- `INVITE_SUCCESS_COUNT`
- `REPORT_RESOLVED_COUNT`
- `GOBANG_MATCH_COMPLETE_COUNT`
- `GOBANG_WIN_COUNT`
- `YINYANG_CREATE_COUNT`
- `YINYANG_ACCEPT_COUNT`

## Condition Config Rules

- All templates support `targetCount`.
- Post/comment templates may optionally support `boardIds` filtering.
- Post templates may optionally support `postTypes` filtering.
- Given-like templates may optionally support `distinctTargetUsersOnly`.
- Distinct-post comment templates dedupe by `postId`.
- Received-like templates dedupe by `actorUserId + targetId`.
- Game templates count only finished valid rounds, not in-progress attempts.

## Starter Preset Pack

The first install should seed an editable starter pack so the admin gets a usable task center immediately:

- `新手任务`
  - 首次签到
  - 首次发帖
  - 首次回复
  - 首次点赞
- `日常任务`
  - 每日签到
  - 今日回复一次
  - 今日点赞三次
- `挑战任务`
  - 本周签到五天
  - 本周发帖两篇
  - 本周参与五个不同主题

Admins can then duplicate, modify, disable, or archive these seeded tasks.

## File Structure

- `prisma/schema.prisma`
  Defines task definitions, user task progress, and event ledgers.
- `src/lib/task-center-types.ts`
  Shared task editor and settlement types.
- `src/lib/task-condition-templates.ts`
  Template metadata, labels, default config, dedupe strategy, and UI field schema.
- `src/lib/task-definition-validation.ts`
  Validates task definitions and template-specific config.
- `src/lib/task-center-cycle.ts`
  Resolves permanent, daily, and weekly cycle keys.
- `src/db/task-definition-queries.ts`
  CRUD queries for task definitions.
- `src/db/task-progress-queries.ts`
  Progress and event-ledger query helpers.
- `src/lib/task-center-service.ts`
  Runtime settlement engine.
- `src/lib/task-center-defaults.ts`
  Starter task seeding helpers.
- `src/components/admin/admin-task-manager.tsx`
  Admin editor UI.
- `src/lib/admin-task-center.ts`
  Admin read model and mutation service.
- `src/app/api/admin/tasks/route.ts`
  Admin CRUD endpoint.
- `src/lib/task-center-page.ts`
  Frontend read model for `/tasks`.
- `src/components/tasks/task-center-page.tsx`
  User-facing task center page.

---

### Task 1: Data Model For Task Definitions And Progress

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260501130000_task_center_editor/migration.sql`
- Create: `src/lib/task-center-types.ts`
- Create: `src/lib/task-center-cycle.ts`
- Test: `test/task-center-cycle.test.ts`

- [ ] Add enums:
  - `TaskCategory`
  - `TaskCycleType`
  - `TaskConditionType`
  - `TaskRewardMode`
  - `TaskDefinitionStatus`
  - `UserTaskProgressStatus`
- [ ] Add `TaskDefinition` model with:
  - `id`
  - `code`
  - `title`
  - `description`
  - `category`
  - `cycleType`
  - `conditionType`
  - `conditionConfigJson`
  - `targetCount`
  - `rewardMode`
  - `rewardFixedAmount`
  - `rewardRandomMin`
  - `rewardRandomMax`
  - `status`
  - `sortOrder`
  - `startsAt`
  - `endsAt`
  - `createdById`
  - `updatedById`
  - `createdAt`
  - `updatedAt`
- [ ] Add `UserTaskProgress` model with:
  - `userId`
  - `taskId`
  - `cycleKey`
  - `categorySnapshot`
  - `cycleTypeSnapshot`
  - `conditionTypeSnapshot`
  - `targetCountSnapshot`
  - `rewardModeSnapshot`
  - `rewardFixedAmountSnapshot`
  - `rewardRandomMinSnapshot`
  - `rewardRandomMaxSnapshot`
  - `progressCount`
  - `settledRewardPoints`
  - `status`
  - `completedAt`
  - `settledAt`
  - `metadataJson`
- [ ] Add `UserTaskEventLedger` model with a unique dedupe constraint on:
  - `userId + taskId + cycleKey + eventKey`
- [ ] Add indexes for:
  - `TaskDefinition.status + conditionType + sortOrder`
  - `TaskDefinition.category + cycleType + sortOrder`
  - `UserTaskProgress.userId + taskId + cycleKey`
  - `UserTaskProgress.userId + categorySnapshot + cycleKey`
- [ ] Implement business-cycle helpers:
  - permanent key
  - daily business-date key
  - weekly business-week key

### Task 2: Condition Template Registry

**Files:**
- Create: `src/lib/task-condition-templates.ts`
- Create: `src/lib/task-definition-validation.ts`
- Test: `test/task-condition-templates.test.ts`
- Test: `test/task-definition-validation.test.ts`

- [ ] Build a template registry that defines for each `TaskConditionType`:
  - display label
  - supported categories
  - supported cycle types
  - default target count
  - optional config schema
  - event source name
  - dedupe strategy
  - progress preview builder
- [ ] Define template-specific config validation:
  - board filter arrays must be valid string arrays
  - post type filters must be valid post-type values
  - target count must be positive
  - random reward range must satisfy `min <= max`
- [ ] Generate admin form metadata from the registry so the editor UI stays schema-driven.
- [ ] Add tests for:
  - valid template config round-trips
  - invalid config rejection
  - cycle/category mismatch rejection
  - preview text generation

### Task 3: Task Definition CRUD And Starter Seeding

**Files:**
- Create: `src/db/task-definition-queries.ts`
- Create: `src/lib/task-center-defaults.ts`
- Create: `src/lib/admin-task-center.ts`
- Create: `src/app/api/admin/tasks/route.ts`
- Modify: `src/lib/admin-settings-navigation.ts`
- Modify: `src/app/admin/settings/[[...segments]]/page.tsx`
- Test: `test/admin-task-center.test.ts`

- [ ] Implement admin task CRUD:
  - create
  - update
  - duplicate
  - status toggle
  - archive
- [ ] Generate immutable or system-normalized task `code` values on create so old progress rows remain referentially stable even if titles change.
- [ ] Seed a starter preset pack when no task definitions exist yet.
- [ ] Add a new admin settings sub-tab under `vip` or a dedicated settings section labeled `任务系统`.
- [ ] Keep starter tasks fully editable after seeding.
- [ ] Add tests for:
  - starter seeding happens once
  - duplicate copies condition and reward config
  - archive removes the task from user-facing lists without deleting historical progress

### Task 4: Admin Task Editor UI

**Files:**
- Create: `src/components/admin/admin-task-manager.tsx`
- Modify: `src/components/admin/admin-vip-settings-form.tsx`
- Test: `test/task-editor-ui-contract.test.ts`

- [ ] Build an admin manager UI following the existing `admin-custom-page-manager` / `admin-badge-manager` interaction style.
- [ ] UI requirements:
  - left list or card grid of tasks
  - create button
  - edit panel or modal
  - duplicate button
  - archive button
  - enable/pause toggle
  - category filter chips
- [ ] Per-task editor fields:
  - title
  - description
  - category
  - cycle type
  - condition template
  - target count
  - optional template config fields
  - reward mode
  - fixed reward or random min/max
  - sort order
  - startsAt / endsAt
- [ ] Show a human-readable “condition summary” preview before save.
- [ ] Validate client-side before submit, but keep server validation authoritative.

### Task 5: Settlement Engine For Dynamic Tasks

**Files:**
- Create: `src/db/task-progress-queries.ts`
- Create: `src/lib/task-center-service.ts`
- Modify: `src/lib/point-log-events.ts`
- Test: `test/task-center-service.test.ts`

- [ ] Replace hard-coded task matching with a dynamic engine:
  - fetch active task definitions by `conditionType`
  - evaluate template-specific config against the event payload
  - build the cycle key for that task
  - create or update user progress row
  - dedupe through `UserTaskEventLedger`
  - settle reward exactly once
- [ ] Snapshot these values into progress on first touch of a cycle:
  - task title if needed for history
  - target count
  - reward mode
  - reward range/fixed amount
  - category
  - cycle type
- [ ] Add point log event type `TASK_REWARD`.
- [ ] Ensure dynamic edits do not mutate existing started progress rows.
- [ ] Add tests for:
  - duplicate event suppression
  - random reward range correctness
  - task pause blocks new progress but does not erase old progress
  - archived tasks stop receiving new events

### Task 6: Wire Existing Business Events

**Files:**
- Modify: `src/lib/check-in-service.ts`
- Modify: `src/lib/post-create-execution.ts`
- Modify: `src/lib/comment-create-execution.ts`
- Modify: `src/lib/interaction-like-execution.ts`
- Modify: `src/lib/admin-post-actions.ts`
- Modify: `src/lib/admin-moderation-actions.ts`
- Modify: `src/lib/auth-register-service.ts`
- Modify: `src/lib/external-auth-service.ts`
- Modify: `src/lib/admin-report-actions.ts`
- Modify: `src/lib/gobang.ts`
- Modify: `src/lib/yinyang-contract.ts`

- [ ] Emit task events for:
  - check-in success
  - approved post creation
  - approved comment creation
  - given like
  - received like
  - successful invite registration
  - resolved report
  - gobang match completion
  - gobang win
  - yinyang challenge creation
  - yinyang challenge acceptance
- [ ] For moderated posts/comments:
  - do not count on initial create if status is `PENDING`
  - count when `post.approve` or `comment.approve` executes
- [ ] Keep task recording after the core business write succeeds so task failures cannot break the primary action.
- [ ] Build event payloads with the minimum fields the template engine needs, such as:
  - `userId`
  - `boardId`
  - `postId`
  - `postType`
  - `actorUserId`
  - `targetUserId`
  - `dateKey`
  - `gameResult`

### Task 7: Frontend Task Center

**Files:**
- Create: `src/lib/task-center-page.ts`
- Create: `src/components/tasks/task-center-page.tsx`
- Create: `src/components/tasks/task-card.tsx`
- Create: `src/app/tasks/page.tsx`

- [ ] Build a login-protected `/tasks` page fed by live task definitions instead of a static catalog.
- [ ] Show only active tasks in user-facing views.
- [ ] Group by category:
  - `新手任务`
  - `日常任务`
  - `挑战任务`
- [ ] Task cards display:
  - title
  - description
  - condition summary
  - progress
  - reward display
  - actual rolled reward once settled
  - completed badge
- [ ] Summary strip displays:
  - `今日完成`
  - `连续签到`
  - `本周挑战`
- [ ] No redemption panel and no manual claim button in v1.

### Task 8: Verification

**Files:**
- Verify: `prisma/schema.prisma`
- Verify: `src/lib/task-center-service.ts`
- Verify: `src/components/admin/admin-task-manager.tsx`
- Verify: `src/app/tasks/page.tsx`
- Test: `test/task-center-cycle.test.ts`
- Test: `test/task-condition-templates.test.ts`
- Test: `test/task-definition-validation.test.ts`
- Test: `test/admin-task-center.test.ts`
- Test: `test/task-center-service.test.ts`

- [ ] Run `pnpm prisma generate` after the schema change.
- [ ] Run targeted tests for cycle keys, template validation, admin CRUD, and settlement.
- [ ] Run `npx tsc --noEmit`.
- [ ] Manually verify:
  - create a brand-new daily sign-in task in admin and confirm it appears on `/tasks`
  - edit the sign-in task from fixed reward to random reward and confirm new cycles use the updated config
  - create a weekly challenge task for approved comments on distinct posts and confirm dedupe works
  - create a paused task and confirm it does not progress
  - duplicate a task and confirm both definitions can coexist independently
  - approve a pending post/comment and confirm the matching task progresses only on approval

## Product Guardrails

- Do not let admins write arbitrary JS, SQL, or expression strings in v1.
- Prefer template-driven config over free-form rule JSON in the UI.
- Keep categories fixed in v1 unless there is a concrete need for dynamic tabs.
- Keep cycle types fixed in v1 unless monthly or seasonal tasks become a real product requirement.

## Open Product Questions

- Do you want `邀请成功 / 举报成立 / 五子棋 / 阴阳契` templates in the first delivery, or should v1 ship with the core community templates first?
- Should task rewards remain site-wide, or do you want task-level `VIP1 / VIP2 / VIP3` reward overrides?
- Do you want a dedicated `/tasks` entry in the main header after implementation, or only expose it from the user settings area first?
