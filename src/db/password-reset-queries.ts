import { prisma } from "@/db/client"

export function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      username: true,
      email: true,
      status: true,
    },
  })
}

export function findUserByPhone(phone: string) {
  return prisma.user.findFirst({
    where: {
      phone,
    },
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
      phoneVerifiedAt: true,
      status: true,
      statusExpiresAt: true,
      lastLoginIp: true,
    },
  })
}

export function updateUserPasswordById(userId: number, passwordHash: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      sessionInvalidBefore: new Date(),
    },
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
    },
  })
}
