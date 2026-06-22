import type { CurrentUserRecord } from "@/db/current-user"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { prisma } from "@/db/client"
import { executeUserCheckIn, listUserCheckInLogsInRange, updateUserCheckInReward } from "@/db/check-in-queries"
import { countTaskDefinitions } from "@/db/task-definition-queries"

import { apiError } from "@/lib/api-route"
import { getCheckInMakeUpEarliestDateKey, normalizeCheckInMakeUpOldestDayLimit } from "@/lib/check-in-policy"
import { formatCheckInRewardRange, parseCheckInRewardRangeInput, rollCheckInReward, resolveUserCheckInRewardRange } from "@/lib/check-in-reward"
import { getUserCheckInStreakSummary } from "@/lib/check-in-streak-service"
import { getLocalDateKey, getMonthKey } from "@/lib/date-key"
import { formatNumber } from "@/lib/formatters"
import { evaluateUserLevelProgress } from "@/lib/level-system"
import { prepareScopedPointDelta, type PreparedPointDelta } from "@/lib/point-center"
import { getSiteSettings } from "@/lib/site-settings"
import { ensureTaskCenterSeeded } from "@/lib/task-center-defaults"
import { recordCheckInTaskEvent } from "@/lib/task-center-service"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

interface CheckInSettingsSnapshot {
  pointName: string
  checkInMakeUpEnabled: boolean
  checkInMakeUpCountsTowardStreak: boolean
  checkInMakeUpOldestDayLimit: number
  checkInReward: number
  checkInRewardText: string
  checkInVip1Reward: number
  checkInVip1RewardText: string
  checkInVip2Reward: number
  checkInVip2RewardText: string
  checkInVip3Reward: number
  checkInVip3RewardText: string
  checkInMakeUpCardPrice: number
  checkInVip1MakeUpCardPrice: number
  checkInVip2MakeUpCardPrice: number
  checkInVip3MakeUpCardPrice: number
}

interface BuildCheckInCalendarOptions {
  userId: number
  month: string
}

interface ExecuteCheckInOptions {
  userId: number
  dateKey: string
  reward: number
  rewardDelta: PreparedPointDelta
  pointName: string
  makeUpCost: number
  makeUpCostDelta: PreparedPointDelta
  isMakeUp: boolean
  makeUpCountsTowardStreak: boolean
}

interface CheckInActionPayload {
  action: "check-in" | "make-up"
  date?: string
}

export interface CheckInCalendarEntry {
  date: string
  reward: number
  isMakeUp: boolean
  makeUpCost: number
  createdAt: string
}

export interface CheckInOverview {
  month: string
  pointName: string
  currentStreak: number
  maxStreak: number
  makeUpEnabled: boolean
  makeUpCountsTowardStreak: boolean
  makeUpOldestDayLimit: number
  checkInReward: number
  checkInRewardText: string
  vip1CheckInReward: number
  vip1CheckInRewardText: string
  vip2CheckInReward: number
  vip2CheckInRewardText: string
  vip3CheckInReward: number
  vip3CheckInRewardText: string
  makeUpPrice: number
  vipMakeUpPrice: number
  normalMakeUpPrice: number
  vip1MakeUpPrice: number
  vip2MakeUpPrice: number
  vip3MakeUpPrice: number
  entries: CheckInCalendarEntry[]
}

export interface CheckInActionResult {
  points: number
  reward: number
  alreadyCheckedIn: boolean
  date: string
  currentStreak: number
  maxStreak: number
  makeUpCost?: number
  message: string
}

