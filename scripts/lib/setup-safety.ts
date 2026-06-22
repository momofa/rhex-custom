export const ACCEPT_DATA_LOSS_ARG = "--accept-data-loss"
export const CLEAN_LEGACY_DELETED_ARG = "--clean-legacy-deleted"

type SetupEnv = Record<string, string | undefined>

const internalPrismaDbPushArgs = new Set([CLEAN_LEGACY_DELETED_ARG])

export function readBooleanEnv(env: SetupEnv, key: string) {
  const value = env[key]
  return typeof value === "string" && ["1", "true", "yes", "y", "on"].includes(value.trim().toLowerCase())
}

function ensureAcceptDataLoss(args: string[]) {
  return args.includes(ACCEPT_DATA_LOSS_ARG) ? args : [...args, ACCEPT_DATA_LOSS_ARG]
}

export function buildSetupSchemaArgs(input: {
  argv: string[]
}) {
  const args = ensureAcceptDataLoss(["tsx", "scripts/prisma-db-push.ts"])

  if (input.argv.includes(CLEAN_LEGACY_DELETED_ARG)) {
    args.push(CLEAN_LEGACY_DELETED_ARG)
  }

  return {
    args,
  }
}

export function splitPrismaDbPushArgs(input: {
  argv: string[]
}) {
  return {
    prismaArgs: ensureAcceptDataLoss(input.argv.filter((arg) => !internalPrismaDbPushArgs.has(arg))),
    cleanLegacyDeleted: input.argv.includes(CLEAN_LEGACY_DELETED_ARG),
  }
}
