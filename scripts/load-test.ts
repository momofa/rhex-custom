import { writeFile } from "node:fs/promises"
import { performance } from "node:perf_hooks"

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS"

type TargetConfig = {
  name: string
  method: HttpMethod
  path: string
  weight: number
}

type CliOptions = {
  baseUrl: string
  concurrency: number
  durationMs: number
  requestLimit: number | null
  warmupMs: number
  timeoutMs: number
  targets: TargetConfig[]
  headers: Record<string, string>
  json: boolean
  outputPath: string | null
  failErrorRate: number | null
  failP95Ms: number | null
}

type TargetCounters = {
  name: string
  method: HttpMethod
  path: string
  weight: number
  requests: number
  ok: number
  failed: number
  bytes: number
  latencies: number[]
  statusCounts: Map<string, number>
  errorCounts: Map<string, number>
}

type Recorder = {
  startedAt: number
  finishedAt: number
  requests: number
  ok: number
  failed: number
  bytes: number
  latencies: number[]
  statusCounts: Map<string, number>
  errorCounts: Map<string, number>
  targets: Map<string, TargetCounters>
}

type SerializableSummary = {
  baseUrl: string
  concurrency: number
  durationMs: number
  configuredDurationMs: number | null
  requestLimit: number | null
  warmupMs: number
  timeoutMs: number
  requests: number
  ok: number
  failed: number
  errorRate: number
  rps: number
  bytes: number
  latencyMs: LatencySummary
  statusCounts: Record<string, number>
  errorCounts: Record<string, number>
  targets: Array<{
    name: string
    method: HttpMethod
    path: string
    weight: number
    requests: number
    ok: number
    failed: number
    errorRate: number
    rps: number
    bytes: number
    latencyMs: LatencySummary
    statusCounts: Record<string, number>
    errorCounts: Record<string, number>
  }>
}

type LatencySummary = {
  avg: number
  min: number
  p50: number
  p90: number
  p95: number
  p99: number
  max: number
}

const DEFAULT_TARGETS: TargetConfig[] = [
  { name: "home", method: "GET", path: "/", weight: 3 },
  { name: "new", method: "GET", path: "/new", weight: 2 },
  { name: "hot", method: "GET", path: "/hot", weight: 2 },
  { name: "feed-page-2", method: "GET", path: "/api/feed?sort=latest&page=2", weight: 3 },
  { name: "rss-universe", method: "GET", path: "/api/rss-universe", weight: 2 },
  { name: "layout-addons", method: "GET", path: "/api/addons/global-layout-slots?pathname=%2F", weight: 1 },
]

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
  "User-Agent": "rhex-local-load-test/1.0",
}

function printHelp() {
  console.log(`Local concurrency test tool

Usage:
  pnpm load:test -- [options]

Options:
  --url <url>                 Base URL. Default: http://localhost:3000
  --concurrency <n>           Concurrent workers. Default: 20
  --duration <time>           Measured duration, e.g. 30s, 2m. Default: 30s
  --requests <n>              Stop after this many measured requests
  --warmup <time>             Warmup duration before measuring. Default: 5s
  --timeout <time>            Per-request timeout, e.g. 8000ms, 8s. Default: 10000ms
  --target <target>           Repeatable. Path or name=METHOD:/path@weight
  --header "Key: Value"       Repeatable request header
  --cookie <cookie>           Cookie header for logged-in flows
  --json                      Print JSON only
  --output <file>             Write JSON summary to a file
  --fail-error-rate <pct>     Exit 1 when error rate is higher than this percent
  --fail-p95 <ms>             Exit 1 when global p95 latency is higher than this
  --help                      Show this help

Default targets:
${DEFAULT_TARGETS.map((target) => `  ${target.name}=${target.method}:${target.path}@${target.weight}`).join("\n")}

Examples:
  pnpm load:test -- --url http://localhost:3000 --concurrency 50 --duration 60s
  pnpm load:test -- --requests 2000 --target "feed=GET:/api/feed?sort=latest&page=2@5"
  pnpm load:test -- --cookie "session=..." --target "home=GET:/@1"
`)
}

