import { isIP } from "node:net"

import { normalizeIp } from "@/lib/request-ip"

export interface IpLocationRegionResult {
  country?: string | null
  province?: string | null
  city?: string | null
  isp?: string | null
}

const EMPTY_LOCATION_VALUES = new Set(["", "0", "未知", "内网IP", "局域网"])
const CHINA_COUNTRY_NAMES = new Set(["中国", "中国大陆", "中华人民共和国"])

const CHINA_PROVINCE_LABELS: Record<string, string> = {
  北京市: "北京",
  天津市: "天津",
  上海市: "上海",
  重庆市: "重庆",
  河北省: "河北",
  山西省: "山西",
  辽宁省: "辽宁",
  吉林省: "吉林",
  黑龙江省: "黑龙江",
  江苏省: "江苏",
  浙江省: "浙江",
  安徽省: "安徽",
  福建省: "福建",
  江西省: "江西",
  山东省: "山东",
  河南省: "河南",
  湖北省: "湖北",
  湖南省: "湖南",
  广东省: "广东",
  海南省: "海南",
  四川省: "四川",
  贵州省: "贵州",
  云南省: "云南",
  陕西省: "陕西",
  甘肃省: "甘肃",
  青海省: "青海",
  台湾省: "台湾",
  内蒙古自治区: "内蒙古",
  广西壮族自治区: "广西",
  西藏自治区: "西藏",
  宁夏回族自治区: "宁夏",
  新疆维吾尔自治区: "新疆",
  香港特别行政区: "香港",
  澳门特别行政区: "澳门",
}

function cleanLocationPart(value: string | null | undefined) {
  const normalized = (value ?? "").trim().replace(/\s+/g, "")
  return EMPTY_LOCATION_VALUES.has(normalized) ? "" : normalized
}

function normalizeChinaProvinceLabel(value: string | null | undefined) {
  const province = cleanLocationPart(value)

  if (!province) {
    return ""
  }

  return CHINA_PROVINCE_LABELS[province]
    ?? province
      .replace(/特别行政区$/, "")
      .replace(/维吾尔自治区$/, "")
      .replace(/壮族自治区$/, "")
      .replace(/回族自治区$/, "")
      .replace(/自治区$/, "")
      .replace(/省$/, "")
      .replace(/市$/, "")
}

function ipv4ToNumber(ip: string) {
  return ip.split(".").reduce((result, segment) => (result * 256) + Number(segment), 0) >>> 0
}

function ipv4InCidr(ip: number, base: string, prefix: number) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return (ip & mask) === (ipv4ToNumber(base) & mask)
}

function isReservedIpv4(ip: string) {
  const value = ipv4ToNumber(ip)

  return [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ].some(([base, prefix]) => ipv4InCidr(value, base as string, prefix as number))
}

function isReservedIpv6(ip: string) {
  const firstHextet = Number.parseInt(ip.split(":")[0] || "0", 16)

  return ip === "::"
    || ip === "::1"
    || (firstHextet & 0xfe00) === 0xfc00
    || (firstHextet & 0xffc0) === 0xfe80
    || (firstHextet & 0xff00) === 0xff00
    || ip === "2001:db8::"
    || ip.startsWith("2001:db8:")
}

export function normalizePublicIpForLocation(value: string | null | undefined) {
  const normalized = normalizeIp(value ?? null)

  if (!normalized) {
    return null
  }

  const ipv4MappedMatch = normalized.match(/^::ffff:((?:\d{1,3}\.){3}\d{1,3})$/)
  const candidate = ipv4MappedMatch ? ipv4MappedMatch[1] : normalized
  const version = isIP(candidate)

  if (version === 4) {
    return isReservedIpv4(candidate) ? null : candidate
  }

  if (version === 6) {
    return isReservedIpv6(candidate) ? null : candidate
  }

  return null
}

export function formatIpLocationLabel(region: IpLocationRegionResult | null | undefined) {
  if (!region) {
    return null
  }

  const country = cleanLocationPart(region.country)
  const province = normalizeChinaProvinceLabel(region.province)

  if (CHINA_COUNTRY_NAMES.has(country)) {
    return province || null
  }

  if (country) {
    return country
  }

  return province || null
}
