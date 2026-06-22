import type { ReactNode } from "react"
import Link from "next/link"

type InlineTokenMatch = {
  end: number
  node: ReactNode
  start: number
}

type InlineTokenRenderer = {
  pattern: RegExp
  render: (match: RegExpExecArray, key: string) => ReactNode
}

const INLINE_TOKEN_RENDERERS: InlineTokenRenderer[] = [
  {
    pattern: /\[userLink:([^\]\r\n:]+):([^\]\r\n:]+)\]/gu,
    render: (match, key) => {
      const displayName = match[1]?.trim()
      const username = match[2]?.trim()

      if (!displayName || !username) {
        return match[0]
      }

      return (
        <Link
          key={key}
          href={`/users/${encodeURIComponent(username)}`}
          className="font-medium text-foreground underline decoration-foreground/30 underline-offset-3 transition-colors hover:text-foreground/70"
        >
          @{displayName}
        </Link>
      )
    },
  },
]

function findNextInlineToken(content: string, fromIndex: number) {
  let nextMatch: InlineTokenMatch | null = null

  for (const renderer of INLINE_TOKEN_RENDERERS) {
    renderer.pattern.lastIndex = fromIndex
    const match = renderer.pattern.exec(content)
    renderer.pattern.lastIndex = 0

    if (!match || typeof match.index !== "number") {
      continue
    }

    const candidate: InlineTokenMatch = {
      start: match.index,
      end: match.index + match[0].length,
      node: renderer.render(match, `${match.index}-${match[0]}`),
    }

    if (!nextMatch || candidate.start < nextMatch.start) {
      nextMatch = candidate
    }
  }

  return nextMatch
}

export function InlineTokenContent({ content }: { content: string }) {
  const nodes: ReactNode[] = []
  let cursor = 0

  while (cursor < content.length) {
    const nextToken = findNextInlineToken(content, cursor)

    if (!nextToken) {
      nodes.push(content.slice(cursor))
      break
    }

    if (nextToken.start > cursor) {
      nodes.push(content.slice(cursor, nextToken.start))
    }

    nodes.push(nextToken.node)
    cursor = nextToken.end
  }

  return <>{nodes}</>
}
