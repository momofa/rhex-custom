import type {
  AddonExecutionContextBase,
  AddonMaybePromise,
  AddonProviderRegistration,
  LoadedAddonRuntime,
} from "@/addons-host/types"

export interface AddonUploadPreparedFile {
  buffer: Uint8Array | null
  fileHash: string
  detectedMime: string
  fileSize: number
}

export interface AddonUploadActor {
  id: number
  username: string
  kind: "user" | "admin"
  role?: string
}

export interface AddonUploadProviderSaveResult {
  fileName?: string
  storagePath?: string
  urlPath: string
  fileExt?: string
  fileSize?: number
  mimeType?: string
  fileHash?: string
}

interface AddonUploadProviderRuntimeBaseInput {
  addon: LoadedAddonRuntime
  provider: AddonProviderRegistration
  context: AddonExecutionContextBase
  request?: Request
  actor?: AddonUploadActor | null
  file: File
  preparedFile: AddonUploadPreparedFile
  folder: string
}

export interface AddonUploadProviderRuntimeHooks {
  uploadFile?: (
    input: AddonUploadProviderRuntimeBaseInput,
  ) => AddonMaybePromise<
    AddonUploadProviderSaveResult | null | undefined
  >
}
