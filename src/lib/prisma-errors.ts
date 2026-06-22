import { Prisma } from "@/db/types"

export function isPrismaUniqueConstraintError(error: unknown, targetName: string) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false
  }

  const target = error.meta?.target
  const normalizedTargetName = targetName.toLocaleLowerCase()

  if (Array.isArray(target)) {
    return target.some((item) => String(item).toLocaleLowerCase().includes(normalizedTargetName))
  }

  if (typeof target === "string") {
    return target.toLocaleLowerCase().includes(normalizedTargetName)
  }

  return false
}
