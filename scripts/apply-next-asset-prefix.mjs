import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const projectRoot = process.cwd()
const nextDir = path.join(projectRoot, ".next")
const marker = "https://rhex-runtime-asset-prefix.invalid"
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".mjs",
  ".txt",
])

const normalizeAssetPrefix = (value) => {
  const trimmedValue = value?.trim()

  if (!trimmedValue) {
    return ""
  }

  return trimmedValue.replace(/\/+$/, "")
}

const assetPrefix = normalizeAssetPrefix(process.env.NEXT_ASSET_PREFIX)

if (assetPrefix === marker) {
  console.error(
    `[asset-prefix] NEXT_ASSET_PREFIX must not be the internal marker ${marker}`,
  )
  process.exit(1)
}

const replaceInFile = async (filePath) => {
  const content = await readFile(filePath, "utf8")

  if (!content.includes(marker)) {
    return 0
  }

  const parts = content.split(marker)
  const nextContent = parts.join(assetPrefix)
  await writeFile(filePath, nextContent)

  return parts.length - 1
}

const walk = async (dirPath) => {
  let replacementCount = 0
  const entries = await readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      replacementCount += await walk(entryPath)
      continue
    }

    if (!entry.isFile() || !textExtensions.has(path.extname(entry.name))) {
      continue
    }

    replacementCount += await replaceInFile(entryPath)
  }

  return replacementCount
}

try {
  const replacementCount = await walk(nextDir)

  if (replacementCount > 0) {
    console.log(
      `[asset-prefix] Applied NEXT_ASSET_PREFIX=${assetPrefix || "(empty)"} to ${replacementCount} build references.`,
    )
  } else if (assetPrefix) {
    console.warn(
      "[asset-prefix] No build placeholders found. The image may have been built without runtime asset-prefix support.",
    )
  }
} catch (error) {
  if (error?.code === "ENOENT") {
    console.warn("[asset-prefix] .next directory not found; skipping.")
  } else {
    console.error("[asset-prefix] Failed to apply runtime asset prefix.")
    console.error(error)
    process.exit(1)
  }
}
