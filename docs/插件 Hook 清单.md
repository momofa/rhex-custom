# 插件 Hook 清单


当前宿主把扩展点分成 5 类：

- `slot`：插入 UI 块
- `surface`：覆盖宿主默认 UI 区块
- `action hook`：在生命周期点执行副作用逻辑
- `waterfall`：串行改写数据；transform 可同步返回，也可返回 Promise
- `asyncWaterfall`：异步串行改写数据

说明：

- `provider` 类能力不在这份 hook 清单里单独枚举；例如 `payment`、`navigation`、`editor`、`upload`、`home-feed` 都属于“由宿主按 kind 消费的 provider 扩展”
- 新增首页 tabs / 首页主内容切换时，应优先看主文档里的 `home-feed provider`，而不是把它误解成 `slot` 或 `surface`
- 内建 `surface` 现在有独立目录：`src/addons-host/surface-catalog.ts`。它会并入 `ADDON_EXTENSION_POINT_CATALOG`，可被后台、文档生成器或插件开发工具统一枚举。

## 通用规则

- 所有扩展点都按 `order` 升序执行
- 同 `order` 下按 `addonId:key` 稳定排序
- `slot` 返回 `AddonRenderResult | null`
- `surface` 返回 `AddonRenderResult | null`
- `surface` 支持 `server` / `client` / `hybrid` 三种执行模式；模式元数据以 `ADDON_SURFACE_CATALOG` 为准
- `action hook` 返回 `void`
- `waterfall / asyncWaterfall` 返回下一个值；返回 `undefined` 时保留上一个值
- hook 执行失败时，宿主默认记录 lifecycle log 并继续后续插件
- `before` action hook 在宿主显式传入 `throwOnError: true` 时可中断主流程
- `surface` 只会选择一个插件生效；命中失败时自动回退宿主默认 UI
- 注册未知 `surface` 不会被阻断，但会进入插件 `warnings`；新插件应优先选择本清单中已声明的内建点位
- 宿主通过 `<AddonSlotRenderer slot="..." props={{ ... }} />` 或 `<AddonSurfaceRenderer surface="..." props={{ ... }} />` 调用时，当前点位上下文会进入 `context.props`
- 同一插件重复注册同一个 `hook + key` 时，只保留第一次注册；重复项会进入插件 `warnings`，不会覆盖已注册处理器

## Action Hook

