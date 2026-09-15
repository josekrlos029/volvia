'use client'

export interface PreviewDesign {
  backgroundColor: string
  foregroundColor: string
  accentColor: string
  emptyStampColor: string
  headline: string
  subheadline: string
}

/**
 * The live preview beside the card editor.
 *
 * It shows the card half-filled rather than empty, because an empty card hides exactly
 * the contrast problem a business needs to see: whether a stamped slot reads clearly
 * against the background they just picked.
 */
export function CardPreview({
  design,
  businessName,
  cardName,
  stampsRequired,
  rewardPositions,
}: {
  design: PreviewDesign
  businessName: string
  cardName: string
  stampsRequired: number
  rewardPositions: number[]
}) {
  const filled = Math.max(1, Math.floor(stampsRequired / 2))
  const columns = balancedColumns(stampsRequired)

  return (
    <div
      className="overflow-hidden rounded-[18px] p-5"
      style={{ background: design.backgroundColor, color: design.foregroundColor }}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-70">
        {businessName}
      </p>
      <h3 className="mt-1 text-[20px] font-semibold leading-tight">
        {design.headline || cardName || 'Tu tarjeta'}
      </h3>
      {design.subheadline ? (
        <p className="mt-1 text-[13px] leading-snug opacity-75">{design.subheadline}</p>
      ) : null}

      <div
        className="mt-4 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: stampsRequired }, (_, index) => {
          const position = index + 1
          const isFilled = position <= filled
          const isReward = rewardPositions.includes(position)
          return (
            <span
              key={position}
              className="grid aspect-square place-items-center rounded-full border-2 text-[12px] font-semibold"
              style={{
                background: isFilled ? design.accentColor : 'transparent',
                borderColor: isFilled ? design.accentColor : design.emptyStampColor,
                color: isFilled ? design.backgroundColor : design.emptyStampColor,
                boxShadow:
                  isReward && !isFilled ? `0 0 0 2px ${design.emptyStampColor}` : undefined,
              }}
            >
              {isFilled ? '✓' : position}
            </span>
          )
        })}
      </div>

      <p className="tabular mt-4 text-[13px] font-medium">
        {filled} / {stampsRequired}
      </p>
    </div>
  )
}

function balancedColumns(total: number): number {
  if (total <= 6) return total
  for (const candidate of [6, 5, 4, 3]) {
    if (total % candidate === 0) return candidate
  }
  return 5
}
