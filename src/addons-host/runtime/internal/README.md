# `addons-host/runtime/internal/` — 模块依赖与职责

> 本目录所有文件是 `runtime/` 门面（`loader.ts` / `hooks.ts` / `execute.ts` / `lifecycle.ts` / `routes.ts`）背后的**纯实现单元**。
> 对外仍通过门面文件 re-export，避免消费者直接触达 internal 符号。

## 规则（强约束）

1. **方向单向**：外部消费者 → `runtime/*.ts` 门面 → `internal/*.ts`
2. **internal 禁止反向依赖门面**：`internal/*.ts` **不得** `import` `@/addons-host/runtime/loader`（否则环路）。
3. 每个 `internal/*.ts` 顶部必须有职责注释头，且单文件不超过 ~400 行。
4. 跨 internal 依赖仅允许低阶工具模块（当前仅 `map-utils.ts` 被他人引用）。

## 依赖图（当前快照）

```
                   ┌──────────── 外部消费者 ────────────┐
                   │ addons-admin / api / cli / etc.    │
                   └────────────────┬───────────────────┘
                                    │  只 import 门面
                 ┌──────────────────┼──────────────────┐
                 ▼                  ▼                  ▼
           loader.ts           hooks.ts            execute.ts
           (facade 236)        (facade 276)        (facade 324)
                 │                  │                   │
                 │                  ▼                   ▼
                 │            hook-pipeline.ts    render-executor.ts
                 │                  │                   │
                 ▼                  ▼                   │
           ┌────────────── internal/ 实现 ──────────────┴──┐
           │  manifest-loader.ts      (源/归一化/discovery) │
           │  permission-guard.ts     (权限缓存+断言)       │
           │  execution-context.ts    (ctx 组装+scope)      │
           │  execution-facades.ts    (posts/comments/...)  │
           │  data-migrations.ts      (数据迁移兜底)        │
           │  route-index.ts          (page/api 路由索引)   │
           │  registry-aggregator.ts  (slot/surface 聚合)   │
           │  build-api-factory.ts    (createAddonBuildApi) │
           │  hook-pipeline.ts        (统一 hook 遍历)      │
           │  render-executor.ts      (统一渲染 scope)      │
           │  board-select.ts         (板块选项查询)        │
           │  map-utils.ts ◀───── 被 route-index 等复用     │
           └────────────────────────────────────────────────┘
```

## 门面 re-export 契约

`loader.ts` 必须保留对以下 7 个外部消费符号的 re-export（任一破坏都需同步改消费侧）：

- `buildAddonExecutionContext`
- `clearAddonsRuntimeCache`
- `findLoadedAddonById`
- `findLoadedAddonByIdFresh`
- `loadAddonsRegistry`
- `loadAddonsRuntimeFresh`
- `IndexedAddonSurfaceCandidate` (type)

## 新增/变更边界提醒

| 模块 | 上游约束 |
|---|---|
| `render-executor.ts` | 由 `execute.ts` 作为渲染四路（slot/surface/page/api）公共包装调用 |
| `hook-pipeline.ts`   | 由 `hooks.ts` 三路 executor 复用；不直接对外导出 |
| `execute.ts`         | 不引入 internal/* 之外的 render helper；保持 `Executed*Result` 对外签名不变 |
| `hooks.ts`           | 保持 `executeAddon{Action,Waterfall,AsyncWaterfall}Hook` 三个对外签名不变 |

## 历史

| 阶段 | 产物 | 行数削减 |
|---|---|---|
| Phase B | internal/* 10 模块 + loader 薄壳 | loader 1082 → 236 |
| Phase C | hook-pipeline.ts | hooks 324 → 248 |
| Phase D | render-executor.ts | execute 433 → 324 |
| Phase E | execution-facades.ts (抽 7 个 domain facade) + 结构化注释头 + 本 README | execution-context 422 → 241 (<400) |

---

_最后更新：2026-04-18_