| Hook | 分类 | 说明 | 返回值 |
| --- | --- | --- | --- |
| `auth.login.before` | auth | 登录成功写入会话前执行副作用或拦截逻辑 | `void` |
| `auth.login.after` | auth | 登录成功后执行副作用逻辑 | `void` |
| `auth.register.before` | auth | 注册写入账户前执行副作用或拦截逻辑 | `void` |
| `auth.register.after` | auth | 注册成功后执行副作用逻辑 | `void` |
| `auth.identity.bind.before` | auth | 第三方身份绑定到现有账户前执行副作用或拦截逻辑 | `void` |
| `auth.identity.bind.after` | auth | 第三方身份绑定完成后执行副作用逻辑 | `void` |
| `auth.identity.unbind.before` | auth | 第三方身份解绑前执行副作用或拦截逻辑 | `void` |
| `auth.identity.unbind.after` | auth | 第三方身份解绑后执行副作用逻辑 | `void` |
| `oauth.client.application.changed` | oauth | OAuth 开发者应用创建、重提、审核、编辑或重置密钥后执行副作用逻辑 | `void` |
| `auth.password.change.before` | auth | 已登录用户修改密码前执行副作用或拦截逻辑 | `void` |
| `auth.password.change.after` | auth | 已登录用户修改密码后执行副作用逻辑 | `void` |
| `auth.password.reset.before` | auth | 通过找回密码流程重置密码前执行副作用或拦截逻辑 | `void` |
| `auth.password.reset.after` | auth | 通过找回密码流程重置密码后执行副作用逻辑 | `void` |
| `post.create.before` | post | 帖子创建前执行副作用或拦截逻辑 | `void` |
| `post.create.after` | post | 帖子创建成功后执行副作用逻辑 | `void` |
| `comment.create.before` | comment | 评论创建前执行副作用或拦截逻辑 | `void` |
| `comment.create.after` | comment | 评论创建成功后执行副作用逻辑 | `void` |
| `message.send.before` | message | 私信发送前执行副作用或拦截逻辑 | `void` |
| `message.send.after` | message | 私信发送成功后执行副作用逻辑 | `void` |
| `report.create.before` | report | 举报创建前执行副作用或拦截逻辑 | `void` |
| `report.create.after` | report | 举报创建成功后执行副作用逻辑（含 report 快照） | `void` |
| `task.complete.after` | task | 任务完成并结算奖励后执行副作用逻辑（含 task / progress 快照与奖励结果） | `void` |
| `check-in.submit.before` | check-in | 签到或补签写入前执行副作用或拦截逻辑 | `void` |
| `check-in.submit.after` | check-in | 签到或补签成功后执行副作用逻辑（含奖励、积分与连续签到结果） | `void` |
| `payment.application.changed` | payment | Payment 开发者应用创建、重提、审核、编辑或重置密钥后执行副作用逻辑 | `void` |
| `payment.transaction.created` | payment | Payment 外部下单创建交易后执行副作用逻辑 | `void` |
| `payment.transaction.completed` | payment | Payment 用户确认支付并完成交易后执行副作用逻辑 | `void` |
| `payment.paid.before` | payment | 支付到账后的宿主处理前执行副作用逻辑 | `void` |
| `payment.paid.after` | payment | 支付到账后执行副作用逻辑 | `void` |
| `invite-code.purchase.before` | invite | 邀请码购买扣点前执行副作用或拦截逻辑 | `void` |
| `invite-code.purchase.after` | invite | 邀请码购买成功后执行副作用逻辑 | `void` |
| `redeem-code.redeem.before` | redeem | 兑换码核销前执行副作用或拦截逻辑 | `void` |
| `redeem-code.redeem.after` | redeem | 兑换码核销成功后执行副作用逻辑 | `void` |
| `user.update.before` | user | 用户资料更新写入前执行副作用或拦截逻辑（payload 为最终待写入资料字段） | `void` |
| `user.update.after` | user | 用户资料更新后执行副作用逻辑（含最新 profile 快照） | `void` |
| `user.notification-settings.update.before` | user | 用户通知设置写入前执行副作用或拦截逻辑 | `void` |
| `user.notification-settings.update.after` | user | 用户通知设置更新后执行副作用逻辑 | `void` |
| `sms.verification-code.send.before` | sms | 短信验证码发送前执行副作用或拦截逻辑 | `void` |
| `sms.verification-code.send.after` | sms | 短信验证码发送后执行副作用逻辑，payload 含 provider / handledByProvider / expiresAt | `void` |
| `sms.verification-code.verify.before` | sms | 短信验证码校验前执行副作用或拦截逻辑 | `void` |
| `sms.verification-code.verify.after` | sms | 短信验证码校验后执行副作用逻辑，payload 含 provider / handledByProvider / verifiedAt | `void` |
| `addon.config.changed.before` | system | 插件配置写入前执行副作用或拦截逻辑 | `void` |
| `addon.config.changed.after` | system | 插件配置变更后执行副作用逻辑 | `void` |
| `auth.logout.before` | auth | 登出清除会话前执行副作用或拦截逻辑 | `void` |
| `auth.logout.after` | auth | 用户登出成功后执行副作用逻辑 | `void` |
| `post.update.before` | post | 帖子更新写入前执行副作用或拦截逻辑 | `void` |
| `post.update.after` | post | 帖子更新成功后执行副作用逻辑（含最新 post 快照） | `void` |
| `post.delete.before` | post | 帖子删除前执行副作用或拦截逻辑 | `void` |
| `post.delete.after` | post | 帖子删除成功后执行副作用逻辑 | `void` |
| `post.status.changed.after` | post | 帖子状态（上架/下架/精华/置顶等）变更后执行副作用 | `void` |
| `post.like.before` | post | 帖子点赞/取消点赞前执行副作用 | `void` |
| `post.like.after` | post | 帖子点赞/取消点赞后执行副作用 | `void` |
| `post.favorite.toggle.before` | post | 帖子收藏/取消收藏前执行副作用 | `void` |
| `post.favorite.toggle.after` | post | 帖子收藏/取消收藏后执行副作用 | `void` |
| `comment.update.before` | comment | 评论更新写入前执行副作用或拦截逻辑 | `void` |
| `comment.update.after` | comment | 评论更新成功后执行副作用逻辑（含最新 comment 快照） | `void` |
| `comment.delete.before` | comment | 评论删除前执行副作用或拦截逻辑 | `void` |
| `comment.delete.after` | comment | 评论删除成功后执行副作用逻辑 | `void` |
| `comment.like.before` | comment | 评论点赞/取消点赞前执行副作用 | `void` |
| `comment.like.after` | comment | 评论点赞/取消点赞后执行副作用 | `void` |
| `user.follow.toggle.before` | user | 关注/取消关注前执行副作用 | `void` |
| `user.follow.toggle.after` | user | 关注/取消关注后执行副作用 | `void` |
| `notification.create.before` | notification | 站内通知写入前执行副作用或拦截逻辑 | `void` |
| `notification.create.after` | notification | 通知写入成功后执行副作用逻辑（含 notification 快照） | `void` |
| `points.change.after` | points | 用户积分变更（获得/扣除）后执行副作用 | `void` |
| `upload.file.before` | upload | 文件上传前执行副作用或拦截逻辑（可用于类型/大小/黑名单预检） | `void` |
| `upload.file.after` | upload | 文件上传完成后执行副作用逻辑（payload 含 fileId/url） | `void` |
| `addon.installed.before` | system | 插件安装、升级或覆盖写入前执行副作用或拦截逻辑 | `void` |
| `addon.installed.after` | system | 插件安装完成后执行副作用逻辑 | `void` |
| `addon.uninstalled.before` | system | 插件物理卸载前执行副作用或拦截逻辑 | `void` |
| `addon.uninstalled.after` | system | 插件卸载完成后执行副作用逻辑 | `void` |
| `addon.enabled.before` | system | 插件启用前执行副作用或拦截逻辑 | `void` |
| `addon.enabled.after` | system | 插件启用后执行副作用逻辑 | `void` |
| `addon.disabled.before` | system | 插件禁用前执行副作用或拦截逻辑 | `void` |
| `addon.disabled.after` | system | 插件禁用后执行副作用逻辑 | `void` |
| `addon.api.request.before` | addon | 插件 API 命中后、处理器执行前触发；可用于审计预检或阻断 | `void` |
| `addon.api.request.after` | addon | 插件 API 请求结束后触发，payload 含 status / matched / errorMessage | `void` |
| `search.query.after` | search | 搜索请求完成后执行副作用（埋点、热词统计等） | `void` |

补充说明：

- `message.send.before` / `message.send.after` 的 payload 当前都会携带 `conversationKind`（`DIRECT` / `SITE_CHAT`）；其中 `after` 的 `contentAdjusted` 会同时反映插件文本改写和宿主敏感词替换。
- `report.create.after` 的 payload 当前会携带结构化 `report` 快照；`contentAdjusted` 会同时反映 `report.reasonDetail.value` 改写和宿主敏感词替换。
- `user.update.after` 的 payload 当前会携带结构化 `profile` 快照；`contentAdjusted` 会同时反映资料字段的插件改写和宿主敏感词替换。
- `sms.verification-code.send.before` / `verify.before` 会以 `throwOnError: true` 执行，可用于短信验证码发送或校验前的风控阻断；payload 含 `phone`、`purpose`、`requestIp`、`userAgent`、`userId`。
- `sms.verification-code.send.after` / `verify.after` 可用于审计第三方短信服务结果；payload 里的 `handledByProvider` 表示验证码生成/校验是否被 `sms provider` 完整接管。
- `task.complete.after` 只会在本轮任务首次完成并完成奖励结算后触发；重复事件、重复点赞、已完成任务不会再次派发。
- `check-in.submit.before` 会以 `throwOnError: true` 执行，可阻断普通签到或补签；payload 含 `userId/username/action/date/reward/pointName`，补签额外含 `makeUpCost`。
- `check-in.submit.after` 只在签到动作成功返回前触发；payload 含 `finalReward/points/currentStreak/maxStreak/alreadyCheckedIn`，其中 `alreadyCheckedIn` 可用于识别普通签到重复提交。
- `oauth.client.application.changed` 和 `payment.application.changed` 不会暴露 `client_secret` 或 Payment `Secret Key`；payload 只包含应用 ID、公开标识、ownerId、状态变化和审核动作。
- `payment.transaction.created` / `payment.transaction.completed` 只覆盖开发者 Payment 外部订单；支付网关充值仍使用 `payment.paid.before` / `payment.paid.after`。
- `payment.transaction.*` payload 包含 `amount`、`platformFee`、`externalReference`、`transactionId` 和应用公开标识，不包含商户入账字段。

