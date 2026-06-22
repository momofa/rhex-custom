import "server-only"

import type { AiProvider, AiProviderConfig } from "./types"
import { OpenAiCompatibleProvider } from "./openai-compatible"

export function resolveAiProvider(config: AiProviderConfig): AiProvider {
  switch (config.kind) {
    case "openai-compatible":
      return new OpenAiCompatibleProvider(config)
    default: {
      const _exhaustive: never = config.kind
      throw new Error(`Unsupported provider kind: ${String(_exhaustive)}`)
    }
  }
}

export * from "./types"
export { OpenAiCompatibleProvider }