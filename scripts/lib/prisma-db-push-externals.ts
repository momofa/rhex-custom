export interface PrismaNamedObjectLike {
  name: string
  dbName?: string | null
}

interface DiffExternalDatabaseObjectsInput {
  currentTables: string[]
  currentEnums: string[]
  prismaTables: PrismaNamedObjectLike[]
  prismaEnums: PrismaNamedObjectLike[]
}

function normalizeObjectName(value: string) {
  return value.trim()
}

function toSortedUniqueNames(values: string[]) {
  return [...new Set(values.map(normalizeObjectName).filter(Boolean))].sort((left, right) => left.localeCompare(right))
}

export function parsePrismaSchemaObjectNames(schemaText: string) {
  const tables: string[] = []
  const enums: string[] = []

  let currentBlock: {
    kind: "model" | "enum"
    name: string
    dbName: string | null
  } | null = null

  for (const line of schemaText.split(/\r?\n/u)) {
    const trimmed = line.trim()

    if (!currentBlock) {
      const blockStartMatch = trimmed.match(/^(model|enum)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/u)
      if (blockStartMatch) {
        currentBlock = {
          kind: blockStartMatch[1] as "model" | "enum",
          name: blockStartMatch[2],
          dbName: null,
        }
      }
      continue
    }

    const mapMatch = trimmed.match(/^@@map\(\s*"([^"]+)"\s*\)/u)
    if (mapMatch) {
      currentBlock.dbName = mapMatch[1].trim()
    }

    if (trimmed === "}") {
      const resolvedName = currentBlock.dbName || currentBlock.name
      if (currentBlock.kind === "model") {
        tables.push(resolvedName)
      } else {
        enums.push(resolvedName)
      }
      currentBlock = null
    }
  }

  return {
    tables: toSortedUniqueNames(tables),
    enums: toSortedUniqueNames(enums),
  }
}

export function resolvePostgresSchemaName(databaseUrl: string) {
  const normalizedUrl = databaseUrl.trim()
  if (!normalizedUrl) {
    throw new Error("DATABASE_URL 未配置，无法解析当前 schema")
  }

  const url = new URL(normalizedUrl)
  return url.searchParams.get("schema")?.trim() || "public"
}

export function buildManagedObjectNameSet(
  values: PrismaNamedObjectLike[],
  extraNames: string[] = [],
) {
  const managedNames = values.map((value) => value.dbName?.trim() || value.name)
  return new Set(toSortedUniqueNames([...managedNames, ...extraNames]))
}

export function diffExternalDatabaseObjects(input: DiffExternalDatabaseObjectsInput) {
  const managedTables = buildManagedObjectNameSet(input.prismaTables, ["_prisma_migrations"])
  const managedEnums = buildManagedObjectNameSet(input.prismaEnums)

  return {
    externalTables: toSortedUniqueNames(input.currentTables).filter((tableName) => !managedTables.has(tableName)),
    externalEnums: toSortedUniqueNames(input.currentEnums).filter((enumName) => !managedEnums.has(enumName)),
  }
}

export function buildPrismaDbPushConfigSource(input: {
  schemaName: string
  schemaPath: string
  externalTables: string[]
  externalEnums: string[]
}) {
  const qualifiedExternalTables = input.externalTables.map((tableName) => `${input.schemaName}.${tableName}`)
  const qualifiedExternalEnums = input.externalEnums.map((enumName) => `${input.schemaName}.${enumName}`)
  const lines = [
    'import { defineConfig } from "prisma/config"',
    "",
    "export default defineConfig({",
    "  experimental: {",
    "    externalTables: true,",
    "  },",
    `  schema: ${JSON.stringify(input.schemaPath.replaceAll("\\", "/"))},`,
  ]

  if (qualifiedExternalTables.length > 0) {
    lines.push(`  tables: { external: ${JSON.stringify(qualifiedExternalTables)} },`)
  }

  if (qualifiedExternalEnums.length > 0) {
    lines.push(`  enums: { external: ${JSON.stringify(qualifiedExternalEnums)} },`)
  }

  lines.push("})", "")

  return lines.join("\n")
}