## Waterfall

| Hook | 分类 | 说明 | 返回值 |
| --- | --- | --- | --- |
| `post.slug.value` | post | 串行改写帖子最终 slug | `string` |
| `post.title.value` | post | 串行改写帖子标题（落库前；可用于敏感词替换、自动加标记等） | `string` |
| `post.content.value` | post | 串行改写帖子正文（写入前；创建、编辑、追加内容都可接入） | `string` |
| `comment.content.value` | comment | 串行改写评论内容（写入前；可用于签名补全、文本规范化等） | `string` |
| `message.body.value` | message | 串行改写私信内容（发送前；可用于模板展开、文本规范化等） | `string` |
| `report.reasonDetail.value` | report | 串行改写举报补充说明（写入前；可用于模板展开、文本规范化等） | `string` |
| `user.profile.nickname.value` | user | 串行改写用户昵称（资料写入前；后续仍会做敏感词与重名校验） | `string` |
| `user.profile.bio.value` | user | 串行改写用户简介（资料写入前；可返回空串清空） | `string` |
| `user.profile.introduction.value` | user | 串行改写用户个人介绍（资料写入前；可返回空串清空） | `string` |
| `user.displayName.value` | user | 串行改写用户展示名（用于列表/详情渲染前的显示加工） | `string` |
| `user.avatar.url.value` | user | 串行改写用户头像 URL（可插入 CDN 前缀、占位头像等） | `string` |
| `user.publicUid.value` | user | 串行改写用户公开 UID 展示值；只影响前台展示，不改变真实 `User.id` | `string` |
| `user.levelBadge.value` | user | 串行改写用户公开等级徽章展示快照；只影响前台展示，不改变真实等级 | `AddonPublicUserLevelBadge \| null` |
| `user.verificationBadge.value` | user | 串行改写用户公开认证徽章展示快照；只影响前台展示，不改变真实认证记录 | `AddonPublicUserVerificationBadge \| null` |
| `user.displayedBadges.items` | user | 串行改写用户公开展示勋章 / 称号列表；只影响前台展示，不改变真实勋章授予 | `AddonPublicUserDisplayedBadge[]` |
| `user.roleBadge.value` | user | 串行改写用户公开角色徽标展示快照；只影响前台展示，不改变真实权限角色 | `AddonPublicUserRoleBadge \| null` |
| `user.identityTags.items` | user | 串行改写用户公开身份标签列表；只影响前台展示 | `AddonPublicUserIdentityTag[]` |
| `search.query.normalize` | search | 串行规范化搜索关键词（大小写、同义词、繁简转换等） | `string` |
| `seo.meta.title` | seo | 串行改写 SEO `<title>` | `string` |
| `seo.meta.description` | seo | 串行改写 SEO meta description | `string` |
| `breadcrumb.items` | navigation | 串行改写当前页面面包屑条目数组 | `AddonBreadcrumbItem[]` |

补充说明：

- `post.content.value` 当前会在帖子创建、普通编辑和超时后追加内容三条链路执行；它只改写公开正文 / 追加正文，不会自动改写登录解锁、回复解锁、购买解锁等附加文本。
- `message.body.value` 会在宿主敏感词处理和 `message.send.before` action hook 之前执行；其 `payload` 当前包含 `recipientId?`、`conversationId?` 与 `conversationKind`（`DIRECT` / `SITE_CHAT`）。
- `report.reasonDetail.value` 即使初始补充说明为空也会执行；插件可以基于 `reasonType`、`targetType` 自动补全模板化说明。
- `user.profile.bio.value` 与 `user.profile.introduction.value` 允许返回空串，宿主会按“显式清空”处理，不会自动回退到旧值。
- `user.profile.nickname.value` 仍沿用非空保护；插件若返回空串，宿主会保留原始昵称继续后续校验。
- `user.publicUid.value` 是公开展示层 hook，默认值为格式化后的真实用户 ID；插件返回值会被宿主裁剪到 32 个字符以内并折叠空白。
- `user.levelBadge.value`、`user.verificationBadge.value`、`user.displayedBadges.items`、`user.roleBadge.value`、`user.identityTags.items` 与 `user.publicUid.value` 同属公开身份展示管线；payload 当前包含 `userId`、`username`、`role`、`status`、`level`、`vipLevel`、`badges`。插件可用这些字段做展示规则，但返回值不会影响权限、外键、链接、订单、积分、消息、关注、后台审计、真实等级、真实认证、真实勋章授予、真实角色或封禁/禁言状态。
- `user.roleBadge.value` 返回 `undefined` 表示保留上一个值，返回 `null` 表示显式隐藏公开角色徽标，返回对象表示使用插件给出的公开角色徽标快照。

## AsyncWaterfall

| Hook | 分类 | 说明 | 返回值 |
| --- | --- | --- | --- |
| `navigation.primary.items` | navigation | 串行改写站点主导航项数组 | `NavigationItem[]` |
| `home.sidebar.hot-topics.items` | home | 串行改写首页右栏热点帖子列表 | `HomeSidebarHotTopic[]` |
| `settings.post-management.tabs` | settings | 串行扩展用户设置页“帖子管理”的插件 tab 列表 | `AddonSettingsPostManagementTab[]` |
| `feed.posts.items` | post | 串行改写原始帖子流（首页 / 分类 / 搜索结果列表），可插入广告位、置顶项、重排序；payload 含 `displayMode` | `AddonPostRecord[]` |
| `post-list.display.items` | post | 串行改写帖子列表展示项（映射后，包含微博模式预览媒体 / HTML / 统计等），可微调卡片数据或插入轻量展示项 | `PostListDisplayItem[]` |
| `search.results.rerank` | search | 串行对搜索结果重排序（含 query / scope 上下文） | `AddonSearchResultItem[]` |
| `notification.dispatch.targets` | notification | 串行改写单条通知的分发目标（站内 / 邮件 / 其他通道） | `AddonNotificationDispatchTarget[]` |
| `sitemap.entries` | seo | 串行扩展 sitemap.xml 条目列表 | `AddonSitemapEntry[]` |
| `post.related.items` | post | 串行改写帖子详情页相关推荐列表 | `AddonPostRecord[]` |
| `post.content.render` | post | 串行改写帖子正文渲染后的 HTML（代码高亮、LaTeX、Mermaid、表格美化等） | `string` |
| `points.settlement.resolve` | points | 积分结算写入 `User.points` 前执行，可在当前事务内接管本次结算并返回 `handled: true` | `AddonPointSettlementValue` |
| `post.tip.summary` | points | 串行改写帖子 / 评论打赏摘要展示，可调整余额、货币名和可用状态 | `AddonTipSummaryValue` |
| `user.profile.introduction.permission` | user | 串行收紧个人介绍编辑 / 查看权限，可按用户组、VIP、认证、勋章等返回 `allowed: false` | `AddonUserProfileIntroductionPermissionValue` |

