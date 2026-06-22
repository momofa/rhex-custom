import { addSafeIntegers, multiplyPositiveSafeIntegers, parsePositiveSafeInteger } from "@/lib/shared/safe-integer"
import { toPrismaJsonValue } from "@/lib/shared/prisma-json"

export type LotteryPrizeTypeValue = "MANUAL" | "POINTS" | "VIP" | "REDEEM_CODE"
export type LotteryVipPlanValue = "MONTH" | "QUARTER" | "YEAR"

export interface LotteryPrizeCostSettings {
  pointName?: string
  vipMonthlyPrice: number
  vipQuarterlyPrice: number
  vipYearlyPrice: number
}

export interface LotteryPrizeDraftInput {
  title: string
  description: string
  quantity: number
  type: LotteryPrizeTypeValue
  pointsAmount: number | null
  vipPlan: LotteryVipPlanValue | null
  redemptionCodes?: string[]
}

export const LOTTERY_PRIZE_TYPE_OPTIONS = [
  { value: "MANUAL", label: "人工奖品", description: "中奖后由发起人线下或手动发放。" },
  { value: "POINTS", label: "站内积分", description: "开奖后自动发放到中奖用户账户。" },
  { value: "VIP", label: "会员权益", description: "开奖后自动开通或延长中奖用户 VIP。" },
  { value: "REDEEM_CODE", label: "兑换码", description: "每行一个码，开奖后每名中奖用户只看到自己的码。" },
] as const satisfies Array<{ value: LotteryPrizeTypeValue; label: string; description: string }>

export const LOTTERY_VIP_PLAN_OPTIONS = [
  { value: "MONTH", label: "月卡 VIP1", days: 30, level: 1, priceField: "vipMonthlyPrice" },
  { value: "QUARTER", label: "季卡 VIP2", days: 90, level: 2, priceField: "vipQuarterlyPrice" },
  { value: "YEAR", label: "年卡 VIP3", days: 365, level: 3, priceField: "vipYearlyPrice" },
] as const satisfies Array<{
  value: LotteryVipPlanValue
  label: string
  days: number
  level: number
  priceField: keyof Pick<LotteryPrizeCostSettings, "vipMonthlyPrice" | "vipQuarterlyPrice" | "vipYearlyPrice">
}>

const LOTTERY_PRIZE_TYPE_SET = new Set<LotteryPrizeTypeValue>(LOTTERY_PRIZE_TYPE_OPTIONS.map((item) => item.value))
const LOTTERY_VIP_PLAN_SET = new Set<LotteryVipPlanValue>(LOTTERY_VIP_PLAN_OPTIONS.map((item) => item.value))
export const LOTTERY_REDEMPTION_CODE_LIMIT = 1000
export const LOTTERY_REDEMPTION_CODE_MAX_LENGTH = 200

export function normalizeLotteryPrizeType(value: unknown): LotteryPrizeTypeValue {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : ""
  return LOTTERY_PRIZE_TYPE_SET.has(normalized as LotteryPrizeTypeValue)
    ? normalized as LotteryPrizeTypeValue
    : "MANUAL"
}

export function normalizeLotteryVipPlan(value: unknown): LotteryVipPlanValue {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : ""
  return LOTTERY_VIP_PLAN_SET.has(normalized as LotteryVipPlanValue)
    ? normalized as LotteryVipPlanValue
    : "MONTH"
}

export function normalizeLotteryRedemptionCodes(value: unknown): string[] {
  const rawLines = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : []

  return rawLines
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
}

export function hasDuplicateLotteryRedemptionCodes(codes: readonly string[]) {
  return new Set(codes).size !== codes.length
}

export function getLotteryPrizeTypeLabel(type: string) {
  return LOTTERY_PRIZE_TYPE_OPTIONS.find((item) => item.value === normalizeLotteryPrizeType(type))?.label ?? type
}

export function getLotteryVipPlanDetails(plan: string | null | undefined, settings?: LotteryPrizeCostSettings) {
  const normalizedPlan = normalizeLotteryVipPlan(plan)
  const option = LOTTERY_VIP_PLAN_OPTIONS.find((item) => item.value === normalizedPlan) ?? LOTTERY_VIP_PLAN_OPTIONS[0]

  return {
    plan: option.value,
    label: option.label,
    days: option.days,
    level: option.level,
    pointsCost: settings ? Math.max(0, Math.trunc(Number(settings[option.priceField]) || 0)) : 0,
    orderType: `lottery.reward.${option.value.toLowerCase()}`,
  }
}

