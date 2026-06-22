import "server-only"

import { revalidatePath } from "next/cache"

import { revalidateGlobalLayoutAddonSlotsCache } from "@/addons-host/runtime/global-layout-slot-cache"

function safeRevalidatePath(targetPath: string, type?: "page" | "layout") {
  try {
    if (type) {
      revalidatePath(targetPath, type)
      return
    }

    revalidatePath(targetPath)
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

export function revalidateAddonRuntimeCaches(addonId?: string | null) {
  const normalizedAddonId = typeof addonId === "string" ? addonId.trim() : ""

  revalidateGlobalLayoutAddonSlotsCache()
  safeRevalidatePath("/", "layout")
  safeRevalidatePath("/admin/addons")
  safeRevalidatePath("/addons")

  if (normalizedAddonId) {
    safeRevalidatePath(`/admin/addons/${normalizedAddonId}`)
    safeRevalidatePath(`/addons/${normalizedAddonId}`)
  }
}
