# Safe Install And Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Docker Compose 部署和源码运行都走同一个简洁 `setup` 流程，默认自动应用 Prisma schema 变更，同时去掉 Docker 本地编译分支和冗余脚本入口。

**Architecture:** 保留现有 `setup` 入口，默认传递 `prisma db push --accept-data-loss`，减少常规升级阻塞。`prisma-db-push` 继续保护插件自建表/枚举，同时把历史数据清理改为显式 opt-in。

**Tech Stack:** Docker Compose、Node.js scripts、Prisma db push、PostgreSQL、pnpm。

---

### Task 1: 安全参数模块

**Files:**
- Create: `scripts/lib/setup-safety.ts`
- Test: `test/prisma-db-push-externals.test.ts`

- [ ] 新增统一解析函数，默认补齐 `--accept-data-loss`，并识别 `--clean-legacy-deleted`。
- [ ] 为外部表保护测试补充默认接受 schema 变更、历史清理参数不透传给 Prisma 的用例。

### Task 2: 加固 setup 与 db push

**Files:**
- Modify: `scripts/setup.ts`
- Modify: `scripts/prisma-db-push.ts`

- [ ] `setup` 默认调用 `scripts/prisma-db-push.ts` 时传递 `--accept-data-loss`。
- [ ] `prisma:push` 默认补齐 `--accept-data-loss`，减少常规升级阻塞。
- [ ] 历史 `DELETED` 帖子/评论清理默认跳过，仅在显式开启时执行。
- [ ] 数据库状态输出补充插件核心表行数，方便升级前后核对。

### Task 3: 精简 Docker 与脚本入口

**Files:**
- Modify: `docker-compose.yml`
- Modify: `package.json`
- Modify: `.env.example`

- [ ] Compose 固定使用远端镜像，保留 PostgreSQL 备份 profile。
- [ ] package scripts 只保留核心入口：`setup`、`setup:prod`、`build`、`start`、`worker`、Prisma 命令。
- [ ] `.env.example` 去掉本地镜像相关配置，减少部署分支。

### Task 4: 更新部署文档

**Files:**
- Modify: `README.md`

- [ ] README 文档只保留两条路径：Docker Compose、源码运行。
- [ ] 强调 Docker Compose 直接拉取远端镜像，不需要服务器本地 `docker build`。
- [ ] 安装/升级文案继续压缩，不展示内部同步策略。

### Task 5: 验证

**Files:**
- No source changes.

- [ ] 运行相关单测，确认安全参数和外部表保护逻辑正确。
- [ ] 运行 TypeScript 检查，确认脚本类型无误。
