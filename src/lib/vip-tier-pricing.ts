import { getVipLevel, isVipActive, type VipStateSource } from "@/lib/vip-status"

export interface VipTierPricing {
  normal: number
  vip1: number
  vip2: number
  vip3: number
}

export function resolveVipTierPrice(source: VipStateSource | null | undefined, pricing: VipTierPricing) {
  if (!isVipActive(source)) {
    return pricing.normal
  }

  const vipLevel = getVipLevel(source)
  if (vipLevel >= 3) {
    return pricing.vip3
  }

  if (vipLevel === 2) {
    return pricing.vip2
  }

  return pricing.vip1
}

export function describeVipTierBilling(source: VipStateSource | null | undefined) {
  if (!isVipActive(source)) {
    return "你当前按普通用户价格结算"
  }

  const vipLevel = getVipLevel(source)
  if (vipLevel >= 3) {
    return "你当前按 VIP3 价结算"
  }

  if (vipLevel === 2) {
    return "你当前按 VIP2 价结算"
  }

  return "你当前按 VIP1 价结算"
}
