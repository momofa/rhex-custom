import type { UserProfileRadarData } from "@/lib/user-profile-radar"
import { cn } from "@/lib/utils"

interface UserProfileRadarPanelProps {
  data: UserProfileRadarData
  className?: string
  variant?: "default" | "preview-card"
}

function getRadarPoint(index: number, total: number, distance: number, center: number) {
  const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / total)

  return {
    x: center + (Math.cos(angle) * distance),
    y: center + (Math.sin(angle) * distance),
    angle,
  }
}

function toPoints(values: Array<{ x: number; y: number }>) {
  return values.map((value) => `${value.x},${value.y}`).join(" ")
}

export function UserProfileRadarPanel({
  data,
  className,
  variant = "default",
}: UserProfileRadarPanelProps) {
  const isPreviewCard = variant === "preview-card"
  const size = 198
  const center = size / 2
  const radius = isPreviewCard ? 74 : 56
  const labelRadius = isPreviewCard ? 80 : 62
  const ringLevels = 4
  const total = data.dimensions.length

  const axisPoints = data.dimensions.map((dimension, index) => ({
    ...dimension,
    ...getRadarPoint(index, total, radius, center),
  }))

  const labelPoints = data.dimensions.map((dimension, index) => ({
    ...dimension,
    ...getRadarPoint(index, total, labelRadius, center),
  }))

  const valuePoints = data.dimensions.map((dimension, index) => getRadarPoint(index, total, (dimension.score / 10) * radius, center))

  return (
    <div className={cn("flex h-full items-center justify-center", className)}>
      <div className="mx-auto w-[164px] max-w-full">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full overflow-visible">
          {Array.from({ length: ringLevels }, (_, index) => {
            const ringRadius = radius * ((index + 1) / ringLevels)
            const ringPoints = data.dimensions.map((_, pointIndex) => getRadarPoint(pointIndex, total, ringRadius, center))

            return (
              <polygon
                key={`ring-${ringRadius}`}
                points={toPoints(ringPoints)}
                className={cn(
                  "stroke-border",
                  index === ringLevels - 1 ? "fill-muted/35" : "fill-transparent",
                )}
                strokeWidth={0.9}
              />
            )
          })}

          {axisPoints.map((point) => (
            <line
              key={`axis-${point.key}`}
              x1={center}
              y1={center}
              x2={point.x}
              y2={point.y}
              className="stroke-border"
              strokeWidth={0.9}
            />
          ))}

          <polygon
            points={toPoints(valuePoints)}
            className="fill-foreground/8 stroke-foreground"
            strokeWidth={1.5}
          />

          {valuePoints.map((point, index) => (
            <circle
              key={`value-${data.dimensions[index]?.key ?? index}`}
              cx={point.x}
              cy={point.y}
              r={3}
              className="fill-background stroke-foreground"
              strokeWidth={1.4}
            />
          ))}

          <circle cx={center} cy={center} r={6} className="fill-background stroke-border" strokeWidth={0.9} />

          {labelPoints.map((point) => {
            const anchor = Math.abs(Math.cos(point.angle)) < 0.2
              ? "middle"
              : Math.cos(point.angle) > 0
                ? "start"
                : "end"
            const verticalOffset = Math.sin(point.angle) > 0.85
              ? 8
              : Math.sin(point.angle) < -0.85
                ? -3
                : 2

            return (
              <text
                key={`label-${point.key}`}
                x={point.x}
                y={point.y + verticalOffset}
                textAnchor={anchor}
                className={cn(
                  "fill-muted-foreground font-semibold",
                  isPreviewCard ? "text-[9px]" : "text-[10px]",
                )}
              >
                {point.label} {point.displayScore}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
