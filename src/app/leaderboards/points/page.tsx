import { LeaderboardPageShell } from "@/components/leaderboards/leaderboard-page-shell"
import { getPointsLeaderboard, MAX_COMMUNITY_LEADERBOARD_LIMIT } from "@/lib/community-leaderboards"
import { formatCompactPointValue } from "@/lib/formatters"
import { getLeaderboardPageChromeData } from "@/lib/leaderboard-page-chrome"

export default async function PointsLeaderboardPage() {
  const chrome = await getLeaderboardPageChromeData()

  const leaderboard = await getPointsLeaderboard(chrome.currentUser
    ? {
        id: chrome.currentUser.id,
        username: chrome.currentUser.username,
        nickname: chrome.currentUser.nickname,
        avatarPath: chrome.currentUser.avatarPath,
        points: chrome.currentUser.points,
        status: chrome.currentUser.status,
      }
    : null, {
      limit: MAX_COMMUNITY_LEADERBOARD_LIMIT,
    })

  return (
    <LeaderboardPageShell
      eyebrow="Points Leaderboard"
      title={`${chrome.settings.pointName}排行榜`}
      description={`按当前 ${chrome.settings.pointName} 余额降序排列，适合快速查看站内资产分布和高活跃账号。`}
      totalUsers={leaderboard.totalUsers}
      entries={leaderboard.entries}
      currentUserEntry={leaderboard.currentUserEntry}
      currentUserHint={chrome.currentUser ? `你当前还未进入 ${chrome.settings.pointName} 排行榜。` : "登录后可查看你的个人名次。"}
      emptyText={`暂时还没有可展示的 ${chrome.settings.pointName} 排行数据。`}
      primaryHref="/settings?tab=points"
      primaryLabel="返回积分明细"
      secondaryHref="/"
      secondaryLabel="返回首页"
      scoreColumnLabel={chrome.settings.pointName}
      tabs={[
        { href: "/leaderboards/points", label: `${chrome.settings.pointName}榜`, active: true },
        { href: "/leaderboards/check-in", label: "签到榜" },
      ]}
      chrome={chrome}
      renderMetric={() => (
        <>当前余额</>
      )}
      renderMetricValue={(entry) => `${formatCompactPointValue(entry.points)}`}
    />
  )
}
