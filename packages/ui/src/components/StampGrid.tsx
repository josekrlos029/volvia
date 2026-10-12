import type { StampIcon, StampStyle } from '@volvia/shared'
import { CHECK_ICON_PATH, GIFT_ICON_PATH, STAMP_ICON_PATHS, readableOn } from '@volvia/shared'
import type { CSSProperties } from 'react'
import { STAMP_RADIUS, hexWithAlpha } from '../card-surface'

/**
 * Picks a column count that fills every row.
 *
 * An 8-stamp card laid out 5-then-3 leaves an orphan row that reads as a mistake, so
 * we prefer a divisor of the total and only fall back when there is no clean one.
 */
export function balancedColumns(total: number): number {
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
  backgroundColor: string
  accentColor: string
  emptyColor: string
  foregroundColor: string
  /** Shape of a single slot, chosen by the business. */
  stampStyle?: StampStyle
  /** What a filled slot shows: the business's own glyph, emoji or image. */
  stampIcon?: StampIcon
  /** The most recently earned stamp animates in once, on load. */
  animateLast?: boolean
  /** Tighter gaps for thumbnails. */
  dense?: boolean
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
  backgroundColor,
  accentColor,
  emptyColor,
  foregroundColor,
  stampStyle = 'circle',
  stampIcon,
  animateLast = false,
  dense = false,
}: StampGridProps) {
  const columns = balancedColumns(total)
  const radius = STAMP_RADIUS[stampStyle]
  // The mark inside a filled slot sits on the accent, so it takes whichever of the
  // card's own colours reads best there rather than a fixed dark ink.
  const markColor = readableOn(accentColor, [backgroundColor, foregroundColor])
  // Empty slots are drawn in a colour the business picked for the background; when it
  // is too close to the background to read, the foreground stands in for the labels.
  const emptyInk = readableOn(backgroundColor, [emptyColor, foregroundColor])

  return (
    <ul
      className={dense ? 'grid gap-1.5' : 'grid gap-2.5'}
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
          // Reward slots get a ring in the accent so the target is visible before it is reached.
          isReward && !isFilled ? `0 0 0 2px ${hexWithAlpha(accentColor, 0.7)}` : null,
        ].filter(Boolean)

        const style: CSSProperties = {
          background: isFilled ? accentColor : 'transparent',
          borderColor: isFilled ? accentColor : emptyColor,
          borderRadius: radius,
          boxShadow: rings.length > 0 ? rings.join(', ') : undefined,
        }

        return (
          <li key={position} className="aspect-square">
            <div
              style={style}
              className={[
                'flex h-full w-full items-center justify-center overflow-hidden border-2',
                'font-semibold tabular-nums transition-colors duration-200',
                dense ? 'text-[10px]' : 'text-[13px]',
                isLatest ? 'stamp-land' : '',
              ].join(' ')}
            >
              {isFilled ? (
                <FilledMark icon={stampIcon} color={markColor} />
              ) : isReward ? (
                <Glyph path={GIFT_ICON_PATH} color={accentColor} size="52%" />
              ) : dense ? null : (
                <span style={{ color: emptyInk, opacity: 0.6 }}>{position}</span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function FilledMark({ icon, color }: { icon: StampIcon | undefined; color: string }) {
  if (!icon) return <Glyph path={CHECK_ICON_PATH} color={color} size="55%" />
  if (icon.kind === 'emoji') {
    return (
      <span aria-hidden="true" className="text-[1.25em] leading-none">
        {icon.value}
      </span>
    )
  }
  if (icon.kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={icon.value} alt="" className="h-[62%] w-[62%] object-contain" />
  }
  return <Glyph path={STAMP_ICON_PATHS[icon.value]} color={color} size="58%" />
}

/** Inline strokes rather than an icon font: these render inside a business's own colours. */
function Glyph({ path, color, size }: { path: string; color: string; size: string }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }} aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
