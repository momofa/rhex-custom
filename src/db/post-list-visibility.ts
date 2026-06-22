import type { Prisma } from "@/db/types"
import { buildManagedPostWhereInput, type AdminActor } from "@/lib/moderator-permissions"
import { PUBLIC_READABLE_POST_STATUSES } from "@/lib/post-types"

const PRIVATE_LIST_VISIBLE_POST_STATUSES = ["PENDING", "OFFLINE"] as const

export interface PostListVisibilityViewer {
  userId?: number | null
  adminActor?: AdminActor | null
}

function hasViewer(viewer?: PostListVisibilityViewer | null) {
  return Boolean(viewer?.userId || viewer?.adminActor)
}

export function shouldBypassPublicPostListCache(viewer?: PostListVisibilityViewer | null) {
  return hasViewer(viewer)
}

export function buildPostListVisibilityWhere(viewer?: PostListVisibilityViewer | null): Prisma.PostWhereInput {
  const or: Prisma.PostWhereInput[] = [
    {
      status: {
        in: [...PUBLIC_READABLE_POST_STATUSES],
      },
    },
  ]

  if (viewer?.userId) {
    or.push({
      status: {
        in: [...PRIVATE_LIST_VISIBLE_POST_STATUSES],
      },
      authorId: viewer.userId,
    })
  }

  if (viewer?.adminActor) {
    const managedWhere = buildManagedPostWhereInput(viewer.adminActor)
    const managedPrivateWhere: Prisma.PostWhereInput = {
      status: {
        in: [...PRIVATE_LIST_VISIBLE_POST_STATUSES],
      },
    }

    or.push(managedWhere ? { AND: [managedPrivateWhere, managedWhere] } : managedPrivateWhere)
  }

  return { OR: or }
}
