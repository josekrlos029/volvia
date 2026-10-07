import type { StampStyle } from '@volvia/shared'
import { STAMP_RADIUS, hexWithAlpha } from '@volvia/ui'
import type { CSSProperties } from 'react'

/**
 * Picks a column count that fills every row.
 *
 * An 8-stamp card laid out 5-then-3 leaves an orphan row that reads as a mistake, so
 * we prefer a divisor of the total and only fall back when there is no clean one.
 */
function balancedColumns(total: number): number {
  if (total <= 6) return total
  for (const candidate of [6, 5, 4, 3]) {
    if (total % candidate === 0) return candidate
  }
  return 5
}

interface StampGridProps {
  filled: number
  total: number
  /** Positions (1-based) that unlock a reward, marked so progress has landmarks. */
  rewardPositions: number[]
  accentColor: string
  emptyColor: string
  foregroundColor: string
  /** Shape of a single slot, chosen by the business. */
  stampStyle?: StampStyle
  /** The most recently earned stamp animates in once, on load. */
  animateLast?: boolean
}

/**
 * The stamp card itself.
 *
 * Laid out as a grid rather than a progress bar because the card is a metaphor a
 * customer already understands from paper: discrete slots you fill one at a time.
 * Reward slots are visually distinct so the goal is legible at a glance.
 */
export function StampGrid({
  filled,
  total,
  rewardPositions,
  accentColor,
  emptyColor,
  foregroundColor,
  stampStyle = 'circle',
  animateLast = false,
}: StampGridProps) {
  const columns = balancedColumns(total)
  const radius = STAMP_RADIUS[stampStyle]

  return (
    <ul
      className="grid gap-2.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-label={`${filled} de ${total} sellos`}
    >
      {Array.from({ length: total }, (_, index) => {
        const position = index + 1
        const isFilled = position <= filled
        const isReward = rewardPositions.includes(position)
        const isLatest = animateLast && position === filled

        const rings = [
          // A badge carries its own ring in the accent colour, whatever its state.
          stampStyle === 'badge' ? `0 0 0 2px ${hexWithAlpha(accentColor, 0.55)}` : null,
          // Reward slots get a ring so the target is visible before it is reached.
          isReward && !isFilled ? `0 0 0 2px ${emptyColor}` : null,
        ].filter(Boolean)

        const style: CSSProperties = {
          background: isFilled ? accentColor : 'transparent',
          borderColor: isFilled ? accentColor : emptyColor,
          color: isFilled ? '#14171A' : emptyColor,
          borderRadius: radius,
          boxShadow: rings.length > 0 ? rings.join(', ') : undefined,
        }

        return (
          <li key={position} className="aspect-square">
            <div
              style={style}
              className={[
                'flex h-full w-full items-center justify-center border-2',
                'text-[13px] font-semibold tabular-nums transition-colors duration-200',
                isLatest ? 'stamp-land' : '',
              ].join(' ')}
            >
              {isFilled ? (
                <CheckMark color="#14171A" />
              ) : isReward ? (
                <GiftMark color={emptyColor} />
              ) : (
                <span style={{ color: emptyColor, opacity: 0.65 }}>{position}</span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Inline marks rather than an icon font: these render inside a business's own colours. */
function CheckMark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 20 20" className="h-[55%] w-[55%]" aria-hidden="true">
      <path
        d="M4 10.5 8 14.5 16 6"
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function GiftMark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 20 20" className="h-[50%] w-[50%]" aria-hidden="true">
      <path
        d="M3 8.5h14v8.5H3zM3 8.5h14M10 8.5V17M10 8.5c-1.5-3-5.5-3.5-5.5-1.2C4.5 8.5 7.5 8.6 10 8.5zm0 0c1.5-3 5.5-3.5 5.5-1.2 0 1.2-3 1.3-5.5 1.2z"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
