import { formatDateTime } from "@/lib/formatters"

export type YinYangOption = "A" | "B"
export type YinYangChallengeStatus = "OPEN" | "LOCKED" | "SETTLED" | "CANCELLED"

export type YinYangChallengeCard = {
  id: string
  creatorId: number
  creatorName: string
  challengerId: number | null
  challengerName: string | null
  status: YinYangChallengeStatus
  question: string
  optionA: string
  optionB: string
  correctOption: YinYangOption | null
  selectedOption: YinYangOption | null
  isCorrect: boolean | null
  stakePoints: number
  rewardPoints: number
  taxPoints: number
  winnerId: number | null
  loserId: number | null
  createdAt: string
  settledAt: string | null
  expiresAt: string | null
}

export type YinYangMyStats = {
  userId: number | null
  pointName: string
  points: number
  winCount: number
  loseCount: number
  todayProfitPoints: number
  todayLossPoints: number
  totalProfitPoints: number
  totalLossPoints: number
  dailyCreateLimit: number
  dailyAcceptLimit: number
  createdToday: number
  acceptedToday: number
}

export type YinYangLeaderboardUser = {
  userId: number
  userName: string
  winCount: number
  loseCount: number
  todayProfitPoints: number
  todayLossPoints: number
  totalProfitPoints: number
  totalLossPoints: number
  winRate: number
  badge: "阴阳王" | null
}

export type YinYangLobbyData = {
  summary: YinYangMyStats
  openChallenges: YinYangChallengeCard[]
  recentChallenges: YinYangChallengeCard[]
  winnerLeaderboard: YinYangLeaderboardUser[]
  earnerLeaderboard: YinYangLeaderboardUser[]
  kings: {
    previousKing: string | null
    currentKing: string | null
  }
  config: {
    entryLabel: string
    pointName: string
    minStakePoints: number
    maxStakePoints: number
    taxRateBps: number
    dailyCreateLimit: number
    dailyAcceptLimit: number
  }
}

export function formatYinYangChallengeTime(value: string | null) {
  return value ? formatDateTime(value) : "-"
}
