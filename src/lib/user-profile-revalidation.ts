import "server-only"

import { revalidatePath } from "next/cache"

import { revalidateUserSurfaceCache } from "@/lib/user-surface"

function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    if (type) {
      revalidatePath(path, type)
      return
    }

    revalidatePath(path)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.startsWith("Invariant: static generation store missing in revalidatePath")
      || message.includes('used "revalidatePath ')
    ) {
      return
    }

    throw error
  }
}

export function revalidateUserProfileMutation(input: {
  userId: number
  username: string
}) {
  revalidateUserSurfaceCache(input.userId)
  safeRevalidatePath("/settings")
  safeRevalidatePath("/users/[username]", "page")
  safeRevalidatePath(`/users/${input.username}`)
  safeRevalidatePath(`/api/users/${input.username}/preview`)
}