补充说明：

- `points.settlement.resolve` 的 `value` 包含 `userId/beforeBalance/baseDelta/finalDelta/scopeKey/pointName/reason/eventType/eventData/relatedType/relatedId/insufficientMessage`。插件返回 `handled: true` 后，宿主跳过默认 `User.points` 写入和默认 `PointLog`。
- `points.settlement.resolve` 在宿主积分事务内执行，插件侧 `context.database` 会复用当前 transaction client；插件自表写入抛错时会回滚宿主业务事务。
- `post.tip.summary` 只影响打赏 UI 摘要展示，不负责真实扣款；真实结算仍应通过 `points.settlement.resolve` 接管。
- `user.profile.introduction.permission` 的 `value` 为 `{ allowed, reason }`，`payload` 含 `action`（`edit` / `view`）、`owner`、`viewer`、`isOwner`。插件返回 `allowed: false` 会隐藏设置中心修改入口、阻断资料保存接口或隐藏用户主页介绍内容；该 hook 只能收紧权限，不能绕过后台个人介绍总开关或用户个人公开范围。

## Surface

命名规则：

- 如果宿主同时开放了 `xxx.before` 和 `xxx.after` 两个 slot，中间那块默认 UI 通常会同步开放一个 `xxx` surface
- 例如 `search.hero.before` / `search.hero.after` 对应 `search.hero`
- 例如 `topup.payment.before` / `topup.payment.after` 对应 `topup.payment`
- 例如 `messages.thread.before` / `messages.thread.after` 对应 `messages.thread`
- 例如 `post.create.tools.before` / `post.create.tools.after` 对应 `post.create.tools`
- 例如 `post.author.name.before` / `post.author.name.after` 对应 `post.author.name`
- 例如 `post.author.badges.before` / `post.author.badges.after` 对应 `post.author.badges`

当前已接入的一批常用 surface 包括：

- 页面主体类：`addon.page`、`about.page`、`announcements.page`、`auth.complete.page`、`auth.forgot-password.page`、`auth.login.page`、`auth.passkey.page`、`auth.register.page`、`badge.page`、`board.page`、`collections.page`、`custom-page.page`、`feed.page`、`friend-links.page`、`funs.page`、`funs.app.page`、`help.page`、`history.page`、`leaderboard.page`、`notifications.page`、`prison.page`、`search.page`、`settings.page`、`tag.page`、`tags.page`、`tasks.page`、`terms.page`、`topup.page`、`topup.result.page`、`user.page`、`vip.page`、`write.page`、`zone.page`
- 头部 / Hero 类：`addon.page.header`、`about.hero`、`announcement.hero`、`announcements.hero`、`auth.complete.panel`、`auth.forgot-password.panel`、`auth.login.panel`、`auth.passkey.panel`、`auth.register.panel`、`badge.hero`、`board.hero`、`collections.hero`、`friend-links.hero`、`leaderboard.hero`、`search.hero`、`tasks.header`、`terms.hero`、`vip.hero`、`write.header`、`zone.hero`
- 帖子作者类：`post.header`、`post.author.row`、`post.author.meta`、`post.author.verification`、`post.author.name`、`post.author.badges`
- 评论作者类：`comment.author.row`、`comment.author.meta`、`comment.author.verification`、`comment.author.name`、`comment.author.badges`
- 内容 / 列表类：`addon.page.content`、`about.highlights`、`about.principles`、`announcement.content`、`announcements.content`、`auth.login.form`、`auth.register.form`、`board.content`、`custom-page.content`、`faq.content`、`feed.main`、`friend-links.content`、`funs.app.content`、`leaderboard.content`、`notifications.list`、`post.body`、`post.create.form`、`post.create.tools`、`post.create.editor`、`post.create.enhancements`、`post.create.submit`、`post.weibo.feed`、`prison.content`、`search.results`、`settings.content`、`settings.profile`、`settings.invite`、`settings.post-management`、`settings.board-applications`、`settings.level`、`settings.badges`、`settings.verifications`、`settings.points`、`settings.follows`、`tag.content`、`tasks.content`、`terms.content`、`topup.payment`、`topup.redeem`、`topup.result.panel`、`user.activity`、`user.profile`、`vip.actions`、`vip.levels`、`zone.content`
- 侧栏 / 辅助区块类：`about.sidebar`、`badge.sidebar`、`board.sidebar`、`collections.sidebar`、`custom-page.sidebar`、`funs.sidebar`、`help.sidebar`、`leaderboard.sidebar`、`prison.sidebar`、`tag.sidebar`、`tags.sidebar`、`terms.sidebar`、`user.sidebar`、`zone.sidebar`
- 交互区块类：`layout.header`、`layout.footer`、`messages.page`、`messages.header`、`messages.sidebar`、`messages.thread`、`collection.hero`、`collection.pending`、`collection.content`、`history.panel`

完整内建清单以 `ADDON_SURFACE_CATALOG` 为准。除上面常用分组外，当前还声明了 `custom-page.*`、`zone.*`、`feed.*`、`collection.page/sidebar` 等页面点位。

说明：

- 服务端静态区块一般通过 `render(context)` 接管
- `messages.page`、`settings.page` 属于 hybrid surface：先尝试服务端 `render(context)`，未命中再回退到 `clientModule`
- `messages.header`、`messages.sidebar`、`messages.thread`、`collection.hero`、`collection.pending`、`collection.content`、`history.panel`、`settings.content`、`tasks.header`、`tasks.content`、`post.weibo.feed`、`post.create.form`、`post.create.tools`、`post.create.editor`、`post.create.enhancements`、`post.create.submit`、`comment.author.row`、`comment.author.meta`、`comment.author.verification`、`comment.author.name`、`comment.author.badges` 属于 client-only surface：只支持 `clientModule`
- `post.weibo.feed` 的 `context.props` 包含 `items`、`source`（`feed` / `post-stream`）、`showBoard`、`showPinBadge`、`postLinkDisplayMode`，在节点 / 分区帖子流里还会包含 `sortLinks`
- 如果某个只有单边 slot、纯插入位、或宿主没有默认内容的点位，通常不会对应 surface

