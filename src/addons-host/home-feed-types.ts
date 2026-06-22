import type {
  AddonExecutionContextBase,
  AddonMaybePromise,
  AddonProviderRegistration,
  AddonRenderResult,
  LoadedAddonRuntime,
} from "@/addons-host/types"

interface AddonHomeFeedProviderRuntimeBaseInput {
  addon: LoadedAddonRuntime
  provider: AddonProviderRegistration
  context: AddonExecutionContextBase
}

export interface AddonHomeFeedTabRegistration {
  slug?: string
  label: string
  description?: string
  order?: number
}

export interface ResolvedAddonHomeFeedTab {
  addonId: string
  providerCode: string
  providerLabel: string
  slug: string
  label: string
  description?: string
  order: number
}

export interface AddonHomeFeedProviderRenderInput
  extends AddonHomeFeedProviderRuntimeBaseInput {
  page: number
  pathname: string
  request?: Request
  searchParams?: URLSearchParams
  tab: ResolvedAddonHomeFeedTab
}

export interface AddonHomeFeedProviderMetadata {
  title?: string
  description?: string
}

export interface AddonHomeFeedProviderRuntimeHooks {
  getTab?: (
    input: AddonHomeFeedProviderRuntimeBaseInput,
  ) => AddonMaybePromise<AddonHomeFeedTabRegistration | null | undefined>
  render?: (
    input: AddonHomeFeedProviderRenderInput,
  ) => AddonMaybePromise<AddonRenderResult | null | undefined>
  getMetadata?: (
    input: AddonHomeFeedProviderRenderInput,
  ) => AddonMaybePromise<AddonHomeFeedProviderMetadata | null | undefined>
}
