import { UserRole, UserStatus } from "@/db/types"
import { prisma } from "@/db/client"

import { apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { getAiReplyConfig } from "@/lib/ai-reply-config"
import { getServerSiteSettings } from "@/lib/site-settings"
import { getPublicUserRoleBadgeLabel } from "@/lib/user-presentation"
import { applyHookedUserPresentationToNamedItem } from "@/lib/user-presentation-server"

const MENTION_SEARCH_LIMIT = 10

function normalizeQuery(request: Request) {
  return (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 40)
}

function buildDisplayName(user: { username: string; nickname: string | null }) {
  return user.nickname?.trim() || user.username
}

function getMatchScore(user: { username: string; nickname: string | null }, query: string) {
  const normalizedQuery = query.toLowerCase()
  const username = user.username.toLowerCase()
  const nickname = user.nickname?.toLowerCase() ?? ""

  if (username === normalizedQuery || nickname === normalizedQuery) {
    return 0
  }

  if (username.startsWith(normalizedQuery) || nickname.startsWith(normalizedQuery)) {
    return 1
  }

  if (username.includes(normalizedQuery)) {
    return 2
  }

  if (nickname.includes(normalizedQuery)) {
    return 3
  }

  return 4
}

export const GET = createUserRouteHandler(async ({ request, currentUser }) => {
  const query = normalizeQuery(request)
  const includeDefaultChoices = !query
  const [config, settings] = await Promise.all([
    getAiReplyConfig(),
    getServerSiteSettings(),
  ])
  const customDefaultUsernames = includeDefaultChoices
    ? settings.mentionRecommendations.defaultUsernames
    : []
  const customDefaultUsernameOrder = new Map(customDefaultUsernames.map((username, index) => [username.toLowerCase(), index]))
  const useCustomDefaultChoices = customDefaultUsernames.length > 0
  const botUserIds = Array.from(new Set(
    includeDefaultChoices && !useCustomDefaultChoices && config.enabled
      ? config.agents
        .filter((agent) => agent.enabled && agent.agentUserId)
        .map((agent) => agent.agentUserId)
        .filter((id): id is number => Boolean(id))
      : [],
  ))

  const [botUsers, staffUsers, matchedUsers] = await Promise.all([
    botUserIds.length > 0
      ? prisma.user.findMany({
          where: {
            id: { in: botUserIds },
            status: UserStatus.ACTIVE,
          },
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        })
      : Promise.resolve([]),
    includeDefaultChoices && !useCustomDefaultChoices
      ? prisma.user.findMany({
          where: {
            id: {
              not: currentUser.id,
              notIn: botUserIds,
            },
            status: UserStatus.ACTIVE,
            role: {
              in: [UserRole.ADMIN, UserRole.MODERATOR],
            },
          },
          orderBy: [
            { role: "desc" },
            { id: "asc" },
          ],
          take: MENTION_SEARCH_LIMIT,
          select: {
            id: true,
            username: true,
            nickname: true,
            role: true,
          },
        })
      : Promise.resolve([]),
    useCustomDefaultChoices
      ? prisma.user.findMany({
          where: {
            id: { not: currentUser.id },
            status: UserStatus.ACTIVE,
            OR: customDefaultUsernames.map((username) => ({
              username: { equals: username, mode: "insensitive" },
            })),
          },
          select: {
            id: true,
            username: true,
            nickname: true,
            role: true,
            level: true,
          },
        })
      : query
      ? prisma.user.findMany({
          where: {
            id: {
              not: currentUser.id,
              notIn: botUserIds,
            },
            status: UserStatus.ACTIVE,
            OR: [
              { username: { contains: query, mode: "insensitive" } },
              { nickname: { contains: query, mode: "insensitive" } },
            ],
          },
          orderBy: [
            { level: "desc" },
            { id: "asc" },
          ],
          take: 50,
          select: {
            id: true,
            username: true,
            nickname: true,
            role: true,
            level: true,
          },
        })
      : Promise.resolve([]),
  ])

  const botUserMap = new Map(botUsers.map((user) => [user.id, user]))
  const [presentedStaffUsers, presentedMatchedUsers] = await Promise.all([
    Promise.all(staffUsers.map((user) => applyHookedUserPresentationToNamedItem({
      id: user.id,
      username: user.username,
      displayName: buildDisplayName(user),
      role: user.role,
      status: UserStatus.ACTIVE,
    }))),
    Promise.all(matchedUsers.map((user) => applyHookedUserPresentationToNamedItem({
      id: user.id,
      username: user.username,
      displayName: buildDisplayName(user),
      role: user.role,
      status: UserStatus.ACTIVE,
      level: "level" in user ? user.level : null,
    }))),
  ])
  const presentedStaffUserMap = new Map(presentedStaffUsers.map((user) => [user.id, user]))
  const presentedMatchedUserMap = new Map(presentedMatchedUsers.map((user) => [user.id, user]))
  const bots = config.agents
    .map((agent) => {
      const user = agent.agentUserId ? botUserMap.get(agent.agentUserId) : null
      if (!agent.enabled || !user) {
        return null
      }

      return {
        kind: "bot" as const,
        id: user.id,
        label: agent.label || buildDisplayName(user),
        displayName: buildDisplayName(user),
        username: user.username,
        nickname: user.nickname,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  return apiSuccess({
    bots,
    staff: staffUsers.map((user) => {
      const presentedUser = presentedStaffUserMap.get(user.id)

      return {
        kind: "staff" as const,
        id: user.id,
        label: presentedUser?.displayName ?? buildDisplayName(user),
        displayName: presentedUser?.displayName ?? buildDisplayName(user),
        username: user.username,
        nickname: user.nickname,
        roleLabel: getPublicUserRoleBadgeLabel({
          role: user.role,
          roleBadge: presentedUser?.roleBadge,
        }),
      }
    }),
    users: matchedUsers
      .sort((a, b) => {
        if (useCustomDefaultChoices) {
          return (customDefaultUsernameOrder.get(a.username.toLowerCase()) ?? MENTION_SEARCH_LIMIT)
            - (customDefaultUsernameOrder.get(b.username.toLowerCase()) ?? MENTION_SEARCH_LIMIT)
        }

        const scoreDelta = getMatchScore(a, query) - getMatchScore(b, query)
        if (scoreDelta !== 0) {
          return scoreDelta
        }

        if (b.level !== a.level) {
          return b.level - a.level
        }

        return a.id - b.id
      })
      .slice(0, MENTION_SEARCH_LIMIT)
      .map((user) => {
        const presentedUser = presentedMatchedUserMap.get(user.id)

        return {
          kind: "user" as const,
          id: user.id,
          label: presentedUser?.displayName ?? buildDisplayName(user),
          displayName: presentedUser?.displayName ?? buildDisplayName(user),
          username: user.username,
          nickname: user.nickname,
          roleLabel: getPublicUserRoleBadgeLabel({
            role: user.role,
            roleBadge: presentedUser?.roleBadge,
          }),
        }
      }),
  })
}, {
  errorMessage: "用户搜索失败",
  logPrefix: "[api/mentions/search] unexpected error",
  unauthorizedMessage: "请先登录后再搜索用户",
})
