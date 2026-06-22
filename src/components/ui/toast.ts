import { toast as sonnerToast } from "sonner"

export type ToastVariant = "success" | "error" | "info" | "warning"

export interface ToastOptions {
  title?: string
  description: string
  variant?: ToastVariant
  duration?: number
}

function buildToastPayload(description: string, title?: string, duration?: number) {
  if (title) {
    return {
      message: title,
      options: {
        description,
        duration,
      },
    }
  }

  return {
    message: description,
    options: {
      duration,
    },
  }
}

export const toast = {
  show(options: ToastOptions) {
    const payload = buildToastPayload(options.description, options.title, options.duration)

    switch (options.variant) {
      case "success":
        return sonnerToast.success(payload.message, payload.options)
      case "error":
        return sonnerToast.error(payload.message, payload.options)
      case "warning":
        return sonnerToast.warning(payload.message, payload.options)
      case "info":
      default:
        return sonnerToast(payload.message, payload.options)
    }
  },
  success(description: string, title?: string, duration?: number) {
    const payload = buildToastPayload(description, title, duration)
    return sonnerToast.success(payload.message, payload.options)
  },
  error(description: string, title?: string, duration?: number) {
    const payload = buildToastPayload(description, title, duration)
    return sonnerToast.error(payload.message, payload.options)
  },
  info(description: string, title?: string, duration?: number) {
    const payload = buildToastPayload(description, title, duration)
    return sonnerToast(payload.message, payload.options)
  },
  warning(description: string, title?: string, duration?: number) {
    const payload = buildToastPayload(description, title, duration)
    return sonnerToast.warning(payload.message, payload.options)
  },
  dismiss(id?: string | number) {
    return sonnerToast.dismiss(id)
  },
}
