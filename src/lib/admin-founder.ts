import "server-only"

import { findFounderAdminId } from "@/db/admin-user-action-queries"

export async function isFounderAdmin(userId: number) {
  const founderAdminId = await findFounderAdminId()
  return founderAdminId === userId
}
