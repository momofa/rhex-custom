"use client"

interface AvatarCropArea {
  x: number
  y: number
  width: number
  height: number
}

function resolveAvatarOutputMimeType(mimeType?: string) {
  return mimeType === "image/png" || mimeType === "image/webp" ? mimeType : "image/jpeg"
}

function resolveAvatarOutputExtension(mimeType: string) {
  if (mimeType === "image/png") {
    return "png"
  }

  if (mimeType === "image/webp") {
    return "webp"
  }

  return "jpg"
}

function resolveAvatarOutputBackground(mimeType: string) {
  return mimeType === "image/jpeg" ? "#ffffff" : "transparent"
}

async function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("头像图片加载失败，请重新选择图片"))
    image.src = src
  })
}

async function renderAvatarCropBlob(params: {
  imageSrc: string
  cropArea: AvatarCropArea
  outputSize?: number
  mimeType?: string
  quality?: number
}) {
  const image = await loadImage(params.imageSrc)
  const outputSize = params.outputSize ?? 512
  const mimeType = resolveAvatarOutputMimeType(params.mimeType)
  const quality = typeof params.quality === "number" ? params.quality : 0.92
  const canvas = document.createElement("canvas")

  canvas.width = outputSize
  canvas.height = outputSize

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("浏览器暂不支持头像裁剪")
  }

  context.clearRect(0, 0, outputSize, outputSize)
  context.fillStyle = resolveAvatarOutputBackground(mimeType)
  context.fillRect(0, 0, outputSize, outputSize)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"

  const sourceLeft = params.cropArea.x
  const sourceTop = params.cropArea.y
  const sourceRight = sourceLeft + params.cropArea.width
  const sourceBottom = sourceTop + params.cropArea.height
  const clampedLeft = Math.max(0, sourceLeft)
  const clampedTop = Math.max(0, sourceTop)
  const clampedRight = Math.min(image.naturalWidth, sourceRight)
  const clampedBottom = Math.min(image.naturalHeight, sourceBottom)
  const drawableWidth = clampedRight - clampedLeft
  const drawableHeight = clampedBottom - clampedTop

  if (drawableWidth <= 0 || drawableHeight <= 0) {
    throw new Error("头像裁剪失败，请重新尝试")
  }

  const scaleX = outputSize / params.cropArea.width
  const scaleY = outputSize / params.cropArea.height
  const destinationX = (clampedLeft - sourceLeft) * scaleX
  const destinationY = (clampedTop - sourceTop) * scaleY
  const destinationWidth = drawableWidth * scaleX
  const destinationHeight = drawableHeight * scaleY

  context.drawImage(
    image,
    clampedLeft,
    clampedTop,
    drawableWidth,
    drawableHeight,
    destinationX,
    destinationY,
    destinationWidth,
    destinationHeight,
  )

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("头像裁剪失败，请重新尝试"))
        return
      }

      resolve(blob)
    }, mimeType, quality)
  })
}

export async function createAvatarCropPreviewUrl(params: {
  imageSrc: string
  cropArea: AvatarCropArea
  mimeType?: string
}) {
  const blob = await renderAvatarCropBlob(params)
  return URL.createObjectURL(blob)
}

export async function createAvatarCroppedFile(params: {
  imageSrc: string
  cropArea: AvatarCropArea
  fileName?: string
  mimeType?: string
}) {
  const mimeType = resolveAvatarOutputMimeType(params.mimeType)
  const blob = await renderAvatarCropBlob({
    imageSrc: params.imageSrc,
    cropArea: params.cropArea,
    mimeType,
  })
  const extension = resolveAvatarOutputExtension(mimeType)
  const baseName = (params.fileName ?? "avatar").replace(/\.[^.]+$/, "") || "avatar"

  return new File([blob], `${baseName}.${extension}`, {
    type: mimeType,
    lastModified: Date.now(),
  })
}
