import { BUILTIN_CUSTOM_PAGE_ROUTE_PATHS, normalizeCustomPageRoutePath } from "./custom-page-types"

interface BuiltinCustomPageSettings {
  siteName: string
  siteDescription: string
  pointName: string
}

export interface BuiltinCustomPageSeed {
  title: string
  routePath: (typeof BUILTIN_CUSTOM_PAGE_ROUTE_PATHS)[number]
  htmlContent: string
  includeHeader: boolean
  includeFooter: boolean
  includeLeftSidebar: boolean
  includeRightSidebar: boolean
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function buildPageShell(title: string, eyebrow: string, intro: string, body: string) {
  return `
<section style="display:flex;flex-direction:column;gap:20px;">
  <section style="border:1px solid hsl(var(--border));background:hsl(var(--card));border-radius:12px;padding:28px;box-shadow:0 1px 2px hsl(var(--foreground) / 0.04);">
    <p style="margin:0 0 12px;color:hsl(var(--muted-foreground));font-size:13px;font-weight:600;">${eyebrow}</p>
    <h1 style="margin:0;color:hsl(var(--foreground));font-size:32px;line-height:1.25;font-weight:700;">${title}</h1>
    <p style="margin:16px 0 0;max-width:720px;color:hsl(var(--muted-foreground));font-size:15px;line-height:1.9;">${intro}</p>
  </section>
  ${body}
</section>`.trim()
}

function buildInfoCards(items: Array<{ title: string; content: string }>) {
  return `
<section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">
  ${items.map((item) => `
    <article style="border:1px solid hsl(var(--border));background:hsl(var(--card));border-radius:12px;padding:20px;">
      <h2 style="margin:0;color:hsl(var(--foreground));font-size:17px;line-height:1.5;font-weight:700;">${item.title}</h2>
      <p style="margin:10px 0 0;color:hsl(var(--muted-foreground));font-size:14px;line-height:1.9;">${item.content}</p>
    </article>
  `.trim()).join("\n")}
</section>`.trim()
}

function buildPolicySections(items: Array<{ title: string; paragraphs: string[] }>) {
  return `
<section style="display:flex;flex-direction:column;gap:14px;">
  ${items.map((item) => `
    <article style="border:1px solid hsl(var(--border));background:hsl(var(--card));border-radius:12px;padding:22px;">
      <h2 style="margin:0;color:hsl(var(--foreground));font-size:18px;line-height:1.5;font-weight:700;">${item.title}</h2>
      ${item.paragraphs.map((paragraph) => `
        <p style="margin:12px 0 0;color:hsl(var(--muted-foreground));font-size:14px;line-height:1.9;">${paragraph}</p>
      `.trim()).join("\n")}
    </article>
  `.trim()).join("\n")}
</section>`.trim()
}

function buildAboutHtml(settings: BuiltinCustomPageSettings) {
  const siteName = escapeHtml(settings.siteName || "本站")
  const siteDescription = escapeHtml(settings.siteDescription || "一个适合长期讨论与内容沉淀的线上社区")

  return buildPageShell(
    `关于 ${siteName}`,
    "About",
    `${siteName} 是一个围绕长期兴趣、真实经验与克制交流建立的社区。这里不只追求即时热闹，更重视可回访、可沉淀、可继续讨论的内容。`,
    [
      buildInfoCards([
        {
          title: "社区定位",
          content: `${siteDescription}。管理员可以在后台直接修改这段关于页面文案，让它贴合自己的站点气质、规则和运营阶段。`,
        },
        {
          title: "内容氛围",
          content: "我们鼓励具体、友善、有信息量的表达，也尊重不同经验和不同节奏。好的讨论应当帮助后来者更快理解问题，而不是只留下情绪。",
        },
        {
          title: "长期沉淀",
          content: "帖子、评论、收藏、节点和专题页面共同构成社区资料库。随着时间增长，站点会从零散发言变成可查阅、可复用的经验集合。",
        },
      ]),
      `
<section style="border:1px dashed hsl(var(--border));background:hsl(var(--background));border-radius:12px;padding:22px;">
  <h2 style="margin:0;color:hsl(var(--foreground));font-size:18px;line-height:1.5;font-weight:700;">一句话介绍</h2>
  <p style="margin:12px 0 0;color:hsl(var(--muted-foreground));font-size:15px;line-height:1.9;">${siteName}，一个让兴趣被持续实践、整理和交流的地方。</p>
</section>`.trim(),
    ].join("\n"),
  )
}

function buildTermsHtml(settings: BuiltinCustomPageSettings) {
  const siteName = escapeHtml(settings.siteName || "本站")
  const pointName = escapeHtml(settings.pointName || "积分")

  return buildPageShell(
    `${siteName} 论坛使用协议`,
    "Terms of Service",
    `继续访问、注册、登录、发帖、评论、上传、点赞、收藏、举报或使用 ${siteName} 的其他功能，即表示你已阅读并接受当前公开展示的社区规则。`,
    buildPolicySections([
      {
        title: "一、协议适用范围",
        paragraphs: [
          `本协议适用于 ${siteName} 的公开页面、注册账户、站内互动、用户生成内容，以及后续新增但未单独立约的社区功能。`,
          "若站点另有帮助文档、FAQ、节点规则或专题说明，它们与本协议共同构成完整规则。",
        ],
      },
      {
        title: "二、账户注册与使用",
        paragraphs: [
          "用户应保证注册、登录和资料维护过程中提供的信息真实、可归属、可负责，不得冒用他人身份、批量注册、绕过限制或利用漏洞获取不当权益。",
          "账户仅限本人使用。因共享账户、泄露登录状态或个人保管不当导致的损失、封禁或权益异常，由账户实际控制人承担。",
        ],
      },
      {
        title: "三、内容发布与互动规范",
        paragraphs: [
          "用户发布的帖子、评论、图片、附件、投票、悬赏内容和其他资料，应符合法律法规、平台规则和公序良俗。",
          "不得发布违法、侵权、骚扰、侮辱、恶意引战、虚假欺诈、恶意营销或其他破坏社区秩序的内容。",
        ],
      },
      {
        title: "四、审核、下线与管理处置",
        paragraphs: [
          "平台可根据内容安全规则、节点配置、举报结果或人工判断，对帖子、评论、用户资料与其他公开信息进行审核、隐藏、驳回、下线或限制传播。",
          "若账户或内容违反规则，平台可视情况采取提醒、拒绝发布、撤销展示、限制功能、禁言、拉黑、公开进入小黑屋等措施。",
        ],
      },
      {
        title: `五、${pointName}、等级、勋章与会员权益`,
        paragraphs: [
          `${pointName}、等级、勋章与会员权益属于社区成长与权限体系的一部分，具体获取方式、扣减方式、解锁条件与展示效果以后台当前配置和页面说明为准。`,
          "平台可在不违反已明确承诺权益的前提下，对成长规则、价格、奖励、展示方式和可见条件进行调整。",
        ],
      },
      {
        title: "六、协议更新与继续使用",
        paragraphs: [
          "平台可根据社区运营需要更新本协议。更新后的协议一经在站内公开，即对后续使用行为生效。",
          "若用户在协议更新后继续访问、登录、浏览、发帖、评论或使用任何相关功能，视为同意更新后的内容；若不同意，应停止继续使用相关服务。",
        ],
      },
    ]),
  )
}

export function getBuiltinCustomPageSeeds(settings: BuiltinCustomPageSettings): BuiltinCustomPageSeed[] {
  return [
    {
      title: "关于我们",
      routePath: normalizeCustomPageRoutePath("/about") as "/about",
      htmlContent: buildAboutHtml(settings),
      includeHeader: true,
      includeFooter: true,
      includeLeftSidebar: true,
      includeRightSidebar: true,
    },
    {
      title: "论坛协议",
      routePath: normalizeCustomPageRoutePath("/terms") as "/terms",
      htmlContent: buildTermsHtml(settings),
      includeHeader: true,
      includeFooter: true,
      includeLeftSidebar: true,
      includeRightSidebar: true,
    },
  ]
}