function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = {
    baseUrl: "http://localhost:3000",
    concurrency: 20,
    durationMs: 30_000,
    requestLimit: null,
    warmupMs: 5_000,
    timeoutMs: 10_000,
    targets: [],
    headers: { ...DEFAULT_HEADERS },
    json: false,
    outputPath: null,
    failErrorRate: null,
    failP95Ms: null,
  }
  let durationWasSet = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    }

    if (arg === "--json") {
      options.json = true
      continue
    }

    const value = argv[index + 1]
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`)
    }

    switch (arg) {
      case "--url":
      case "--base-url":
        options.baseUrl = normalizeBaseUrl(value)
        index += 1
        break
      case "--concurrency":
      case "-c":
        options.concurrency = parsePositiveInteger(value, arg)
        index += 1
        break
      case "--duration":
      case "-d":
        options.durationMs = parseDuration(value, "s", arg)
        durationWasSet = true
        index += 1
        break
      case "--requests":
      case "-n":
        options.requestLimit = parsePositiveInteger(value, arg)
        index += 1
        break
      case "--warmup":
        options.warmupMs = parseDuration(value, "s", arg, { allowZero: true })
        index += 1
        break
      case "--timeout":
        options.timeoutMs = parseDuration(value, "ms", arg)
        index += 1
        break
      case "--target":
        options.targets.push(parseTarget(value))
        index += 1
        break
      case "--header": {
        const header = parseHeader(value)
        options.headers[header.key] = header.value
        index += 1
        break
      }
      case "--cookie":
        options.headers.Cookie = value
        index += 1
        break
      case "--output":
        options.outputPath = value
        index += 1
        break
      case "--fail-error-rate":
        options.failErrorRate = parseNonNegativeNumber(value, arg)
        index += 1
        break
      case "--fail-p95":
        options.failP95Ms = parseNonNegativeNumber(value, arg)
        index += 1
        break
      default:
        throw new Error(`Unknown option: ${arg}`)
    }
  }

  if (options.requestLimit !== null && !durationWasSet) {
    options.durationMs = Number.POSITIVE_INFINITY
  }

  if (options.targets.length === 0) {
    options.targets = DEFAULT_TARGETS
  }

  if (options.concurrency > 1_000) {
    throw new Error("--concurrency is capped at 1000 to avoid exhausting the local machine")
  }

  validateTargets(options.targets)

  return options
}

function normalizeBaseUrl(value: string) {
  const url = new URL(value)
  url.pathname = url.pathname.replace(/\/+$/, "")
  url.search = ""
  url.hash = ""
  return url.toString().replace(/\/$/, "")
}

function parseDuration(
  raw: string,
  defaultUnit: "ms" | "s",
  optionName: string,
  settings: { allowZero?: boolean } = {},
) {
  const match = raw.trim().match(/^(\d+(?:\.\d+)?)(ms|s|m)?$/)
  if (!match) {
    throw new Error(`${optionName} must be a duration like 500ms, 30s, or 2m`)
  }

  const amount = Number(match[1])
  const unit = match[2] ?? defaultUnit
  const multiplier = unit === "ms" ? 1 : unit === "s" ? 1_000 : 60_000
  const value = amount * multiplier

  if (!Number.isFinite(value) || value < 0 || (!settings.allowZero && value === 0)) {
    throw new Error(`${optionName} must be ${settings.allowZero ? "non-negative" : "positive"}`)
  }

  return value
}

function parsePositiveInteger(raw: string, optionName: string) {
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${optionName} must be a positive integer`)
  }
  return value
}

