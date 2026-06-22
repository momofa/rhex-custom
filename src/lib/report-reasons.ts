export const REPORT_REASON_OPTIONS = [
  "垃圾广告",
  "骚扰辱骂",
  "违规内容",
  "侵权抄袭",
  "色情低俗",
  "诈骗引流",
  "人身攻击",
  "其他",
] as const

export type ReportReasonType = (typeof REPORT_REASON_OPTIONS)[number]
