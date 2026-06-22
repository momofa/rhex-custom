# Weiyu Home Feed Addon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为宿主新增可注册的首页 `home-feed` provider 能力，并基于这套能力实现“微语插件”，让插件内容能作为首页 tabs 之一，且支持后台配置入口位置、关闭入口、以及按全部 / 分区 / 节点筛选内容源。

**Architecture:** 宿主侧新增 `home-feed` provider 消费层，统一解析 addon 返回的动态 feed tab、默认首页策略和渲染结果；首页 tabs 与路由改为支持“内置 feed + addon feed”混排。插件侧通过 `home-feed` provider 暴露“微语”入口，通过后台配置页读写位置和内容源，前台以服务端渲染卡片流接入首页主 feed 壳。

**Tech Stack:** Next.js App Router、addons-host provider runtime、Prisma-backed addon config、Tailwind v4、addon client island（仅后台配置页）。

---

### Task 1: 补齐宿主的 home-feed provider 类型与解析层

**Files:**
- Create: `src/addons-host/home-feed-types.ts`
- Create: `src/lib/addon-home-feed-providers.ts`
- Modify: `src/addons-host/sdk/server.ts`
- Modify: `docs/插件系统开发文档.md`

- [ ] 定义 `home-feed` provider 的类型：tab 描述、运行时 hook、渲染入参、元数据入参。
- [ ] 在 provider 消费层实现 `listAddonHomeFeedTabs()`、`findAddonHomeFeedTabBySlug()`、`renderAddonHomeFeedTab()`。
- [ ] 在 SDK 导出里暴露新类型，保证 addon 能以类型化方式注册。
- [ ] 在插件文档中新增 `home-feed provider` 章节，说明它用于“首页 tabs 扩展 + 首页主内容接管”，并补充配置驱动的显示/隐藏建议。

### Task 2: 改造首页 tabs 与路由，支持 addon feed

**Files:**
- Create: `src/app/feed/[slug]/page.tsx`
- Create: `src/lib/home-feed-tabs.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/home-feed-page.tsx`
- Modify: `src/lib/home-feed-route.ts`
- Modify: `src/components/home/home-feed-tabs.tsx`
- Modify: `src/components/forum/forum-feed-view.tsx`
- Modify: `src/components/rss/rss-universe-feed-view.tsx`

- [ ] 抽出统一的首页 tab 解析逻辑，合并内置 tabs 与 addon tabs，按 `order` 排序。
- [ ] 允许 addon tab 生成宿主路由 `/feed/[slug]`，并支持第一页在“设为首页默认内容”时映射到 `/`。
- [ ] 改造首页根路由：若首位可见 tab 是 addon feed，则 `/` 渲染 addon 内容；否则保持现有 `latest` 逻辑。
- [ ] 把 tabs 从具体列表组件中上提到首页壳，保证内置 feed、宇宙 feed、addon feed 都走同一套 tabs UI。

### Task 3: 实现微语插件后台配置与首页渲染

**Files:**
- Create: `addons/weiyu/addon.json`
- Create: `addons/weiyu/dist/server.mjs`
- Create: `addons/weiyu/assets/weiyu-admin.js`
- Create: `addons/weiyu/assets/weiyu-admin.controller.js`
- Create: `addons/weiyu/assets/weiyu-admin.view.js`
- Modify: `docs/插件系统开发文档.md`

- [ ] 注册 `home-feed` provider，provider runtime 根据插件配置返回 tab 信息或隐藏入口。
- [ ] 注册后台页面和后台 API，支持配置：
  - 入口位置：关闭 / 第一 / 最新后 / 新帖后 / 热门后 / 关注后 / 宇宙后
  - 内容源类型：全部 / 指定分区 / 指定节点
  - 分区 slug 列表、节点 slug 列表
  - 每页数量、置顶区块数量（可选）
- [ ] 前台渲染用服务端 HTML 卡片流模拟 lightsns 风格：作者卡头、正文摘要、封面图、节点标签、互动统计、分页。
- [ ] 内容查询统一通过 `context.posts.query()`，按配置拼出 `zoneSlugs` / `boardSlugs` 过滤条件。

### Task 4: 校验与回归

**Files:**
- Create or Modify: `test/*`（按最终实现决定）

- [ ] 为首页 tab 合并 / 默认首页判定 / addon tab slug 解析补至少一组测试。
- [ ] 跑 `npx tsc --noEmit` 做类型校验。
- [ ] 跑与新增逻辑直接相关的测试。
- [ ] 手工验证：
  - `/` 在插件设为第一时展示“微语”
  - `/latest` 仍可访问原最新页
  - `/feed/weiyu` 在插件未设为第一时可访问
  - 后台保存配置后无需重启即可改变入口位置和内容源

### Task 5: 文档收尾

**Files:**
- Modify: `docs/插件系统开发文档.md`
- Modify: `docs/插件 Hook 清单.md`

- [ ] 在主文档中补充：
  - 新的 `home-feed` provider 能力说明
  - 首页默认内容切换策略
  - addon 无独立前台页面、仅挂入首页时的推荐实现方式
- [ ] 在 hook/扩展点清单里标记 `home-feed provider` 为 provider 类扩展能力，而非 slot/surface。
