"use client"

import { useRouter } from "next/navigation"
import { useCallback, useTransition } from "react"

import { toast } from "@/components/ui/toast"
import { toAdminClientError, type AdminClientError, type AdminClientResult } from "@/lib/admin-client"

interface UseAdminMutationOptions<TData> {
  mutation: () => Promise<AdminClientResult<TData>>
  successTitle?: string
  errorTitle?: string
  errorMessage?: string
  refreshRouter?: boolean
  showSuccessToast?: boolean
  showErrorToast?: boolean
  onSuccess?: (result: AdminClientResult<TData>) => void | Promise<void>
  onError?: (error: AdminClientError) => void | Promise<void>
  onSettled?: () => void | Promise<void>
}

export function useAdminMutation() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const runMutation = useCallback(<TData,>(options: UseAdminMutationOptions<TData>) => {
    startTransition(() => {
      void (async () => {
        try {
          const result = await options.mutation()
          await options.onSuccess?.(result)

          if (options.refreshRouter) {
            router.refresh()
          }

          if (options.showSuccessToast !== false) {
            toast.success(result.message, options.successTitle)
          }
        } catch (error) {
          const normalizedError = toAdminClientError(error, options.errorMessage ?? "操作失败，请稍后重试")

          if (options.showErrorToast !== false) {
            toast.error(normalizedError.message, options.errorTitle)
          }

          await options.onError?.(normalizedError)
        } finally {
          await options.onSettled?.()
        }
      })()
    })
  }, [router])

  return {
    isPending,
    runMutation,
  }
}
