import type { ScriptHTMLAttributes } from "react"

const SCRIPT_TAG_PATTERN = /<script\b([^>]*?)(?:>([\s\S]*?)<\/script\s*>|\/\s*>)/gi
const SCRIPT_ATTRIBUTE_PATTERN = /([^\s"'<>/=`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

const SCRIPT_ATTRIBUTE_NAME_MAP: Record<string, string> = {
  crossorigin: "crossOrigin",
  fetchpriority: "fetchPriority",
  nomodule: "noModule",
  referrerpolicy: "referrerPolicy",
  charset: "charSet",
}

type SiteAnalyticsScriptProps = Omit<ScriptHTMLAttributes<HTMLScriptElement>, "children" | "dangerouslySetInnerHTML">

export interface SiteAnalyticsScriptDescriptor {
  content: string
  props: SiteAnalyticsScriptProps
}

export function parseSiteAnalyticsCode(input: string) {
  const htmlSegments: string[] = []
  const scripts: SiteAnalyticsScriptDescriptor[] = []
  let lastIndex = 0

  for (const match of input.matchAll(SCRIPT_TAG_PATTERN)) {
    const matchIndex = match.index ?? 0

    if (matchIndex > lastIndex) {
      htmlSegments.push(input.slice(lastIndex, matchIndex))
    }

    const attributes = match[1] ?? ""
    const content = match[2] ?? ""
    const props = parseScriptAttributes(attributes)
    const hasSrc = typeof props.src === "string" && props.src.length > 0
    const hasContent = content.trim().length > 0

    if (hasSrc || hasContent) {
      scripts.push({
        content,
        props,
      })
    }

    lastIndex = matchIndex + match[0].length
  }

  if (lastIndex < input.length) {
    htmlSegments.push(input.slice(lastIndex))
  }

  return {
    html: htmlSegments.join(""),
    scripts,
  }
}

function parseScriptAttributes(input: string): SiteAnalyticsScriptProps {
  const scriptProps: Record<string, string | boolean> = {}

  for (const match of input.matchAll(SCRIPT_ATTRIBUTE_PATTERN)) {
    const rawName = match[1]
    const rawValue = match[2] ?? match[3] ?? match[4]
    const normalizedName = SCRIPT_ATTRIBUTE_NAME_MAP[rawName.toLowerCase()] ?? rawName

    scriptProps[normalizedName] = rawValue === undefined ? true : rawValue
  }

  return scriptProps as SiteAnalyticsScriptProps
}