function parseDateKey(input: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return null
  }

  const date = new Date(`${input}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

function getMonthBounds(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    apiError(400, "月份格式不正确")
  }

  const firstDay = new Date(`${month}-01T00:00:00`)
  if (Number.isNaN(firstDay.getTime())) {
    apiError(400, "月份格式不正确")
  }

  const nextMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 1)
  return {
    start: `${month}-01`,
    end: getLocalDateKey(new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000)),
  }
}

function assertCheckInEnabled(settings: { checkInEnabled: boolean }) {
  if (!settings.checkInEnabled) {
    apiError(403, "签到功能暂未开启")
  }
}

function readCheckInSettingsSnapshot(settings: CheckInSettingsSnapshot) {
  return {
    pointName: settings.pointName,
    checkInMakeUpEnabled: settings.checkInMakeUpEnabled,
    checkInMakeUpCountsTowardStreak: settings.checkInMakeUpCountsTowardStreak,
    checkInMakeUpOldestDayLimit: normalizeCheckInMakeUpOldestDayLimit(settings.checkInMakeUpOldestDayLimit),
    normalRewardRange: parseCheckInRewardRangeInput(settings.checkInRewardText) ?? {
      min: Math.max(0, settings.checkInReward),
      max: Math.max(0, settings.checkInReward),
    },
    normalRewardText: settings.checkInRewardText,
    vip1RewardRange: parseCheckInRewardRangeInput(settings.checkInVip1RewardText) ?? {
      min: Math.max(0, settings.checkInVip1Reward),
      max: Math.max(0, settings.checkInVip1Reward),
    },
    vip1RewardText: settings.checkInVip1RewardText,
    vip2RewardRange: parseCheckInRewardRangeInput(settings.checkInVip2RewardText) ?? {
      min: Math.max(0, settings.checkInVip2Reward),
      max: Math.max(0, settings.checkInVip2Reward),
    },
    vip2RewardText: settings.checkInVip2RewardText,
    vip3RewardRange: parseCheckInRewardRangeInput(settings.checkInVip3RewardText) ?? {
      min: Math.max(0, settings.checkInVip3Reward),
      max: Math.max(0, settings.checkInVip3Reward),
    },
    vip3RewardText: settings.checkInVip3RewardText,
    normalMakeUpPrice: Math.max(0, settings.checkInMakeUpCardPrice),
    vip1MakeUpPrice: Math.max(0, settings.checkInVip1MakeUpCardPrice),
    vip2MakeUpPrice: Math.max(0, settings.checkInVip2MakeUpCardPrice),
    vip3MakeUpPrice: Math.max(0, settings.checkInVip3MakeUpCardPrice),
  }
}

function resolveCheckInRewardSettingsForUser(
  snapshot: ReturnType<typeof readCheckInSettingsSnapshot>,
  user: Pick<CurrentUserRecord, "vipLevel" | "vipExpiresAt">,
) {
  const rewardRange = resolveUserCheckInRewardRange({
    normal: snapshot.normalRewardRange,
    vip1: snapshot.vip1RewardRange,
    vip2: snapshot.vip2RewardRange,
    vip3: snapshot.vip3RewardRange,
  }, user)
  const rewardText = isVipActive(user)
    ? getVipLevel(user) >= 3
      ? snapshot.vip3RewardText
      : getVipLevel(user) === 2
        ? snapshot.vip2RewardText
        : snapshot.vip1RewardText
    : snapshot.normalRewardText

  return {
    rewardRange,
    rewardText: rewardText || formatCheckInRewardRange(rewardRange),
  }
}

function resolveUserMakeUpPrice(
  snapshot: ReturnType<typeof readCheckInSettingsSnapshot>,
  user: Pick<CurrentUserRecord, "vipLevel" | "vipExpiresAt">,
) {
  if (!isVipActive(user)) {
    return snapshot.normalMakeUpPrice
  }

  const vipLevel = getVipLevel(user)
  if (vipLevel >= 3) {
    return snapshot.vip3MakeUpPrice
  }

  if (vipLevel === 2) {
    return snapshot.vip2MakeUpPrice
  }

  return snapshot.vip1MakeUpPrice
}

async function buildCalendarData(options: BuildCheckInCalendarOptions): Promise<CheckInCalendarEntry[]> {
  const bounds = getMonthBounds(options.month)
  const logs = await listUserCheckInLogsInRange({
    userId: options.userId,
    startDateKey: bounds.start,
    endDateKey: bounds.end,
  })

  return logs.map((item) => ({
    date: item.checkedInOn,
    reward: item.reward,
    isMakeUp: item.isMakeUp,
    makeUpCost: item.makeUpCost,
    createdAt: item.createdAt.toISOString(),
  }))
}

async function executeCheckIn(options: ExecuteCheckInOptions) {
  const result = await executeUserCheckIn(options)

  if (!result) {
    apiError(404, "用户不存在")
  }

  if (options.isMakeUp && options.makeUpCost > 0 && !result.alreadyCheckedIn && result.points < 0) {
    apiError(409, `${options.pointName}不足，无法补签`)
  }

  if (!result.alreadyCheckedIn) {
    await evaluateUserLevelProgress(options.userId, { notifyOnUpgrade: true })
  }

  return result
}

function parseCheckInActionPayload(body: unknown): CheckInActionPayload {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { action: "check-in" }
  }

  const record = body as Record<string, unknown>
  const action = record.action === "make-up" ? "make-up" : "check-in"
  const date = typeof record.date === "string" ? record.date.trim() : ""

  return action === "make-up"
    ? { action, ...(date ? { date } : {}) }
    : { action }
}

async function settleTaskDrivenCheckInReward(params: {
  userId: number
  dateKey: string
  currentPoints: number
  warningContext: string
}) {
  let finalReward = 0
  let finalPoints = params.currentPoints

  try {
    const taskReward = await recordCheckInTaskEvent({
      type: "CHECK_IN",
      userId: params.userId,
      dateKey: params.dateKey,
    })
    finalReward = taskReward.awardedPoints
    await updateUserCheckInReward({
      userId: params.userId,
      dateKey: params.dateKey,
      reward: finalReward,
    })
    const latestUser = await prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        points: true,
      },
    })
    if (latestUser) {
      finalPoints = latestUser.points
    }
  } catch (error) {
    console.warn(`[check-in-service] failed to settle task rewards for ${params.warningContext}`, error)
  }

  return {
    reward: finalReward,
    points: finalPoints,
  }
}

export async function getCheckInOverview(user: CurrentUserRecord, month = getMonthKey()): Promise<CheckInOverview> {
  const settings = await getSiteSettings()
  assertCheckInEnabled(settings)

  await ensureTaskCenterSeeded()

  const snapshot = readCheckInSettingsSnapshot(settings)
  const userRewardSettings = resolveCheckInRewardSettingsForUser(snapshot, user)
  const [entries, streakSummary] = await Promise.all([
    buildCalendarData({ userId: user.id, month }),
    getUserCheckInStreakSummary(user.id),
  ])

  return {
    month,
    pointName: snapshot.pointName,
    currentStreak: streakSummary.currentStreak,
    maxStreak: streakSummary.maxStreak,
    makeUpEnabled: snapshot.checkInMakeUpEnabled,
    makeUpCountsTowardStreak: streakSummary.makeUpCountsTowardStreak,
    makeUpOldestDayLimit: snapshot.checkInMakeUpOldestDayLimit,
    checkInReward: userRewardSettings.rewardRange.min,
    checkInRewardText: userRewardSettings.rewardText,
    vip1CheckInReward: snapshot.vip1RewardRange.min,
    vip1CheckInRewardText: snapshot.vip1RewardText || formatCheckInRewardRange(snapshot.vip1RewardRange),
    vip2CheckInReward: snapshot.vip2RewardRange.min,
    vip2CheckInRewardText: snapshot.vip2RewardText || formatCheckInRewardRange(snapshot.vip2RewardRange),
    vip3CheckInReward: snapshot.vip3RewardRange.min,
    vip3CheckInRewardText: snapshot.vip3RewardText || formatCheckInRewardRange(snapshot.vip3RewardRange),
    makeUpPrice: resolveUserMakeUpPrice(snapshot, user),
    vipMakeUpPrice: snapshot.vip1MakeUpPrice,
    normalMakeUpPrice: snapshot.normalMakeUpPrice,
    vip1MakeUpPrice: snapshot.vip1MakeUpPrice,
    vip2MakeUpPrice: snapshot.vip2MakeUpPrice,
    vip3MakeUpPrice: snapshot.vip3MakeUpPrice,
    entries,
  }
}

export async function submitCheckInAction(user: CurrentUserRecord, body: unknown): Promise<CheckInActionResult> {
  const settings = await getSiteSettings()
  assertCheckInEnabled(settings)

  const snapshot = readCheckInSettingsSnapshot(settings)
  const payload = parseCheckInActionPayload(body)
  const todayKey = getLocalDateKey()
  const taskDefinitionCount = await countTaskDefinitions()
  const usesLegacyReward = taskDefinitionCount === 0
  const reward = usesLegacyReward
    ? rollCheckInReward(resolveCheckInRewardSettingsForUser(snapshot, user).rewardRange)
    : 0
  const rewardDelta = await prepareScopedPointDelta({
    scopeKey: "CHECK_IN_REWARD",
    baseDelta: reward,
    userId: user.id,
  })

  if (payload.action === "check-in") {
    await executeAddonActionHook("check-in.submit.before", {
      userId: user.id,
      username: user.username,
      action: "check-in",
      date: todayKey,
      reward,
      pointName: snapshot.pointName,
    }, { throwOnError: true })

    const result = await executeCheckIn({
      userId: user.id,
      dateKey: todayKey,
      reward,
      rewardDelta,
      pointName: snapshot.pointName,
      makeUpCost: 0,
      makeUpCostDelta: {
        scopeKey: "CHECK_IN_MAKE_UP_COST",
        baseDelta: 0,
        finalDelta: 0,
        appliedRules: [],
      },
      isMakeUp: false,
      makeUpCountsTowardStreak: snapshot.checkInMakeUpCountsTowardStreak,
    })
    let finalReward = result.alreadyCheckedIn ? 0 : reward
    let finalPoints = result.points

    if (!result.alreadyCheckedIn && !usesLegacyReward) {
      const settledReward = await settleTaskDrivenCheckInReward({
        userId: user.id,
        dateKey: todayKey,
        currentPoints: result.points,
        warningContext: "check-in",
      })
      finalReward = settledReward.reward
      finalPoints = settledReward.points
    }

    const streakSummary = await getUserCheckInStreakSummary(user.id)

    await executeAddonActionHook("check-in.submit.after", {
      userId: user.id,
      username: user.username,
      action: "check-in",
      date: todayKey,
      reward,
      finalReward,
      points: finalPoints,
      currentStreak: streakSummary.currentStreak,
      maxStreak: streakSummary.maxStreak,
      alreadyCheckedIn: result.alreadyCheckedIn,
      pointName: snapshot.pointName,
    })

    return {
      points: finalPoints,
      reward: finalReward,
      alreadyCheckedIn: result.alreadyCheckedIn,
      date: todayKey,
      currentStreak: streakSummary.currentStreak,
      maxStreak: streakSummary.maxStreak,
      message: result.alreadyCheckedIn
        ? "今天已经签到过了"
        : finalReward > 0
          ? `签到成功，获得 ${formatNumber(finalReward)} ${snapshot.pointName}`
          : "签到成功",
    }
  }

  const parsedDate = parseDateKey(payload.date ?? "")
  if (!parsedDate) {
    apiError(400, "补签日期格式不正确")
  }

  const targetDateKey = getLocalDateKey(parsedDate)
  if (targetDateKey >= todayKey) {
    apiError(400, "只能补签今天之前的日期")
  }

  if (!snapshot.checkInMakeUpEnabled) {
    apiError(403, "补签功能暂未开启")
  }

  const earliestMakeUpDateKey = getCheckInMakeUpEarliestDateKey(todayKey, snapshot.checkInMakeUpOldestDayLimit)
  if (earliestMakeUpDateKey && targetDateKey < earliestMakeUpDateKey) {
    apiError(400, `当前仅允许补签最近 ${snapshot.checkInMakeUpOldestDayLimit} 天内的历史日期`)
  }

  const makeUpCost = resolveUserMakeUpPrice(snapshot, user)
  const makeUpCostDelta = await prepareScopedPointDelta({
    scopeKey: "CHECK_IN_MAKE_UP_COST",
    baseDelta: -makeUpCost,
    userId: user.id,
  })
  if (makeUpCostDelta.finalDelta < 0 && user.points < Math.abs(makeUpCostDelta.finalDelta)) {
    apiError(409, `${snapshot.pointName}不足，无法补签`)
  }

  await executeAddonActionHook("check-in.submit.before", {
    userId: user.id,
    username: user.username,
    action: "make-up",
    date: targetDateKey,
    reward,
    pointName: snapshot.pointName,
    makeUpCost,
  }, { throwOnError: true })

  const result = await executeCheckIn({
    userId: user.id,
    dateKey: targetDateKey,
    reward,
    rewardDelta,
    pointName: snapshot.pointName,
    makeUpCost,
    makeUpCostDelta,
    isMakeUp: true,
    makeUpCountsTowardStreak: snapshot.checkInMakeUpCountsTowardStreak,
  })

  if (result.alreadyCheckedIn) {
    apiError(409, "该日期已经签到过了")
  }
  let finalReward = reward
  let finalPoints = result.points

  if (!usesLegacyReward) {
    const settledReward = await settleTaskDrivenCheckInReward({
      userId: user.id,
      dateKey: targetDateKey,
      currentPoints: result.points,
      warningContext: "make-up check-in",
    })
    finalReward = settledReward.reward
    finalPoints = settledReward.points
  }

  const streakSummary = await getUserCheckInStreakSummary(user.id)

  await executeAddonActionHook("check-in.submit.after", {
    userId: user.id,
    username: user.username,
    action: "make-up",
    date: targetDateKey,
    reward,
    finalReward,
    points: finalPoints,
    currentStreak: streakSummary.currentStreak,
    maxStreak: streakSummary.maxStreak,
    alreadyCheckedIn: false,
    pointName: snapshot.pointName,
    makeUpCost,
  })

  return {
    points: finalPoints,
    reward: finalReward,
    alreadyCheckedIn: false,
    date: targetDateKey,
    currentStreak: streakSummary.currentStreak,
    maxStreak: streakSummary.maxStreak,
    makeUpCost,
    message: `补签成功，获得 ${formatNumber(finalReward)} ${snapshot.pointName}${makeUpCost > 0 ? `，消耗 ${formatNumber(makeUpCost)} ${snapshot.pointName}` : ""}`,
  }
}
