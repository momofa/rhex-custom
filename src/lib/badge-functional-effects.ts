import { hasDisplayedBadgeEffectScope } from "@/db/badge-queries"
import { BADGE_EFFECT_SCOPE_HOME_AUTO_CHECK_IN } from "@/lib/point-effect-definitions"

export async function hasHomeAutoCheckInBadgeEffect(userId?: number | null) {
  if (!userId) {
    return false
  }

  return hasDisplayedBadgeEffectScope(userId, BADGE_EFFECT_SCOPE_HOME_AUTO_CHECK_IN)
}