function parseNonNegativeNumber(raw: string, optionName: string) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${optionName} must be a non-negative number`)
  }
  return value
}

function parseHeader(raw: string) {
  const separatorIndex = raw.indexOf(":")
  if (separatorIndex <= 0) {
    throw new Error("--header must use the format \"Key: Value\"")
  }

  return {
    key: raw.slice(0, separatorIndex).trim(),
    value: raw.slice(separatorIndex + 1).trim(),
  }
}

function parseTarget(raw: string): TargetConfig {
  let value = raw.trim()
  let weight = 1

  const weightSeparator = value.lastIndexOf("@")
  if (weightSeparator > 0) {
    const maybeWeight = value.slice(weightSeparator + 1)
    if (/^\d+$/.test(maybeWeight)) {
      weight = parsePositiveInteger(maybeWeight, "target weight")
      value = value.slice(0, weightSeparator)
    }
  }

  let name: string | null = null
  const nameSeparator = value.indexOf("=")
  const methodSeparator = value.indexOf(":")
  if (
    nameSeparator > 0
    && !value.startsWith("/")
    && (methodSeparator === -1 || nameSeparator < methodSeparator)
  ) {
    name = value.slice(0, nameSeparator).trim()
    value = value.slice(nameSeparator + 1).trim()
  }

  let method: HttpMethod = "GET"
  const methodMatch = value.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS):(.+)$/i)
  if (methodMatch) {
    method = methodMatch[1].toUpperCase() as HttpMethod
    value = methodMatch[2]
  }

  if (!value.startsWith("/")) {
    throw new Error(`Target path must start with "/": ${raw}`)
  }

  return {
    name: name && name.length > 0 ? name : targetNameFromPath(value),
    method,
    path: value,
    weight,
  }
}

function targetNameFromPath(path: string) {
  const withoutQuery = path.split("?")[0] ?? path
  const name = withoutQuery.replace(/^\/+/, "").replace(/\/+$/, "").replaceAll("/", "-")
  return name.length > 0 ? name : "home"
}

function validateTargets(targets: TargetConfig[]) {
  const names = new Set<string>()
  for (const target of targets) {
    if (target.weight <= 0) {
      throw new Error(`Target ${target.name} must have a positive weight`)
    }
    if (names.has(target.name)) {
      throw new Error(`Duplicate target name: ${target.name}`)
    }
    names.add(target.name)
  }
}

function createRecorder(targets: TargetConfig[]): Recorder {
  return {
    startedAt: performance.now(),
    finishedAt: performance.now(),
    requests: 0,
    ok: 0,
    failed: 0,
    bytes: 0,
    latencies: [],
    statusCounts: new Map<string, number>(),
    errorCounts: new Map<string, number>(),
    targets: new Map(
      targets.map((target) => [
        target.name,
        {
          name: target.name,
          method: target.method,
          path: target.path,
          weight: target.weight,
          requests: 0,
          ok: 0,
          failed: 0,
          bytes: 0,
          latencies: [],
          statusCounts: new Map<string, number>(),
          errorCounts: new Map<string, number>(),
        },
      ]),
    ),
  }
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function recordSample(
  recorder: Recorder,
  target: TargetConfig,
  sample: { ok: boolean; durationMs: number; bytes: number; status?: number; error?: string },
) {
  recorder.requests += 1
  recorder.bytes += sample.bytes
  recorder.latencies.push(sample.durationMs)

  const targetCounters = recorder.targets.get(target.name)
  if (!targetCounters) {
    throw new Error(`Missing target counters for ${target.name}`)
  }

  targetCounters.requests += 1
  targetCounters.bytes += sample.bytes
  targetCounters.latencies.push(sample.durationMs)

  if (sample.ok) {
    recorder.ok += 1
    targetCounters.ok += 1
  } else {
    recorder.failed += 1
    targetCounters.failed += 1
  }

  if (typeof sample.status === "number") {
    const status = String(sample.status)
    increment(recorder.statusCounts, status)
    increment(targetCounters.statusCounts, status)
  }

  if (sample.error) {
    increment(recorder.errorCounts, sample.error)
    increment(targetCounters.errorCounts, sample.error)
  }
}

function createWeightedPicker(targets: TargetConfig[]) {
  const cumulative: Array<{ target: TargetConfig; ceiling: number }> = []
  let total = 0

  for (const target of targets) {
    total += target.weight
    cumulative.push({ target, ceiling: total })
  }

  return () => {
    const value = Math.random() * total
    const selected = cumulative.find((entry) => value < entry.ceiling)
    return selected?.target ?? targets[targets.length - 1]
  }
}

async function runPhase({
  options,
  record,
  durationMs,
  requestLimit,
}: {
  options: CliOptions
  record: boolean
  durationMs: number
  requestLimit: number | null
}) {
  const recorder = createRecorder(options.targets)
  const pickTarget = createWeightedPicker(options.targets)
  const phaseStartedAt = performance.now()
  const stopAt = phaseStartedAt + durationMs
  let claimedRequests = 0

  function claimRequest() {
    if (requestLimit !== null && claimedRequests >= requestLimit) {
      return false
    }
    if (performance.now() >= stopAt) {
      return false
    }
    claimedRequests += 1
    return true
  }

  async function worker() {
    while (claimRequest()) {
      const target = pickTarget()
      const sample = await requestTarget(options, target)
      if (record) {
        recordSample(recorder, target, sample)
      }
    }
  }

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()))
  recorder.startedAt = phaseStartedAt
  recorder.finishedAt = performance.now()
  return recorder
}

async function requestTarget(options: CliOptions, target: TargetConfig) {
  const url = new URL(target.path, options.baseUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs)
  const startedAt = performance.now()

  try {
    const response = await fetch(url, {
      method: target.method,
      headers: options.headers,
      signal: controller.signal,
    })
    const body = await response.arrayBuffer()
    const durationMs = performance.now() - startedAt

    return {
      ok: response.status >= 200 && response.status < 400,
      durationMs,
      bytes: body.byteLength,
      status: response.status,
    }
  } catch (error) {
    const durationMs = performance.now() - startedAt
    return {
      ok: false,
      durationMs,
      bytes: 0,
      error: normalizeError(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "timeout"
    }
    return error.message || error.name
  }
  return String(error)
}

function summarize(options: CliOptions, recorder: Recorder): SerializableSummary {
  const durationMs = recorder.finishedAt - recorder.startedAt
  const durationSeconds = durationMs / 1_000

  return {
    baseUrl: options.baseUrl,
    concurrency: options.concurrency,
    durationMs: round(durationMs, 1),
    configuredDurationMs: Number.isFinite(options.durationMs) ? options.durationMs : null,
    requestLimit: options.requestLimit,
    warmupMs: options.warmupMs,
    timeoutMs: options.timeoutMs,
    requests: recorder.requests,
    ok: recorder.ok,
    failed: recorder.failed,
    errorRate: ratio(recorder.failed, recorder.requests),
    rps: round(recorder.requests / durationSeconds, 2),
    bytes: recorder.bytes,
    latencyMs: summarizeLatencies(recorder.latencies),
    statusCounts: mapToObject(recorder.statusCounts),
    errorCounts: mapToObject(recorder.errorCounts),
    targets: Array.from(recorder.targets.values()).map((target) => ({
      name: target.name,
      method: target.method,
      path: target.path,
      weight: target.weight,
      requests: target.requests,
      ok: target.ok,
      failed: target.failed,
      errorRate: ratio(target.failed, target.requests),
      rps: round(target.requests / durationSeconds, 2),
      bytes: target.bytes,
      latencyMs: summarizeLatencies(target.latencies),
      statusCounts: mapToObject(target.statusCounts),
      errorCounts: mapToObject(target.errorCounts),
    })),
  }
}

function summarizeLatencies(values: number[]): LatencySummary {
  if (values.length === 0) {
    return { avg: 0, min: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0 }
  }

  const sorted = values.toSorted((left, right) => left - right)
  const total = sorted.reduce((sum, value) => sum + value, 0)

  return {
    avg: round(total / sorted.length, 1),
    min: round(sorted[0], 1),
    p50: round(percentile(sorted, 0.5), 1),
    p90: round(percentile(sorted, 0.9), 1),
    p95: round(percentile(sorted, 0.95), 1),
    p99: round(percentile(sorted, 0.99), 1),
    max: round(sorted[sorted.length - 1], 1),
  }
}

function percentile(sortedValues: number[], percentileValue: number) {
  if (sortedValues.length === 1) {
    return sortedValues[0]
  }

  const index = Math.ceil(percentileValue * sortedValues.length) - 1
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))]
}

function ratio(part: number, total: number) {
  return total === 0 ? 0 : round((part / total) * 100, 2)
}

function round(value: number, digits: number) {
  if (!Number.isFinite(value)) {
    return 0
  }
  const multiplier = 10 ** digits
  return Math.round(value * multiplier) / multiplier
}

function mapToObject(map: Map<string, number>) {
  return Object.fromEntries(Array.from(map.entries()).sort(([left], [right]) => left.localeCompare(right)))
}

function formatSummary(summary: SerializableSummary) {
  const lines: string[] = []
  lines.push("")
  lines.push("Local load test summary")
  lines.push(`Base URL: ${summary.baseUrl}`)
  lines.push(`Concurrency: ${summary.concurrency}`)
  lines.push(`Duration: ${formatDuration(summary.durationMs)}`)
  lines.push(
    `Requests: ${summary.requests} total, ${summary.ok} ok, ${summary.failed} failed, ${summary.errorRate}% error`,
  )
  lines.push(`Throughput: ${summary.rps} req/s, ${formatBytes(summary.bytes)} transferred`)
  lines.push(
    `Latency ms: avg ${summary.latencyMs.avg}, p50 ${summary.latencyMs.p50}, p90 ${summary.latencyMs.p90}, p95 ${summary.latencyMs.p95}, p99 ${summary.latencyMs.p99}, max ${summary.latencyMs.max}`,
  )
  lines.push(`Status: ${formatCounts(summary.statusCounts)}`)

  if (Object.keys(summary.errorCounts).length > 0) {
    lines.push(`Errors: ${formatCounts(summary.errorCounts)}`)
  }

  lines.push("")
  lines.push(formatTargetTable(summary))
  return lines.join("\n")
}

function formatTargetTable(summary: SerializableSummary) {
  const rows = summary.targets.map((target) => [
    target.name,
    `${target.method} ${target.path}`,
    String(target.requests),
    `${target.errorRate}%`,
    String(target.rps),
    String(target.latencyMs.avg),
    String(target.latencyMs.p95),
    String(target.latencyMs.p99),
    formatCounts(target.statusCounts),
  ])

  return formatTable(["target", "route", "req", "err", "rps", "avg", "p95", "p99", "status"], rows)
}

function formatTable(headers: string[], rows: string[][]) {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)),
  )
  const formatRow = (row: string[]) => row.map((cell, index) => cell.padEnd(widths[index])).join("  ")
  return [formatRow(headers), formatRow(widths.map((width) => "-".repeat(width))), ...rows.map(formatRow)].join("\n")
}

function formatCounts(counts: Record<string, number>) {
  const entries = Object.entries(counts)
  if (entries.length === 0) {
    return "-"
  }
  return entries.map(([key, value]) => `${key}:${value}`).join(", ")
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${round(bytes / 1024, 1)} KiB`
  }
  return `${round(bytes / 1024 / 1024, 1)} MiB`
}

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) {
    return `${round(durationMs, 1)}ms`
  }
  return `${round(durationMs / 1_000, 1)}s`
}

