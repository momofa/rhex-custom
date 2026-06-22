import "server-only"

import { Prisma, type PrismaClient } from "@prisma/client"

import type {
  AddonDatabaseApi,
  LoadedAddonRuntime,
} from "@/addons-host/types"

type AssertPermission = (permission: string, message?: string) => void

function createTemplateStringsArray(parts: string[]) {
  const template = [...parts] as unknown as TemplateStringsArray
  Object.defineProperty(template, "raw", {
    value: [...parts],
    enumerable: false,
  })
  return template
}

function compileParameterizedSql(
  sql: string,
  values: unknown[],
) {
  const source = typeof sql === "string" ? sql : String(sql ?? "")
  const parts: string[] = []
  const parameters: unknown[] = []
  const usedIndexes = new Set<number>()
  let lastIndex = 0
  let cursor = 0

  while (cursor < source.length) {
    const char = source[cursor]

    if (char === "'") {
      cursor += 1
      while (cursor < source.length) {
        if (source[cursor] === "'" && source[cursor + 1] === "'") {
          cursor += 2
          continue
        }
        if (source[cursor] === "'") {
          cursor += 1
          break
        }
        cursor += 1
      }
      continue
    }

    if (char === "\"") {
      cursor += 1
      while (cursor < source.length) {
        if (source[cursor] === "\"" && source[cursor + 1] === "\"") {
          cursor += 2
          continue
        }
        if (source[cursor] === "\"") {
          cursor += 1
          break
        }
        cursor += 1
      }
      continue
    }

    if (char === "-" && source[cursor + 1] === "-") {
      cursor += 2
      while (cursor < source.length && source[cursor] !== "\n") {
        cursor += 1
      }
      continue
    }

    if (char === "/" && source[cursor + 1] === "*") {
      cursor += 2
      while (cursor < source.length) {
        if (source[cursor] === "*" && source[cursor + 1] === "/") {
          cursor += 2
          break
        }
        cursor += 1
      }
      continue
    }

    if (char === "$") {
      const dollarQuoteMatch = source.slice(cursor).match(/^\$[A-Za-z_][A-Za-z0-9_]*?\$|^\$\$/)
      if (dollarQuoteMatch) {
        const tag = dollarQuoteMatch[0]
        const closingIndex = source.indexOf(tag, cursor + tag.length)
        cursor = closingIndex >= 0 ? closingIndex + tag.length : source.length
        continue
      }

      const placeholderMatch = source.slice(cursor).match(/^\$(\d+)/)
      if (placeholderMatch) {
        const valueIndex = Number.parseInt(placeholderMatch[1], 10) - 1
        if (!Number.isInteger(valueIndex) || valueIndex < 0 || valueIndex >= values.length) {
          throw new Error(`SQL placeholder ${placeholderMatch[0]} does not have a matching value`)
        }

        parts.push(source.slice(lastIndex, cursor))
        parameters.push(values[valueIndex])
        usedIndexes.add(valueIndex)
        cursor += placeholderMatch[0].length
        lastIndex = cursor
        continue
      }
    }

    cursor += 1
  }

  parts.push(source.slice(lastIndex))

  for (let index = 0; index < values.length; index += 1) {
    if (!usedIndexes.has(index)) {
      throw new Error(`SQL value at index ${index} is unused; only pass values referenced by $1, $2, ...`)
    }
  }

  return Prisma.sql(createTemplateStringsArray(parts), ...parameters)
}

export function buildAddonDatabaseApi(
  runtime: LoadedAddonRuntime,
  assertPermission: AssertPermission,
  client: PrismaClient,
): AddonDatabaseApi {
  const createPermissionMessage = (permission: "database:sql" | "database:orm") =>
    `addon "${runtime.manifest.id}" is not allowed to use ${permission === "database:orm" ? "host ORM" : "database SQL"}`

  return {
    get prisma() {
      assertPermission("database:orm", createPermissionMessage("database:orm"))
      return client
    },
    queryRaw: async <TRow = Record<string, unknown>>(sql: string, values: unknown[] = []) => {
      assertPermission("database:sql", createPermissionMessage("database:sql"))
      return client.$queryRaw<TRow[]>(compileParameterizedSql(sql, values))
    },
    executeRaw: async (sql: string, values: unknown[] = []) => {
      assertPermission("database:sql", createPermissionMessage("database:sql"))
      return client.$executeRaw(compileParameterizedSql(sql, values))
    },
    transaction: async <TResult>(task: (database: AddonDatabaseApi) => Promise<TResult>) =>
      client.$transaction(async (tx) =>
        task(buildAddonDatabaseApi(
          runtime,
          assertPermission,
          tx as unknown as PrismaClient,
        ))),
  }
}
