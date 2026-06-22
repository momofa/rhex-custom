export const POST_AUCTION_MODES = ["SEALED_BID", "OPEN_ASCENDING"] as const
export type LocalPostAuctionMode = (typeof POST_AUCTION_MODES)[number]

export const POST_AUCTION_PRICING_RULES = ["FIRST_PRICE", "SECOND_PRICE"] as const
export type LocalPostAuctionPricingRule = (typeof POST_AUCTION_PRICING_RULES)[number]

export function isLocalPostAuctionMode(value: unknown): value is LocalPostAuctionMode {
  return typeof value === "string" && POST_AUCTION_MODES.includes(value as LocalPostAuctionMode)
}

export function normalizePostAuctionMode(value: unknown, fallback: LocalPostAuctionMode = "SEALED_BID"): LocalPostAuctionMode {
  const normalizedValue = typeof value === "string" ? value.trim().toUpperCase() : ""
  return isLocalPostAuctionMode(normalizedValue) ? normalizedValue : fallback
}

export function isLocalPostAuctionPricingRule(value: unknown): value is LocalPostAuctionPricingRule {
  return typeof value === "string" && POST_AUCTION_PRICING_RULES.includes(value as LocalPostAuctionPricingRule)
}

export function normalizePostAuctionPricingRule(
  value: unknown,
  fallback: LocalPostAuctionPricingRule = "FIRST_PRICE",
): LocalPostAuctionPricingRule {
  const normalizedValue = typeof value === "string" ? value.trim().toUpperCase() : ""
  return isLocalPostAuctionPricingRule(normalizedValue) ? normalizedValue : fallback
}

export function getPostAuctionModeLabel(mode: LocalPostAuctionMode | string) {
  switch (mode) {
    case "OPEN_ASCENDING":
      return "公开拍卖"
    case "SEALED_BID":
    default:
      return "密封竞拍"
  }
}

export function getPostAuctionPricingRuleLabel(rule: LocalPostAuctionPricingRule | string) {
  switch (rule) {
    case "SECOND_PRICE":
      return "第二高价成交"
    case "FIRST_PRICE":
    default:
      return "最高价成交"
  }
}
