import { Prisma } from "@prisma/client"

export function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (typeof value === "undefined") {
    return undefined
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export function toNullablePrismaJsonValue(value: unknown) {
  if (typeof value === "undefined") {
    return undefined
  }

  if (value === null) {
    return Prisma.JsonNull
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}
