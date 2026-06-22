import "server-only"

import IP2RegionExport from "ip2region"
import type { IP2RegionResult } from "ip2region"

import { formatIpLocationLabel, normalizePublicIpForLocation } from "@/lib/ip-location-format"

type IP2RegionClient = {
  search(ipaddr: string): IP2RegionResult | null
}

type IP2RegionConstructor = new () => IP2RegionClient

const IP2Region = (
  (IP2RegionExport as unknown as { default?: IP2RegionConstructor }).default
  ?? IP2RegionExport
) as unknown as IP2RegionConstructor

let ip2RegionClient: IP2RegionClient | null = null

function getIp2RegionClient() {
  ip2RegionClient ??= new IP2Region()
  return ip2RegionClient
}

export function resolveIpLocationLabel(ip: string | null | undefined) {
  const normalizedIp = normalizePublicIpForLocation(ip)

  if (!normalizedIp) {
    return null
  }

  try {
    return formatIpLocationLabel(getIp2RegionClient().search(normalizedIp))
  } catch (error) {
    console.error("IP location lookup failed", error)
    return null
  }
}
