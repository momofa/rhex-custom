/**
 * @file board-select.ts
 * @responsibility 为 addon 构建分区 board select 选项（分组+未分区兜底）
 * @scope Phase B.5 抽自 runtime/loader.ts 545-578 的 loadAddonBoardSelectOptions
 * @depends-on @/lib/boards, @/lib/zones (dynamic import), @/addons-host/types
 * @exports loadAddonBoardSelectOptions
 */

import type { AddonBoardSelectGroup } from "@/addons-host/types"

export async function loadAddonBoardSelectOptions(): Promise<AddonBoardSelectGroup[]> {
  const [{ getBoards }, { getZones }] = await Promise.all([
    import("@/lib/boards"),
    import("@/lib/zones"),
  ])
  const [boards, zones] = await Promise.all([
    getBoards(),
    getZones(),
  ])

  const groupedOptions = zones
    .map((zone) => ({
      zone: zone.name,
      items: boards
        .filter((board) => zone.boardSlugs.includes(board.slug))
        .map((board) => ({
          value: board.slug,
          label: board.name,
        })),
    }))
    .filter((group) => group.items.length > 0)
  const groupedBoardSlugs = new Set(
    groupedOptions.flatMap((group) => group.items.map((item) => item.value)),
  )
  const ungroupedBoards = boards
    .filter((board) => !groupedBoardSlugs.has(board.slug))
    .map((board) => ({
      value: board.slug,
      label: board.name,
    }))

  return ungroupedBoards.length > 0
    ? [...groupedOptions, { zone: "未分区节点", items: ungroupedBoards }]
    : groupedOptions
}