## Slot

### 认证

| Slot | 说明 |
| --- | --- |
| `auth.login.captcha` | 在登录表单验证码区域插入 UI |
| `auth.login.page.before` | 在登录页主体前插入 UI |
| `auth.login.page.after` | 在登录页主体后插入 UI |
| `auth.login.panel.before` | 在登录面板前插入 UI |
| `auth.login.panel.after` | 在登录面板后插入 UI |
| `auth.login.form.before` | 在登录表单字段前插入 UI |
| `auth.login.form.after` | 在登录表单字段后插入 UI |
| `auth.register.captcha` | 在注册表单验证码区域插入 UI |
| `auth.register.page.before` | 在注册页主体前插入 UI |
| `auth.register.page.after` | 在注册页主体后插入 UI |
| `auth.register.panel.before` | 在注册面板前插入 UI |
| `auth.register.panel.after` | 在注册面板后插入 UI |
| `auth.register.form.before` | 在注册表单字段前插入 UI |
| `auth.register.form.after` | 在注册表单字段后插入 UI |
| `post.create.captcha` | 在发帖页验证码区域插入 UI |

### 插件页

| Slot | 说明 |
| --- | --- |
| `addon.page.before` | 在插件前台页标题区和内容区之前插入 UI；props 含 `scope/addonId/addonName/pageKey/routePath/routeSegments` |
| `addon.page.after` | 在插件前台页内容区之后插入 UI；props 同上 |
| `addon.page.header.before` | 在插件前台页默认标题区开头插入 UI；仅默认 heading 启用时渲染 |
| `addon.page.header.after` | 在插件前台页默认标题区末尾插入 UI；仅默认 heading 启用时渲染 |
| `addon.page.content.before` | 在插件前台页 `AddonRenderBlock` 之前插入 UI |
| `addon.page.content.after` | 在插件前台页 `AddonRenderBlock` 之后插入 UI |

### 全局布局

| Slot | 说明 |
| --- | --- |
| `layout.head.before` | 在全站 head 前段插入资源或标记 |
| `layout.head.after` | 在全站 head 尾段插入资源或标记 |
| `layout.header.before` | 在站点头部主体前插入内容 |
| `layout.header.after` | 在站点头部主体后插入内容 |
| `layout.header.left` | 在站点头部左侧插入内容 |
| `layout.header.center` | 在站点头部中部插入内容 |
| `layout.header.right` | 在站点头部右侧插入内容 |
| `layout.footer.before` | 在全站页脚主体前插入内容 |
| `layout.footer.after` | 在全站页脚主体后插入内容 |
| `layout.body.start` | 在 body 起始处插入内容 |
| `layout.body.end` | 在 body 结束前插入内容 |
| `layout.sidebar.left.top` | 在左侧边栏顶部插入内容 |
| `layout.sidebar.left.bottom` | 在左侧边栏底部插入内容 |
| `layout.sidebar.right.top` | 在右侧边栏顶部插入内容 |
| `layout.sidebar.right.middle` | 在右侧边栏中部插入内容 |
| `layout.sidebar.right.bottom` | 在右侧边栏底部插入内容 |

### 首页 / 节点 / 帖子

| Slot | 说明 |
| --- | --- |
| `home.right.top` | 在首页右栏顶部插入内容 |
| `home.right.middle` | 在首页右栏中部插入内容 |
| `home.right.bottom` | 在首页右栏底部插入内容 |
| `board.right.top` | 在节点页右栏顶部插入内容；props 含 `boardSlug/boardName` |
| `board.right.middle` | 在节点页右栏中部插入内容；props 含 `boardSlug/boardName` |
| `board.right.bottom` | 在节点页右栏底部插入内容；props 含 `boardSlug/boardName` |
| `post.header.before` | 在帖子详情头部信息区前插入内容 |
| `post.header.after` | 在帖子详情头部信息区后插入内容 |
| `post.author.row.before` | 在帖子作者行前插入内容 |
| `post.author.row.after` | 在帖子作者行后插入内容 |
| `post.author.meta.before` | 在帖子作者元信息区前插入内容 |
| `post.author.meta.after` | 在帖子作者元信息区后插入内容 |
| `post.author.verification.before` | 在帖子作者认证标识前插入内容 |
| `post.author.verification.after` | 在帖子作者认证标识后插入内容 |
| `post.author.name.before` | 在帖子作者用户名区域前插入内容 |
| `post.author.name.after` | 在帖子作者用户名区域后插入内容 |
| `post.author.badges.before` | 在帖子作者勋章区域前插入内容 |
| `post.author.badges.after` | 在帖子作者勋章区域后插入内容 |
| `post.body.before` | 在帖子正文前插入内容 |
| `post.body.after` | 在帖子正文后插入内容 |
| `post.sidebar.top` | 在帖子右栏顶部插入内容 |
| `post.sidebar.bottom` | 在帖子右栏底部插入内容 |
| `comment.item.after` | 在单条评论内容后插入内容 |

### 用户设置

| Slot | 说明 |
| --- | --- |
| `settings.page.before` | 在用户设置页主体前插入内容 |
| `settings.page.after` | 在用户设置页主体后插入内容 |
| `settings.sidebar.top` | 在用户设置页侧栏顶部插入内容 |
| `settings.sidebar.bottom` | 在用户设置页侧栏底部插入内容 |
| `settings.content.before` | 在当前设置分区内容前插入内容 |
| `settings.content.after` | 在当前设置分区内容后插入内容 |
| `settings.profile.before` | 在资料设置分区前插入内容 |
| `settings.profile.after` | 在资料设置分区后插入内容 |
| `settings.invite.before` | 在邀请中心分区前插入内容 |
| `settings.invite.after` | 在邀请中心分区后插入内容 |
| `settings.post-management.before` | 在帖子管理分区前插入内容 |
| `settings.post-management.after` | 在帖子管理分区后插入内容 |
| `settings.board-applications.before` | 在节点申请分区前插入内容 |
| `settings.board-applications.after` | 在节点申请分区后插入内容 |
| `settings.level.before` | 在我的等级分区前插入内容 |
| `settings.level.after` | 在我的等级分区后插入内容 |
| `settings.badges.before` | 在勋章中心分区前插入内容 |
| `settings.badges.after` | 在勋章中心分区后插入内容 |
| `settings.verifications.before` | 在账号认证分区前插入内容 |
| `settings.verifications.after` | 在账号认证分区后插入内容 |
| `settings.points.before` | 在积分明细分区前插入内容 |
| `settings.points.after` | 在积分明细分区后插入内容 |
| `settings.follows.before` | 在我的关注分区前插入内容 |
| `settings.follows.after` | 在我的关注分区后插入内容 |

