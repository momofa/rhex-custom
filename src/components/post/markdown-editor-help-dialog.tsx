"use client"

import { Modal } from "@/components/ui/modal"
import { MarkdownContentClient as MarkdownContent } from "@/components/markdown-content-client"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import type { ClientPlatform } from "@/lib/client-platform"
import { buildMarkdownEditorHelp } from "@/lib/markdown-editor-help"

interface MarkdownEditorHelpDialogProps {
  open: boolean
  onClose: () => void
  platform: ClientPlatform
  markdownEmojiMap?: MarkdownEmojiItem[]
  inFullscreenEditor?: boolean
}

export function MarkdownEditorHelpDialog({ open, onClose, platform, markdownEmojiMap, inFullscreenEditor = false }: MarkdownEditorHelpDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Markdown 帮助"
      description="查看当前编辑器支持的语法、扩展能力和快捷键。"
      overlayClassName={inFullscreenEditor ? "z-[240]" : undefined}
      contentClassName={inFullscreenEditor ? "z-[250]" : undefined}
    >
      <MarkdownContent
        content={buildMarkdownEditorHelp(platform)}
        markdownEmojiMap={markdownEmojiMap}
        className="markdown-body prose prose-sm max-w-none prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1"
      />
    </Modal>
  )
}

