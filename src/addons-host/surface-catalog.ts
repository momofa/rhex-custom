import type { AddonSurfaceKey } from "@/addons-host/types"

export type AddonSurfaceExecutionMode = "server" | "client" | "hybrid"

export interface AddonSurfaceCatalogEntry {
  name: AddonSurfaceKey
  category: string
  scope: "global" | "page"
  summary: string
  mode: AddonSurfaceExecutionMode
}

function surface(
  name: AddonSurfaceKey,
  summary: string,
  options?: {
    category?: string
    scope?: "global" | "page"
    mode?: AddonSurfaceExecutionMode
  },
): AddonSurfaceCatalogEntry {
  return {
    name,
    category: options?.category ?? name.split(".", 1)[0] ?? "misc",
    scope: options?.scope ?? "page",
    summary,
    mode: options?.mode ?? "server",
  }
}

export const ADDON_SURFACE_CATALOG = [
  surface("layout.header", "接管全站页头主体渲染。", { category: "layout", scope: "global" }),
  surface("layout.footer", "接管全站页脚主体渲染。", { category: "layout", scope: "global" }),

  surface("addon.page", "接管插件前台页主体区域。", { category: "addon" }),
  surface("addon.page.header", "接管插件前台页默认标题区。", { category: "addon" }),
  surface("addon.page.content", "接管插件前台页渲染块。", { category: "addon" }),

  surface("about.page", "接管关于页主体区域。"),
  surface("about.hero", "接管关于页顶部介绍区。"),
  surface("about.highlights", "接管关于页亮点说明区。"),
  surface("about.principles", "接管关于页社区原则区。"),
  surface("about.sidebar", "接管关于页右侧栏。"),

  surface("announcement.page", "接管单公告页主体区域。"),
  surface("announcement.hero", "接管单公告头部信息区。"),
  surface("announcement.content", "接管单公告正文区。"),
  surface("announcements.page", "接管公告列表页主体区域。"),
  surface("announcements.hero", "接管公告列表顶部说明区。"),
  surface("announcements.content", "接管公告列表区。"),

  surface("auth.complete.page", "接管第三方登录补全页主体区域。", { category: "auth" }),
  surface("auth.complete.panel", "接管第三方登录补全面板。", { category: "auth" }),
  surface("auth.forgot-password.page", "接管找回密码页主体区域。", { category: "auth" }),
  surface("auth.forgot-password.panel", "接管找回密码面板。", { category: "auth" }),
  surface("auth.login.page", "接管登录页主体区域。", { category: "auth" }),
  surface("auth.login.panel", "接管登录面板。", { category: "auth" }),
  surface("auth.login.form", "接管登录表单。", { category: "auth" }),
  surface("auth.passkey.page", "接管 Passkey 页面主体区域。", { category: "auth" }),
  surface("auth.passkey.panel", "接管 Passkey 面板。", { category: "auth" }),
  surface("auth.register.page", "接管注册页主体区域。", { category: "auth" }),
  surface("auth.register.panel", "接管注册面板。", { category: "auth" }),
  surface("auth.register.form", "接管注册表单。", { category: "auth" }),

  surface("badge.page", "接管勋章详情页主体区域。"),
  surface("badge.hero", "接管勋章详情顶部介绍区。"),
  surface("badge.sidebar", "接管勋章详情右侧栏。"),

  surface("verification.page", "接管认证详情页主体区域。"),
  surface("verification.hero", "接管认证详情顶部介绍区。"),
  surface("verification.application", "接管认证用户展示卡片。"),
  surface("verification.sidebar", "接管认证详情页右侧栏。"),

  surface("board.page", "接管节点页主体区域。"),
  surface("board.hero", "接管节点顶部介绍卡。"),
  surface("board.content", "接管节点帖子流区域。"),
  surface("board.sidebar", "接管节点右侧栏。"),

  surface("collection.page", "接管单合集页主体区域。"),
  surface("collection.hero", "接管单合集头部信息区。", { mode: "client" }),
  surface("collection.pending", "接管单合集待审核区。", { mode: "client" }),
  surface("collection.content", "接管单合集已收录帖子区。", { mode: "client" }),
  surface("collection.sidebar", "接管单合集右侧栏。"),
  surface("collections.page", "接管合集广场页主体区域。"),
  surface("collections.hero", "接管合集广场顶部介绍区。"),
  surface("collections.content", "接管合集广场内容区。"),
  surface("collections.sidebar", "接管合集广场右侧栏。"),

  surface("comment.author.row", "接管评论作者行。", { category: "comment", mode: "client" }),
  surface("comment.author.meta", "接管评论作者元信息区。", { category: "comment", mode: "client" }),
  surface("comment.author.verification", "接管评论作者认证标识。", { category: "comment", mode: "client" }),
  surface("comment.author.name", "接管评论作者名称区。", { category: "comment", mode: "client" }),
  surface("comment.author.badges", "接管评论作者勋章区。", { category: "comment", mode: "client" }),

  surface("custom-page.page", "接管自定义页主体区域。", { category: "custom-page" }),
  surface("custom-page.content", "接管自定义页 HTML 内容区。", { category: "custom-page" }),
  surface("custom-page.sidebar", "接管自定义页右侧栏。", { category: "custom-page" }),

  surface("faq.page", "接管 FAQ 页面主体区域。"),
  surface("faq.tabs", "接管 FAQ 顶部专题导航。"),
  surface("faq.content", "接管 FAQ 正文区。"),

  surface("feed.page", "接管首页内容流主体区域。"),
  surface("feed.main", "接管首页内容流列表。"),
  surface("feed.latest", "接管首页 / 最新流专属区。"),
  surface("feed.new", "接管新贴流专属区。"),
  surface("feed.hot", "接管热门流专属区。"),
  surface("feed.following", "接管关注流专属区。"),
  surface("feed.universe", "接管宇宙流专属区。"),
  surface("feed.sidebar", "接管首页内容流右侧栏。"),

  surface("friend-links.page", "接管友情链接页主体区域。", { category: "friend-links" }),
  surface("friend-links.hero", "接管友情链接顶部说明区。", { category: "friend-links" }),
  surface("friend-links.content", "接管友情链接目录区。", { category: "friend-links" }),

  surface("funs.page", "接管全部节点页主体区域。"),
  surface("funs.content", "接管全部节点内容区。"),
  surface("funs.sidebar", "接管全部节点右侧栏。"),
  surface("funs.app.page", "接管功能应用页主体区域。", { category: "funs" }),
  surface("funs.app.content", "接管功能应用内容区。", { category: "funs" }),

  surface("help.page", "接管帮助页主体区域。"),
  surface("help.document", "接管帮助文档区。"),
  surface("help.sidebar", "接管帮助页右侧栏。"),

  surface("history.page", "接管足迹页主体区域。"),
  surface("history.panel", "接管足迹面板。", { mode: "client" }),

  surface("messages.page", "接管私信页主体区域。", { mode: "hybrid" }),
  surface("messages.header", "接管私信标题区。", { mode: "client" }),
  surface("messages.sidebar", "接管私信会话侧栏。", { mode: "client" }),
  surface("messages.thread", "接管私信会话正文。", { mode: "client" }),

  surface("notifications.page", "接管通知页主体区域。"),
  surface("notifications.toolbar", "接管通知工具区。"),
  surface("notifications.list", "接管通知列表。"),

  surface("post.header", "接管帖子详情头部信息区。"),
  surface("post.body", "接管帖子正文、附件与帖子类型扩展区。"),
  surface("post.author.row", "接管帖子作者行。"),
  surface("post.author.meta", "接管帖子作者元信息区。"),
  surface("post.author.verification", "接管帖子作者认证标识。"),
  surface("post.author.name", "接管帖子作者名称区。"),
  surface("post.author.badges", "接管帖子作者勋章区。"),
  surface("post.create.form", "接管发帖表单整体。", { mode: "client" }),
  surface("post.create.tools", "接管发帖基础设置区。", { mode: "client" }),
  surface("post.create.editor", "接管发帖正文编辑器。", { mode: "client" }),
  surface("post.create.enhancements", "接管发帖增强功能区。", { mode: "client" }),
  surface("post.create.submit", "接管发帖提交区。", { mode: "client" }),
  surface("post.weibo.feed", "接管微博模式帖子流。", { mode: "client" }),

  surface("prison.page", "接管小黑屋页主体区域。"),
  surface("prison.hero", "接管小黑屋顶部说明区。"),
  surface("prison.content", "接管小黑屋名单区。"),
  surface("prison.sidebar", "接管小黑屋右侧栏。"),

  surface("search.page", "接管搜索页主体区域。"),
  surface("search.hero", "接管搜索顶部搜索区。"),
  surface("search.results", "接管搜索结果区。"),

  surface("settings.page", "接管用户设置页主体区域。", { mode: "hybrid" }),
  surface("settings.content", "接管当前设置分区内容。", { mode: "client" }),
  surface("settings.profile", "接管资料设置分区。"),
  surface("settings.invite", "接管邀请中心分区。"),
  surface("settings.post-management", "接管帖子管理分区。"),
  surface("settings.board-applications", "接管节点申请分区。"),
  surface("settings.level", "接管我的等级分区。"),
  surface("settings.badges", "接管勋章中心分区。"),
  surface("settings.verifications", "接管账号认证分区。"),
  surface("settings.points", "接管积分明细分区。"),
  surface("settings.follows", "接管我的关注分区。"),

  surface("tag.page", "接管单标签页主体区域。"),
  surface("tag.hero", "接管单标签页顶部介绍区。"),
  surface("tag.content", "接管单标签帖子流。"),
  surface("tag.sidebar", "接管单标签右侧栏。"),
  surface("tags.page", "接管标签广场页主体区域。"),
  surface("tags.hero", "接管标签广场顶部介绍区。"),
  surface("tags.content", "接管标签广场内容区。"),
  surface("tags.sidebar", "接管标签广场右侧栏。"),

  surface("terms.page", "接管论坛协议页主体区域。"),
  surface("terms.hero", "接管论坛协议顶部介绍区。"),
  surface("terms.content", "接管论坛协议正文区。"),
  surface("terms.sidebar", "接管论坛协议页右侧栏。"),

  surface("tasks.page", "接管任务中心页面主体区域。"),
  surface("tasks.header", "接管任务中心标题和分类导航区。", { mode: "client" }),
  surface("tasks.content", "接管任务中心任务列表区。", { mode: "client" }),

  surface("topup.page", "接管积分充值页主体区域。"),
  surface("topup.payment", "接管充值方案区。"),
  surface("topup.redeem", "接管兑换码区。"),
  surface("topup.result.page", "接管充值结果页主体区域。"),
  surface("topup.result.panel", "接管充值结果面板。"),

  surface("vip.page", "接管 VIP 页面主体区域。"),
  surface("vip.hero", "接管 VIP 顶部介绍区。"),
  surface("vip.actions", "接管 VIP 购买操作区。"),
  surface("vip.levels", "接管 VIP 等级权益区。"),
  surface("vip.sidebar", "接管 VIP 页面右栏。"),

  surface("leaderboard.page", "接管榜单页主体区域。"),
  surface("leaderboard.hero", "接管榜单页头图区。"),
  surface("leaderboard.content", "接管榜单列表区。"),
  surface("leaderboard.sidebar", "接管榜单页右栏。"),

  surface("user.page", "接管用户主页主体区域。"),
  surface("user.profile", "接管用户主页概览区。"),
  surface("user.activity", "接管用户主页动态区。"),
  surface("user.sidebar", "接管用户主页侧栏。"),

  surface("write.page", "接管发帖页主体区域。"),
  surface("write.header", "接管发帖页标题区。"),

  surface("zone.page", "接管分区页主体区域。"),
  surface("zone.hero", "接管分区信息区。"),
  surface("zone.content", "接管分区帖子流。"),
  surface("zone.sidebar", "接管分区页右栏。"),
] as const satisfies readonly AddonSurfaceCatalogEntry[]

const surfaceCatalogByName = new Map<string, AddonSurfaceCatalogEntry>(
  ADDON_SURFACE_CATALOG.map((entry) => [entry.name, entry]),
)

export function getAddonSurfaceCatalogEntry(
  surface: AddonSurfaceKey,
): AddonSurfaceCatalogEntry | null {
  return surfaceCatalogByName.get(surface) ?? null
}

export function isKnownAddonSurfaceName(surface: string): surface is AddonSurfaceKey {
  return surfaceCatalogByName.has(surface)
}

export function listAddonSurfaceCatalog() {
  return [...ADDON_SURFACE_CATALOG]
}