### 任务 / 榜单

| Slot | 说明 |
| --- | --- |
| `tasks.page.before` | 在任务中心页面主体前插入内容；props 含 `userId/pointName/todayCompleted/challengeCompleted/totalCompleted/totalTasks` |
| `tasks.page.after` | 在任务中心页面主体后插入内容；props 同上 |
| `tasks.header.before` | 在任务中心标题区前插入内容；props 同上 |
| `tasks.header.after` | 在任务中心标题区后插入内容；props 同上 |
| `tasks.content.before` | 在任务列表内容前插入内容；props 同上 |
| `tasks.content.after` | 在任务列表内容后插入内容；props 同上 |
| `leaderboard.page.before` | 在榜单页主体前插入内容；props 含 `title/totalUsers/entryCount/currentUserRank/activeTabHref` |
| `leaderboard.page.after` | 在榜单页主体后插入内容；props 同上 |
| `leaderboard.hero.before` | 在榜单页头图区前插入内容；props 同上 |
| `leaderboard.hero.after` | 在榜单页头图区后插入内容；props 同上 |
| `leaderboard.content.before` | 在榜单列表前插入内容；props 同上 |
| `leaderboard.content.after` | 在榜单列表后插入内容；props 同上 |
| `leaderboard.sidebar.before` | 在榜单页右栏前插入内容；props 同上 |
| `leaderboard.sidebar.after` | 在榜单页右栏后插入内容；props 同上 |

### 积分 / VIP

| Slot | 说明 |
| --- | --- |
| `topup.page.before` | 在积分充值页主体前插入内容 |
| `topup.page.after` | 在积分充值页主体后插入内容 |
| `topup.payment.before` | 在充值方案区前插入内容 |
| `topup.payment.after` | 在充值方案区后插入内容 |
| `topup.redeem.before` | 在兑换码区前插入内容 |
| `topup.redeem.after` | 在兑换码区后插入内容 |
| `vip.page.before` | 在 VIP 页主体前插入内容 |
| `vip.page.after` | 在 VIP 页主体后插入内容 |
| `vip.hero.before` | 在 VIP 顶部介绍区前插入内容 |
| `vip.hero.after` | 在 VIP 顶部介绍区后插入内容 |
| `vip.actions.before` | 在 VIP 购买操作区前插入内容 |
| `vip.actions.after` | 在 VIP 购买操作区后插入内容 |
| `vip.levels.before` | 在 VIP 等级权益区前插入内容 |
| `vip.levels.after` | 在 VIP 等级权益区后插入内容 |

### 帮助 / 关于

| Slot | 说明 |
| --- | --- |
| `help.page.before` | 在帮助页主体前插入内容 |
| `help.page.after` | 在帮助页主体后插入内容 |
| `help.sidebar.before` | 在帮助页右侧栏前插入内容 |
| `help.sidebar.after` | 在帮助页右侧栏后插入内容 |
| `help.document.before` | 在帮助文档区前插入内容 |
| `help.document.after` | 在帮助文档区后插入内容 |
| `about.page.before` | 在关于页主体前插入内容 |
| `about.page.after` | 在关于页主体后插入内容 |
| `about.hero.before` | 在关于页顶部介绍区前插入内容 |
| `about.hero.after` | 在关于页顶部介绍区后插入内容 |
| `about.highlights.before` | 在关于页亮点说明区前插入内容 |
| `about.highlights.after` | 在关于页亮点说明区后插入内容 |
| `about.principles.before` | 在关于页社区原则区前插入内容 |
| `about.principles.after` | 在关于页社区原则区后插入内容 |
| `about.sidebar.before` | 在关于页右侧栏前插入内容 |
| `about.sidebar.after` | 在关于页右侧栏后插入内容 |

### 发帖页 / 功能区

| Slot | 说明 |
| --- | --- |
| `write.page.before` | 在发帖页主体前插入内容 |
| `write.page.after` | 在发帖页主体后插入内容 |
| `write.header.before` | 在发帖页标题区前插入内容 |
| `write.header.after` | 在发帖页标题区后插入内容 |
| `post.create.form.before` | 在发帖表单整体前插入内容 |
| `post.create.form.after` | 在发帖表单整体后插入内容 |
| `post.create.tools.before` | 在发帖基础设置区前插入内容 |
| `post.create.tools.after` | 在发帖基础设置区后插入内容 |
| `post.create.editor.before` | 在发帖正文编辑器前插入内容 |
| `post.create.editor.after` | 在发帖正文编辑器后插入内容 |
| `post.create.enhancements.before` | 在发帖增强功能区前插入内容 |
| `post.create.enhancements.after` | 在发帖增强功能区后插入内容 |
| `post.create.submit.before` | 在发帖提交区前插入内容 |
| `post.create.submit.after` | 在发帖提交区后插入内容 |

### FAQ / 通知 / 私信 / 搜索

| Slot | 说明 |
| --- | --- |
| `faq.page.before` | 在 FAQ 页面主体前插入内容 |
| `faq.page.after` | 在 FAQ 页面主体后插入内容 |
| `faq.tabs.before` | 在 FAQ 顶部专题导航前插入内容 |
| `faq.tabs.after` | 在 FAQ 顶部专题导航后插入内容 |
| `faq.content.before` | 在 FAQ 正文区前插入内容 |
| `faq.content.after` | 在 FAQ 正文区后插入内容 |
| `notifications.page.before` | 在通知页主体前插入内容 |
| `notifications.page.after` | 在通知页主体后插入内容 |
| `notifications.toolbar.before` | 在通知工具区前插入内容 |
| `notifications.toolbar.after` | 在通知工具区后插入内容 |
| `notifications.list.before` | 在通知列表前插入内容 |
| `notifications.list.after` | 在通知列表后插入内容 |
| `messages.page.before` | 在私信页主体前插入内容 |
| `messages.page.after` | 在私信页主体后插入内容 |
| `messages.header.before` | 在私信标题区前插入内容 |
| `messages.header.after` | 在私信标题区后插入内容 |
| `messages.sidebar.before` | 在私信会话侧栏前插入内容 |
| `messages.sidebar.after` | 在私信会话侧栏后插入内容 |
| `messages.thread.before` | 在私信会话正文前插入内容 |
| `messages.thread.after` | 在私信会话正文后插入内容 |
| `search.page.before` | 在搜索页主体前插入内容 |
| `search.page.after` | 在搜索页主体后插入内容 |
| `search.hero.before` | 在搜索顶部搜索区前插入内容 |
| `search.hero.after` | 在搜索顶部搜索区后插入内容 |
| `search.results.before` | 在搜索结果区前插入内容 |
| `search.results.after` | 在搜索结果区后插入内容 |

