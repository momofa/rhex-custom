# Custom Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build admin-managed custom pages that can be published to direct routes like `/xxxxx`, render raw HTML, and independently toggle global header, footer, left sidebar, and right sidebar.

**Architecture:** Add a dedicated `CustomPage` Prisma model and a matching admin/API/data layer instead of overloading the existing announcement/help document model. Render published pages through a root catch-all App Router route, and extend shared page chrome utilities so custom pages can opt in or out of header/footer/sidebar chrome without breaking existing pages.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma, existing admin shell and shadcn-based UI, Node test runner via `tsx --test`.

---

### Task 1: Data Model And Route Rules

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260429180000_custom_pages/migration.sql`
- Create: `src/db/custom-page-queries.ts`
- Create: `src/lib/custom-page-types.ts`
- Test: `test/custom-page-types.test.ts`

- [ ] Define the `CustomPage` model with route path, raw HTML, publish status, chrome toggles, creator linkage, and timestamps.
- [ ] Add the SQL migration for the new table and indexes.
- [ ] Implement route normalization and reserved-path validation helpers so custom pages cannot shadow built-in top-level routes.
- [ ] Add focused tests for route normalization and reserved-path rejection.

### Task 2: Admin CRUD

**Files:**
- Create: `src/lib/custom-pages.ts`
- Create: `src/lib/admin-custom-pages.ts`
- Create: `src/components/admin/admin-custom-page-manager.tsx`
- Create: `src/app/api/admin/custom-pages/route.ts`
- Modify: `src/lib/admin-navigation.ts`
- Modify: `src/components/admin/admin-module-search.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] Build query + mapping helpers for admin lists and published-page lookup.
- [ ] Implement admin save/delete/status-toggle logic with route validation and published timestamp handling.
- [ ] Add an admin manager UI for title, route, status, header/footer/sidebar toggles, and raw HTML editing.
- [ ] Register a new admin tab and search entry so the feature is discoverable.

### Task 3: Frontend Rendering And Footer Control

**Files:**
- Create: `src/app/[...customPage]/page.tsx`
- Modify: `src/components/conditional-site-footer.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/forum/forum-page-shell.tsx`
- Modify: `src/components/sidebar-navigation.tsx`
- Modify: `src/components/home/home-sidebar-panels.tsx`

- [ ] Render published custom pages from a root catch-all route using the normalized route path.
- [ ] Reuse existing left/right sidebar chrome with per-page switches and header-aware sticky offsets.
- [ ] Allow footer suppression by passing published “hide footer” paths into the root footer gate.
- [ ] Keep existing pages behavior unchanged when no custom-page overrides are in play.

### Task 4: Verification

**Files:**
- Verify: `prisma/schema.prisma`
- Verify: `src/app/[...customPage]/page.tsx`
- Verify: `src/components/admin/admin-custom-page-manager.tsx`
- Verify: `test/custom-page-types.test.ts`

- [ ] Run `pnpm prisma generate` so Prisma client types include `CustomPage`.
- [ ] Run `pnpm test -- test/custom-page-types.test.ts` or equivalent targeted test command if supported.
- [ ] Run `npx tsc --noEmit` to catch route/type regressions.
- [ ] Load the admin screen and a published custom page in the browser and confirm route rendering plus chrome toggles.
