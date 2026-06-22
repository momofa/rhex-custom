"use client"

import type { FormEvent, ReactNode } from "react"
import { isValidElement } from "react"
import { useId } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface ModalProps {
  open: boolean
  title: string
  description?: string
  size?: "md" | "lg" | "xl"
  children: ReactNode
  footer?: ReactNode
  showHeaderCloseButton?: boolean
  hideHeaderCloseButtonOnMobile?: boolean
  closeDisabled?: boolean
  closeOnEscape?: boolean
  contentClassName?: string
  overlayClassName?: string
  onClose: () => void
}

const sizeClassMap: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "sm:max-w-lg",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
}

interface FormModalProps extends Omit<ModalProps, "children" | "footer"> {
  children: ReactNode
  footer?: (context: { formId: string }) => ReactNode
  formClassName?: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function getNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join("")
  }

  if (!isValidElement(node)) {
    return ""
  }

  return getNodeText((node.props as { children?: ReactNode }).children)
}

function hasFooterCancelButton(node: ReactNode): boolean {
  if (Array.isArray(node)) {
    return node.some(hasFooterCancelButton)
  }

  if (!isValidElement(node)) {
    return false
  }

  const props = node.props as {
    children?: ReactNode
    href?: unknown
    onClick?: unknown
    type?: unknown
  }
  const typeName = typeof node.type === "string"
    ? node.type
    : ((node.type as { displayName?: string; name?: string }).displayName ?? (node.type as { name?: string }).name ?? "")
  const isActionLike = typeName === "button"
    || typeName === "a"
    || typeName.includes("Button")
    || typeName.includes("DialogClose")
    || typeof props.onClick === "function"
    || typeof props.href === "string"
    || props.type === "button"
    || props.type === "submit"

  if (isActionLike && (getNodeText(props.children).includes("取消") || getNodeText(props.children).includes("关闭"))) {
    return true
  }

  return hasFooterCancelButton(props.children)
}

export function Modal({
  open,
  title,
  description,
  size = "md",
  children,
  footer,
  showHeaderCloseButton = true,
  hideHeaderCloseButtonOnMobile = false,
  closeDisabled = false,
  closeOnEscape = true,
  contentClassName,
  overlayClassName,
  onClose,
}: ModalProps) {
  const shouldHideHeaderCloseButtonOnMobile = hideHeaderCloseButtonOnMobile || hasFooterCancelButton(footer)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (nextOpen) {
          return
        }

        if (closeDisabled) {
          return
        }

        if (!closeOnEscape && eventDetails.reason === "escape-key") {
          return
        }

        onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName={overlayClassName}
        className={cn(
          "z-[210] flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)] sm:max-h-[calc(100dvh-3rem)]",
          sizeClassMap[size],
          contentClassName
        )}
      >
        <DialogHeader className="gap-3 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg leading-snug">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="mt-1">
                {description}
              </DialogDescription>
            ) : null}
          </div>
          {!closeDisabled && showHeaderCloseButton ? (
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  className={cn("h-8 w-full shrink-0 px-2 text-xs sm:w-auto", shouldHideHeaderCloseButtonOnMobile && "hidden sm:inline-flex")}
                  disabled={closeDisabled}
                />
              }
            >
              关闭
            </DialogClose>
          ) : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {children}
        </div>
        {footer ? (
          <DialogFooter className="mx-0 mb-0 rounded-none border-t px-4 py-4 sm:px-5">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export function FormModal({
  children,
  footer,
  formClassName,
  onSubmit,
  ...modalProps
}: FormModalProps) {
  const formId = useId()

  return (
    <Modal
      {...modalProps}
      footer={footer ? footer({ formId }) : undefined}
    >
      <form
        id={formId}
        onSubmit={onSubmit}
        className={formClassName ? formClassName : "space-y-4"}
      >
        {children}
      </form>
    </Modal>
  )
}