### 标签 / 用户主页

| Slot | 说明 |
| --- | --- |
| `tags.page.before` | 在标签广场页主体前插入内容 |
| `tags.page.after` | 在标签广场页主体后插入内容 |
| `tags.hero.before` | 在标签广场顶部介绍区前插入内容 |
| `tags.hero.after` | 在标签广场顶部介绍区后插入内容 |
| `tags.content.before` | 在标签广场内容区前插入内容 |
| `tags.content.after` | 在标签广场内容区后插入内容 |
| `tags.sidebar.before` | 在标签广场右侧栏前插入内容 |
| `tags.sidebar.after` | 在标签广场右侧栏后插入内容 |
| `tag.page.before` | 在单标签页主体前插入内容 |
| `tag.page.after` | 在单标签页主体后插入内容 |
| `tag.hero.before` | 在单标签页顶部介绍区前插入内容 |
| `tag.hero.after` | 在单标签页顶部介绍区后插入内容 |
| `tag.content.before` | 在单标签帖子流前插入内容 |
| `tag.content.after` | 在单标签帖子流后插入内容 |
| `tag.sidebar.before` | 在单标签右侧栏前插入内容 |
| `tag.sidebar.after` | 在单标签右侧栏后插入内容 |
| `user.page.before` | 在用户主页主体前插入内容 |
| `user.page.after` | 在用户主页主体后插入内容 |
| `user.sidebar.before` | 在用户主页左侧资料栏前插入内容 |
| `user.sidebar.after` | 在用户主页左侧资料栏后插入内容 |
| `user.profile.before` | 在用户主页概览区前插入内容 |
| `user.profile.after` | 在用户主页概览区后插入内容 |
| `user.activity.before` | 在用户主页动态区前插入内容 |
| `user.activity.after` | 在用户主页动态区后插入内容 |

### 内容流 / 节点 / 合集

| Slot | 说明 |
| --- | --- |
| `feed.page.before` | 在首页内容流主体前插入内容 |
| `feed.page.after` | 在首页内容流主体后插入内容 |
| `feed.main.before` | 在首页内容流列表前插入内容 |
| `feed.main.after` | 在首页内容流列表后插入内容 |
| `feed.sidebar.before` | 在首页右侧栏前插入内容 |
| `feed.sidebar.after` | 在首页右侧栏后插入内容 |
| `feed.latest.before` | 在首页 / 最新流专属区前插入内容 |
| `feed.latest.after` | 在首页 / 最新流专属区后插入内容 |
| `feed.new.before` | 在新贴流专属区前插入内容 |
| `feed.new.after` | 在新贴流专属区后插入内容 |
| `feed.hot.before` | 在热门流专属区前插入内容 |
| `feed.hot.after` | 在热门流专属区后插入内容 |
| `feed.following.before` | 在关注流专属区前插入内容 |
| `feed.following.after` | 在关注流专属区后插入内容 |
| `feed.universe.before` | 在宇宙流专属区前插入内容 |
| `feed.universe.after` | 在宇宙流专属区后插入内容 |
| `zone.page.before` | 在分区页主体前插入内容；props 含 `zoneId/zoneSlug/zoneName/boardCount/postCount/currentSort/currentPage/totalPages/totalPosts/canView` |
| `zone.page.after` | 在分区页主体后插入内容；props 同上 |
| `zone.hero.before` | 在分区信息区前插入内容；props 同上 |
| `zone.hero.after` | 在分区信息区后插入内容；props 同上 |
| `zone.content.before` | 在分区帖子流前插入内容；props 同上 |
| `zone.content.after` | 在分区帖子流后插入内容；props 同上 |
| `zone.sidebar.before` | 在分区页右栏前插入内容；props 同上 |
| `zone.sidebar.after` | 在分区页右栏后插入内容；props 同上 |
| `board.page.before` | 在节点页主体前插入内容 |
| `board.page.after` | 在节点页主体后插入内容 |
| `board.hero.before` | 在节点顶部介绍卡前插入内容 |
| `board.hero.after` | 在节点顶部介绍卡后插入内容 |
| `board.content.before` | 在节点帖子流前插入内容 |
| `board.content.after` | 在节点帖子流后插入内容 |
| `board.sidebar.before` | 在节点右侧栏前插入内容 |
| `board.sidebar.after` | 在节点右侧栏后插入内容 |
| `collections.page.before` | 在合集广场页主体前插入内容 |
| `collections.page.after` | 在合集广场页主体后插入内容 |
| `collections.hero.before` | 在合集广场顶部介绍区前插入内容 |
| `collections.hero.after` | 在合集广场顶部介绍区后插入内容 |
| `collections.content.before` | 在合集广场内容区前插入内容 |
| `collections.content.after` | 在合集广场内容区后插入内容 |
| `collections.sidebar.before` | 在合集广场右侧栏前插入内容 |
| `collections.sidebar.after` | 在合集广场右侧栏后插入内容 |
| `collection.page.before` | 在单合集页主体前插入内容 |
| `collection.page.after` | 在单合集页主体后插入内容 |
| `collection.hero.before` | 在单合集头部信息区前插入内容 |
| `collection.hero.after` | 在单合集头部信息区后插入内容 |
| `collection.pending.before` | 在单合集待审核区前插入内容 |
| `collection.pending.after` | 在单合集待审核区后插入内容 |
| `collection.content.before` | 在单合集已收录帖子区前插入内容 |
| `collection.content.after` | 在单合集已收录帖子区后插入内容 |
| `collection.sidebar.before` | 在单合集页右侧栏前插入内容 |
| `collection.sidebar.after` | 在单合集页右侧栏后插入内容 |

### 公告 / 足迹 / 友情链接 / 节点目录 / 勋章详情

