import {
  isRecord,
  readSiteSettingsState,
  writeSiteSettingsState,
} from "@/lib/site-settings-app-state.types"

export const EDITOR_TOOLBAR_ITEM_KEYS = [
  "heading",
  "bold",
  "underline",
  "strike",
  "highlight",
  "code",
  "quote",
  "spoiler",
  "list",
  "link",
  "table",
  "divider",
  "alignment",
  "media",
  "emoji",
  "image",
  "base64",
  "help",
] as const

export type EditorToolbarItemKey = (typeof EDITOR_TOOLBAR_ITEM_KEYS)[number]

export interface EditorToolbarSettings {
  order: EditorToolbarItemKey[]
  hidden: EditorToolbarItemKey[]
}

export interface EditorToolbarItemDefinition {
  key: EditorToolbarItemKey
  label: string
  description: string
}

export const DEFAULT_EDITOR_TOOLBAR_ORDER: EditorToolbarItemKey[] = [...EDITOR_TOOLBAR_ITEM_KEYS]

export const EDITOR_TOOLBAR_ITEM_DEFINITIONS: Record<EditorToolbarItemKey, EditorToolbarItemDefinition> = {
  heading: {
    key: "heading",
    label: "标题层级",
    description: "标题下拉选择器。",
  },
  bold: {
    key: "bold",
    label: "加粗",
    description: "加粗选中文本。",
  },
  underline: {
    key: "underline",
    label: "下划线",
    description: "为选中文本添加下划线。",
  },
  strike: {
    key: "strike",
    label: "删除线",
    description: "为选中文本添加删除线。",
  },
  highlight: {
    key: "highlight",
    label: "高亮",
    description: "插入 Markdown 高亮标记。",
  },
  code: {
    key: "code",
    label: "代码格式",
    description: "行内代码和代码块选择器。",
  },
  quote: {
    key: "quote",
    label: "引用",
    description: "插入引用块。",
  },
  spoiler: {
    key: "spoiler",
    label: "剧透",
    description: "插入折叠剧透或遮罩内容。",
  },
  list: {
    key: "list",
    label: "列表格式",
    description: "无序、有序和待办列表选择器。",
  },
  link: {
    key: "link",
    label: "插入链接",
    description: "打开链接插入面板。",
  },
  table: {
    key: "table",
    label: "插入表格",
    description: "打开表格插入面板。",
  },
  divider: {
    key: "divider",
    label: "分割线",
    description: "插入 Markdown 分割线。",
  },
  alignment: {
    key: "alignment",
    label: "内容对齐",
    description: "左对齐、居中和右对齐选择器。",
  },
  media: {
    key: "media",
    label: "插入媒体",
    description: "插入音频、视频或 iframe。",
  },
  emoji: {
    key: "emoji",
    label: "表情",
    description: "打开 Markdown 表情面板。",
  },
  image: {
    key: "image",
    label: "图片",
    description: "根据上传开关打开图片上传或远程图片面板。",
  },
  base64: {
    key: "base64",
    label: "加密内容",
    description: "打开 Base64 和私密回复面板。",
  },
  help: {
    key: "help",
    label: "Markdown 帮助",
    description: "打开 Markdown 帮助说明。",
  },
}

const EDITOR_TOOLBAR_ITEM_KEY_SET = new Set<string>(EDITOR_TOOLBAR_ITEM_KEYS)

function normalizeEditorToolbarItemKey(value: unknown): EditorToolbarItemKey | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  if (normalized === "imageUpload" || normalized === "imageRemote") {
    return "image"
  }

  return EDITOR_TOOLBAR_ITEM_KEY_SET.has(normalized)
    ? normalized as EditorToolbarItemKey
    : null
}

function normalizeEditorToolbarOrder(value: unknown) {
  const next: EditorToolbarItemKey[] = []
  const seen = new Set<EditorToolbarItemKey>()
  const source = Array.isArray(value) ? value : DEFAULT_EDITOR_TOOLBAR_ORDER

  for (const item of source) {
    const key = normalizeEditorToolbarItemKey(item)
    if (!key || seen.has(key)) {
      continue
    }

    next.push(key)
    seen.add(key)
  }

  for (const key of DEFAULT_EDITOR_TOOLBAR_ORDER) {
    if (!seen.has(key)) {
      next.push(key)
      seen.add(key)
    }
  }

  return next
}

function normalizeEditorToolbarHidden(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  const hidden = new Set<EditorToolbarItemKey>()
  for (const item of value) {
    const key = normalizeEditorToolbarItemKey(item)
    if (key) {
      hidden.add(key)
    }
  }

  return DEFAULT_EDITOR_TOOLBAR_ORDER.filter((key) => hidden.has(key))
}

export function normalizeEditorToolbarSettings(value?: unknown): EditorToolbarSettings {
  const input = isRecord(value) ? value : {}

  return {
    order: normalizeEditorToolbarOrder(input.order),
    hidden: normalizeEditorToolbarHidden(input.hidden),
  }
}

export function resolveEditorToolbarSettings(options: {
  appStateJson?: string | null
} = {}): EditorToolbarSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  return normalizeEditorToolbarSettings(siteSettingsState.editorToolbar)
}

export function mergeEditorToolbarSettings(
  appStateJson: string | null | undefined,
  input: unknown,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const editorToolbar = normalizeEditorToolbarSettings(input)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    editorToolbar,
  })
}
