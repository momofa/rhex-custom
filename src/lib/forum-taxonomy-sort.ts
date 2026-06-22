export const DEFAULT_TAXONOMY_POST_SORT = "latest" as const

export type TaxonomyPostSort = typeof DEFAULT_TAXONOMY_POST_SORT | "new" | "featured"

export interface TaxonomyPostSortLinks {
  currentSort: TaxonomyPostSort
  latestHref: string
  newHref: string
  featuredHref: string
}

export function normalizeTaxonomyPostSort(sort?: string): TaxonomyPostSort {
  if (sort === "new" || sort === "featured") {
    return sort
  }

  return DEFAULT_TAXONOMY_POST_SORT
}

export function usePublishedTimeForTaxonomySort(sort: TaxonomyPostSort) {
  return sort === "new" || sort === "featured"
}
