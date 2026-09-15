'use client'

import { useId } from 'react'

interface Point {
  date: string
  stamps: number
  joins: number
}

/**
 * Daily activity.
 *
 * Hand-drawn SVG rather than a charting library: this is two series over thirty days,
 * and shipping a 90 KB dependency to draw it would be the wrong trade. Stamps are the
 * area (the volume that matters), joins are the line (the growth signal).
 */
export function ActivityChart({ data }: { data: Point[] }) {
  const gradientId = useId()
  if (data.length === 0) return null

  const width = 720
  const height = 180
  const padding = { top: 12, right: 4, bottom: 22, left: 4 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  const maxValue = Math.max(1, ...data.map((point) => Math.max(point.stamps, point.joins)))
  const stepX = innerWidth / Math.max(1, data.length - 1)

  const toX = (index: number) => padding.left + index * stepX
  const toY = (value: number) => padding.top + innerHeight - (value / maxValue) * innerHeight

  const stampPath = data
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.stamps)}`)
    .join(' ')
  const areaPath = `${stampPath} L ${toX(data.length - 1)} ${padding.top + innerHeight} L ${toX(0)} ${padding.top + innerHeight} Z`
  const joinPath = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.joins)}`).join(' ')

  // Label only the ends and the middle; a tick per day is unreadable at this width.
  const labelIndexes = [0, Math.floor(data.length / 2), data.length - 1]

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[180px] w-full"
        role="img"
        aria-label={`Sellos y altas por día. Máximo ${maxValue} en un día.`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={stampPath}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d={joinPath}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.75"
          strokeDasharray="4 4"
          strokeLinejoin="round"
        />

        {labelIndexes.map((index) => {
          const point = data[index]
          if (!point) return null
          const date = new Date(`${point.date}T00:00:00`)
          return (
            <text
              key={point.date}
              x={toX(index)}
              y={height - 6}
              textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
              className="fill-[var(--color-ink-muted)] text-[11px]"
            >
              {date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
            </text>
          )
        })}
      </svg>

      <figcaption className="mt-2 flex gap-4 text-[13px] text-[var(--color-ink-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[var(--color-primary)]" aria-hidden="true" />
          Sellos
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-4 rounded"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, var(--color-accent) 0 4px, transparent 4px 8px)',
            }}
            aria-hidden="true"
          />
          Clientes nuevos
        </span>
      </figcaption>
    </figure>
  )
}