export function buildLotteryPrizeDefaultTitle(prize: Pick<LotteryPrizeDraftInput, "type" | "pointsAmount" | "vipPlan">, pointName = "积分") {
  if (prize.type === "POINTS") {
    return `${pointName}奖励`
  }

  if (prize.type === "VIP") {
    return getLotteryVipPlanDetails(prize.vipPlan).label
  }

  if (prize.type === "REDEEM_CODE") {
    return "兑换码"
  }

  return ""
}

export function buildLotteryPrizeDefaultDescription(prize: Pick<LotteryPrizeDraftInput, "type" | "pointsAmount" | "vipPlan">, pointName = "积分") {
  if (prize.type === "POINTS") {
    const amount = Math.max(0, Math.trunc(prize.pointsAmount ?? 0))
    return amount > 0
      ? `中奖后自动发放 ${amount} ${pointName}`
      : `中奖后自动发放${pointName}`
  }

  if (prize.type === "VIP") {
    const plan = getLotteryVipPlanDetails(prize.vipPlan)
    return `中奖后自动开通或延长 ${plan.label}，有效期 ${plan.days} 天`
  }

  if (prize.type === "REDEEM_CODE") {
    return "中奖后显示专属兑换码"
  }

  return ""
}

export function resolveLotteryPrizeUnitCost(
  prize: {
    type?: LotteryPrizeTypeValue | string | null
    pointsAmount?: number | null
    vipPlan?: LotteryVipPlanValue | string | null
    unitCostPoints?: number | null
  },
  settings?: LotteryPrizeCostSettings,
) {
  const storedUnitCost = typeof prize.unitCostPoints === "number" && Number.isFinite(prize.unitCostPoints)
    ? Math.max(0, Math.trunc(prize.unitCostPoints))
    : null

  if (storedUnitCost !== null) {
    return storedUnitCost
  }

  const type = normalizeLotteryPrizeType(prize.type)
  if (type === "POINTS") {
    return Math.max(0, Math.trunc(prize.pointsAmount ?? 0))
  }

  if (type === "VIP") {
    return getLotteryVipPlanDetails(prize.vipPlan, settings).pointsCost
  }

  return 0
}

export function calculateLotteryAutoPrizeTotalCost(
  prizes: Array<{
    type?: LotteryPrizeTypeValue | string | null
    quantity?: number | null
    pointsAmount?: number | null
    vipPlan?: LotteryVipPlanValue | string | null
    unitCostPoints?: number | null
  }>,
  settings?: LotteryPrizeCostSettings,
) {
  let total = 0

  for (const prize of prizes) {
    const type = normalizeLotteryPrizeType(prize.type)
    if (type !== "POINTS" && type !== "VIP") {
      continue
    }

    const quantity = parsePositiveSafeInteger(prize.quantity ?? 0)
    if (!quantity) {
      return null
    }

    const unitCost = resolveLotteryPrizeUnitCost(prize, settings)
    const prizeCost = unitCost > 0
      ? multiplyPositiveSafeIntegers(unitCost, quantity)
      : 0

    if (prizeCost === null) {
      return null
    }

    const nextTotal = addSafeIntegers(total, prizeCost)
    if (nextTotal === null || nextTotal < 0) {
      return null
    }
    total = nextTotal
  }

  return total
}

export function buildLotteryPrizeCreateInputs(
  prizes: LotteryPrizeDraftInput[],
  settings: LotteryPrizeCostSettings,
) {
  const pointName = settings.pointName ?? "积分"

  return prizes.map((prize, index) => {
    const unitCostPoints = resolveLotteryPrizeUnitCost(prize, settings)
    const title = prize.title || buildLotteryPrizeDefaultTitle(prize, pointName)
    const description = prize.description || buildLotteryPrizeDefaultDescription(prize, pointName)
    const redemptionCodes = normalizeLotteryRedemptionCodes(prize.redemptionCodes)
    const quantity = prize.type === "REDEEM_CODE" ? redemptionCodes.length : prize.quantity

    return {
      title,
      description,
      quantity,
      type: prize.type,
      pointsAmount: prize.type === "POINTS" ? prize.pointsAmount : null,
      vipPlan: prize.type === "VIP" ? (prize.vipPlan ?? "MONTH") : null,
      codesJson: prize.type === "REDEEM_CODE" ? toPrismaJsonValue(redemptionCodes) : undefined,
      unitCostPoints,
      sortOrder: index,
    }
  })
}