| Slot | 说明 |
| --- | --- |
| `announcements.page.before` | 在公告列表页主体前插入内容 |
| `announcements.page.after` | 在公告列表页主体后插入内容 |
| `announcements.hero.before` | 在公告列表顶部说明区前插入内容 |
| `announcements.hero.after` | 在公告列表顶部说明区后插入内容 |
| `announcements.content.before` | 在公告列表区前插入内容 |
| `announcements.content.after` | 在公告列表区后插入内容 |
| `announcement.page.before` | 在单公告页主体前插入内容 |
| `announcement.page.after` | 在单公告页主体后插入内容 |
| `announcement.hero.before` | 在单公告头部信息区前插入内容 |
| `announcement.hero.after` | 在单公告头部信息区后插入内容 |
| `announcement.content.before` | 在单公告正文区前插入内容 |
| `announcement.content.after` | 在单公告正文区后插入内容 |
| `history.page.before` | 在足迹页主体前插入内容 |
| `history.page.after` | 在足迹页主体后插入内容 |
| `history.panel.before` | 在足迹面板前插入内容 |
| `history.panel.after` | 在足迹面板后插入内容 |
| `friend-links.page.before` | 在友情链接页主体前插入内容 |
| `friend-links.page.after` | 在友情链接页主体后插入内容 |
| `friend-links.hero.before` | 在友情链接顶部说明区前插入内容 |
| `friend-links.hero.after` | 在友情链接顶部说明区后插入内容 |
| `friend-links.content.before` | 在友情链接目录区前插入内容 |
| `friend-links.content.after` | 在友情链接目录区后插入内容 |
| `funs.page.before` | 在全部节点页主体前插入内容 |
| `funs.page.after` | 在全部节点页主体后插入内容 |
| `funs.content.before` | 在全部节点内容区前插入内容 |
| `funs.content.after` | 在全部节点内容区后插入内容 |
| `funs.sidebar.before` | 在全部节点右侧栏前插入内容 |
| `funs.sidebar.after` | 在全部节点右侧栏后插入内容 |
| `funs.app.page.before` | 在功能应用页主体前插入内容；props 含 `appId/appName`，具体页面可能额外提供业务字段 |
| `funs.app.page.after` | 在功能应用页主体后插入内容；props 同上 |
| `funs.app.content.before` | 在功能应用内容前插入内容；props 同上 |
| `funs.app.content.after` | 在功能应用内容后插入内容；props 同上 |
| `badge.page.before` | 在勋章详情页主体前插入内容 |
| `badge.page.after` | 在勋章详情页主体后插入内容 |
| `badge.hero.before` | 在勋章详情顶部介绍区前插入内容 |
| `badge.hero.after` | 在勋章详情顶部介绍区后插入内容 |
| `badge.sidebar.before` | 在勋章详情右侧栏前插入内容 |
| `badge.sidebar.after` | 在勋章详情右侧栏后插入内容 |
| `custom-page.page.before` | 在自定义页主体前插入内容；props 含 `pageId/title/routePath/includeHeader/includeLeftSidebar/includeRightSidebar` |
| `custom-page.page.after` | 在自定义页主体后插入内容；props 同上 |
| `custom-page.content.before` | 在自定义页 HTML 内容前插入内容；props 同上 |
| `custom-page.content.after` | 在自定义页 HTML 内容后插入内容；props 同上 |
| `custom-page.sidebar.before` | 在自定义页右侧栏前插入内容；props 同上 |
| `custom-page.sidebar.after` | 在自定义页右侧栏后插入内容；props 同上 |

### 协议 / 小黑屋 / 认证流程 / 充值结果

| Slot | 说明 |
| --- | --- |
| `terms.page.before` | 在论坛协议页主体前插入内容 |
| `terms.page.after` | 在论坛协议页主体后插入内容 |
| `terms.hero.before` | 在论坛协议顶部介绍区前插入内容 |
| `terms.hero.after` | 在论坛协议顶部介绍区后插入内容 |
| `terms.content.before` | 在论坛协议正文区前插入内容 |
| `terms.content.after` | 在论坛协议正文区后插入内容 |
| `terms.sidebar.before` | 在论坛协议页右侧栏前插入内容 |
| `terms.sidebar.after` | 在论坛协议页右侧栏后插入内容 |
| `prison.page.before` | 在小黑屋页主体前插入内容 |
| `prison.page.after` | 在小黑屋页主体后插入内容 |
| `prison.hero.before` | 在小黑屋顶部说明区前插入内容 |
| `prison.hero.after` | 在小黑屋顶部说明区后插入内容 |
| `prison.content.before` | 在小黑屋名单区前插入内容 |
| `prison.content.after` | 在小黑屋名单区后插入内容 |
| `prison.sidebar.before` | 在小黑屋页右侧栏前插入内容 |
| `prison.sidebar.after` | 在小黑屋页右侧栏后插入内容 |
| `auth.forgot-password.page.before` | 在找回密码页主体前插入内容 |
| `auth.forgot-password.page.after` | 在找回密码页主体后插入内容 |
| `auth.forgot-password.panel.before` | 在找回密码面板前插入内容 |
| `auth.forgot-password.panel.after` | 在找回密码面板后插入内容 |
| `auth.passkey.page.before` | 在 Passkey 页面主体前插入内容 |
| `auth.passkey.page.after` | 在 Passkey 页面主体后插入内容 |
| `auth.passkey.panel.before` | 在 Passkey 面板前插入内容 |
| `auth.passkey.panel.after` | 在 Passkey 面板后插入内容 |
| `auth.complete.page.before` | 在第三方登录补全页主体前插入内容 |
| `auth.complete.page.after` | 在第三方登录补全页主体后插入内容 |
| `auth.complete.panel.before` | 在第三方登录补全面板前插入内容 |
| `auth.complete.panel.after` | 在第三方登录补全面板后插入内容 |
| `topup.result.page.before` | 在充值结果页主体前插入内容 |
| `topup.result.page.after` | 在充值结果页主体后插入内容 |
| `topup.result.panel.before` | 在充值结果面板前插入内容 |
| `topup.result.panel.after` | 在充值结果面板后插入内容 |

```js
api.registerActionHook({
  key: "after-login-sync",
  hook: "auth.login.after",
  async handle(context) {
    // ...
  },
})
```

## 示例

```js
api.registerWaterfallHook({
  key: "slug-prefix",
  hook: "post.slug.value",
  transform(context) {
    return `topic-${context.value}`
  },
})

api.registerAsyncWaterfallHook({
  key: "prepend-navigation",
  hook: "navigation.primary.items",
  async transform(context) {
    return [
      { label: "活动", href: "/events", activePrefix: "/events" },
      ...context.value,
    ]
  },
})
```
