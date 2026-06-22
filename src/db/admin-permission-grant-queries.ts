import { prisma } from "@/db/client"
import type { AdminPermissionKey } from "@/lib/admin-permission-policy"

export interface AdminPermissionGrantRecord {
  permissionKey: AdminPermissionKey
  allowed: boolean
}

export function findAdminPermissionGrantsByUserId(userId: number) {
  return prisma.adminPermissionGrant.findMany({
    where: { userId },
    orderBy: { permissionKey: "asc" },
    select: {
      permissionKey: true,
      allowed: true,
    },
  }) as Promise<AdminPermissionGrantRecord[]>
}

export function deleteAdminPermissionGrantsByUserId(userId: number) {
  return prisma.adminPermissionGrant.deleteMany({
    where: { userId },
  })
}

export async function replaceAdminPermissionGrants(
  userId: number,
  grants: AdminPermissionGrantRecord[],
) {
  await prisma.$transaction(async (tx) => {
    await tx.adminPermissionGrant.deleteMany({
      where: { userId },
    })

    if (grants.length > 0) {
      await tx.adminPermissionGrant.createMany({
        data: grants.map((grant) => ({
          userId,
          permissionKey: grant.permissionKey,
          allowed: grant.allowed,
        })),
      })
    }
  })
}
