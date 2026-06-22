/**
 * @file map-utils.ts
 * @responsibility 通用 Map 辅助：getOrCreateMapValue 惰性初始化
 * @scope Phase B.9 抽自 runtime/loader.ts，供 route-index / registry-aggregator 共享
 * @depends-on (无运行时依赖)
 * @exports getOrCreateMapValue
 */

export function getOrCreateMapValue<TKey, TValue>(
  map: Map<TKey, TValue>,
  key: TKey,
  create: () => TValue,
) {
  const existing = map.get(key)
  if (existing) {
    return existing
  }

  const nextValue = create()
  map.set(key, nextValue)
  return nextValue
}