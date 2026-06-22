import { LeaderboardPageShell } from "@/components/leaderboards/leaderboard-page-shell"
import { getCheckInLeaderboard, MAX_COMMUNITY_LEADERBOARD_LIMIT } from "@/lib/community-leaderboards"
import { formatCompactNumber, formatNumber } from "@/lib/formatters"
import { getLeaderboardPageChromeData } from "@/lib/leaderboard-page-chrome"

export default async function CheckInLeaderboardPage() {
  const chrome = await getLeaderboardPageChromeData()

  const leaderboard = await getCheckInLeaderboard(chrome.currentUser
    ? {
        id: chrome.currentUser.id,
        username: chrome.currentUser.username,
        nickname: chrome.currentUser.nickname,
        avatarPath: chrome.currentUser.avatarPath,
        status: chrome.currentUser.status,
      }
    : null, {
      limit: MAX_COMMUNITY_LEADERBOARD_LIMIT,
    })

  return (
    <LeaderboardPageShell
      eyebrow="Check-in Leaderboard"
      title="签到排行榜"
      description="按累计签到天数降序排列；累计天数相同时，当前连续签到更高的用户排在前面。"
      totalUsers={leaderboard.totalUsers}
      entries={leaderboard.entries}
      currentUserEntry={leaderboard.currentUserEntry}
      currentUserHint={chrome.currentUser ? "你当前还未进入签到排行榜，完成签到后会自动参与排名。" : "登录后可查看你的个人名次。"}
      emptyText="暂时还没有可展示的签到排行数据。"
      primaryHref="/"
      primaryLabel="返回首页"
      secondaryHref="/settings?tab=level"
      secondaryLabel="成长进度"
      scoreColumnLabel="累计签到"
      tabs={[
        { href: "/leaderboards/points", label: `${chrome.settings.pointName}榜` },
        { href: "/leaderboards/check-in", label: "签到榜", active: true },
      ]}
      chrome={chrome}
      renderMetric={(entry) => (
        <span title={`连签 ${formatNumber(entry.currentCheckInStreak)} 天 · 最长 ${formatNumber(entry.maxCheckInStreak)} 天`}>
          连签 {formatCompactNumber(entry.currentCheckInStreak)} 天 · 最长 {formatCompactNumber(entry.maxCheckInStreak)} 天
        </span>
      )}
      renderMetricValue={(entry) => `${formatCompactNumber(entry.checkInDays)} 天`}
      renderMeta={(entry) => <span title={`最长 ${formatNumber(entry.maxCheckInStreak)} 天`}>最长 {formatCompactNumber(entry.maxCheckInStreak)} 天</span>}
    />
  )
}
