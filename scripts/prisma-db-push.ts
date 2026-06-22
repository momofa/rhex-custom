import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import { promises as fs } from "node:fs"
import { resolve } from "node:path"

import { config as loadDotenv } from "dotenv"

import {
  buildPrismaDbPushConfigSource,
  diffExternalDatabaseObjects,
  parsePrismaSchemaObjectNames,
  resolvePostgresSchemaName,
} from "./lib/prisma-db-push-externals"
import { splitPrismaDbPushArgs } from "./lib/setup-safety"

loadDotenv({ path: resolve(process.cwd(), ".env") })

function runStep(command: string, args: string[], label: string) {
  console.log(`\n>>> ${label}`)

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function readDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim() || ""
  if (!databaseUrl) {
    throw new Error("DATABASE_URL 未配置，无法执行 Prisma schema 同步")
  }

  return databaseUrl
}

async function collectExternalDatabaseObjects(databaseUrl: string) {
  const schemaName = resolvePostgresSchemaName(databaseUrl)
  const schemaPath = resolve(process.cwd(), "prisma", "schema.prisma")
  const introspectionResult = spawnSync("npx", ["prisma", "db", "pull", "--force", "--print", "--schema", schemaPath], {
    cwd: process.cwd(),
    stdio: "pipe",
    encoding: "utf8",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  })

  if (introspectionResult.status !== 0) {
    const combinedOutput = [introspectionResult.stdout, introspectionResult.stderr].filter(Boolean).join("\n")
    // P4001 = 数据库为空（全新环境），无需保护任何外部对象，直接走普通 db push
    if (combinedOutput.includes("P4001")) {
      return {
        currentTables: [],
        currentEnums: [],
        schemaName,
        externalTables: [],
        externalEnums: [],
      }
    }
    throw new Error(
      [
        `无法为 schema "${schemaName}" 执行 Prisma introspection。`,
        combinedOutput,
      ].filter(Boolean).join("\n"),
    )
  }

  const introspectedObjects = parsePrismaSchemaObjectNames(introspectionResult.stdout ?? "")
  const managedObjects = parsePrismaSchemaObjectNames(await fs.readFile(schemaPath, "utf8"))

  return {
    currentTables: introspectedObjects.tables,
    currentEnums: introspectedObjects.enums,
    schemaName,
    ...diffExternalDatabaseObjects({
      currentTables: introspectedObjects.tables,
      currentEnums: introspectedObjects.enums,
      prismaTables: managedObjects.tables.map((name) => ({ name })),
      prismaEnums: managedObjects.enums.map((name) => ({ name })),
    }),
  }
}

async function main() {
  const schemaPath = resolve(process.cwd(), "prisma", "schema.prisma")
  const cleanupSqlPath = resolve(process.cwd(), "scripts", "prisma-pre-db-push.sql")
  const pushOptions = splitPrismaDbPushArgs({ argv: process.argv.slice(2) })
  const finalPushArgs = pushOptions.prismaArgs.includes("--skip-generate")
    ? pushOptions.prismaArgs
    : [...pushOptions.prismaArgs, "--skip-generate"]

  const databaseUrl = readDatabaseUrl()
  const {
    currentTables,
    schemaName,
    externalTables,
    externalEnums,
  } = await collectExternalDatabaseObjects(databaseUrl)

  if (pushOptions.cleanLegacyDeleted && currentTables.includes("Post") && currentTables.includes("Comment")) {
    runStep("npx", ["prisma", "db", "execute", "--file", cleanupSqlPath, "--schema", schemaPath], "清理历史 DELETED 数据")
  } else if (pushOptions.cleanLegacyDeleted) {
    console.log(`\n>>> 跳过历史 DELETED 数据清理（schema: ${schemaName} 缺少 Post/Comment）`)
  } else {
    console.log("\n>>> 跳过历史 DELETED 数据清理（默认保护数据；如确需清理请显式传 --clean-legacy-deleted）")
  }

  if (externalTables.length === 0 && externalEnums.length === 0) {
    console.log(`\n>>> 未发现需要保护的外部对象（schema: ${schemaName}）`)
    runStep("npx", ["prisma", "db", "push", "--schema", schemaPath, ...finalPushArgs], "同步数据库结构")
    return
  }

  const tempConfigPath = resolve(
    process.cwd(),
    `.rhex-prisma-db-push-${Date.now()}-${randomUUID().slice(0, 8)}.mjs`,
  )

  await fs.writeFile(tempConfigPath, buildPrismaDbPushConfigSource({
    schemaName,
    schemaPath,
    externalTables,
    externalEnums,
  }), "utf8")

  console.log(`\n>>> 保护外部数据库对象（schema: ${schemaName}）`)
  console.log(`- 外部表：${externalTables.length}`)
  console.log(`- 外部枚举：${externalEnums.length}`)

  try {
    runStep("npx", ["prisma", "db", "push", "--config", tempConfigPath, ...finalPushArgs], "同步数据库结构")
  } finally {
    await fs.rm(tempConfigPath, { force: true }).catch(() => undefined)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
