import { prisma } from "@/db/client"
import { PUBLIC_READABLE_POST_STATUSES } from "@/lib/post-types"
import { MAX_MANUAL_TAGS } from "@/lib/post-tags"

export async function findPostSidebarData(
  postId: string,
  authorUsername: string,
  relatedPostsLimit = 5,
  currentUserId?: number | null,
) {
  const [author, postTags, relatedPosts, favoriteCollections] = await Promise.all([
    prisma.user.findUnique({
      where: { username: authorUsername },
      select: {
        bio: true,
      },
    }),


    prisma.postTag.findMany({
      where: { postId },
      include: { tag: true },
      // Keep the editable sidebar tags aligned with the post tag editor's max.
      take: MAX_MANUAL_TAGS,
    }),
    prisma.post.findMany({
      where: {
        id: { not: postId },
        status: { in: [...PUBLIC_READABLE_POST_STATUSES] },
        OR: [
          {
            author: {
              username: authorUsername,
            },
          },
        ],
      },
      select: {
        id: true,
        slug: true,
        title: true,
      },
      take: relatedPostsLimit,
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.favoriteCollectionItem.findMany({
      where: {
        postId,
        collection: currentUserId
          ? {
              OR: [
                { visibility: "PUBLIC" },
                { ownerId: currentUserId },
              ],
            }
          : {
              visibility: "PUBLIC",
            },
      },
      select: {
        collection: {
          select: {
            id: true,
            title: true,
            visibility: true,
          },
        },
      },
      orderBy: [
        { collection: { updatedAt: "desc" } },
        { collection: { title: "asc" } },
      ],
      take: 10,
    }),
  ])

  return { author, postTags, relatedPosts, favoriteCollections }
}