function checkThresholds(options: CliOptions, summary: SerializableSummary) {
  const failures: string[] = []

  if (options.failErrorRate !== null && summary.errorRate > options.failErrorRate) {
    failures.push(`error rate ${summary.errorRate}% > ${options.failErrorRate}%`)
  }

  if (options.failP95Ms !== null && summary.latencyMs.p95 > options.failP95Ms) {
    failures.push(`p95 ${summary.latencyMs.p95}ms > ${options.failP95Ms}ms`)
  }

  if (summary.requests === 0) {
    failures.push("no requests completed")
  }

  return failures
}

async function main() {
  const options = parseCli(process.argv.slice(2))

  if (!options.json) {
    console.log(`Base URL: ${options.baseUrl}`)
    console.log(`Targets: ${options.targets.map((target) => `${target.name}@${target.weight}`).join(", ")}`)
    if (options.warmupMs > 0) {
      console.log(`Warmup: ${formatDuration(options.warmupMs)}`)
    }
    console.log(
      `Measured run: ${options.requestLimit === null ? formatDuration(options.durationMs) : `${options.requestLimit} requests`}, concurrency ${options.concurrency}`,
    )
  }

  if (options.warmupMs > 0) {
    await runPhase({
      options,
      record: false,
      durationMs: options.warmupMs,
      requestLimit: null,
    })
  }

  const progressStartedAt = performance.now()
  const progress = options.json
    ? null
    : setInterval(() => {
        const elapsedSeconds = (performance.now() - progressStartedAt) / 1_000
        process.stdout.write(`\rRunning ${round(elapsedSeconds, 0)}s...`)
      }, 1_000)

  const recorder = await runPhase({
    options,
    record: true,
    durationMs: options.durationMs,
    requestLimit: options.requestLimit,
  })

  if (progress) {
    clearInterval(progress)
    process.stdout.write("\r")
  }

  const summary = summarize(options, recorder)
  const json = JSON.stringify(summary, null, 2)

  if (options.outputPath) {
    await writeFile(options.outputPath, `${json}\n`, "utf8")
  }

  if (options.json) {
    console.log(json)
  } else {
    console.log(formatSummary(summary))
    if (options.outputPath) {
      console.log(`\nJSON summary written to ${options.outputPath}`)
    }
  }

  const thresholdFailures = checkThresholds(options, summary)
  if (thresholdFailures.length > 0) {
    if (!options.json) {
      console.error(`\nThreshold failed: ${thresholdFailures.join("; ")}`)
    }
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
