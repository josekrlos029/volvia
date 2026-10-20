import type { StampResultDesign } from '@volvia/shared'
import { readableOn } from '@volvia/shared'
import { StampGrid } from '@volvia/ui/components/StampGrid'
import type { ReactNode } from 'react'

/**
 * The customer's card in the business's own colours — the same look as the result
 * screen in Volvia Biz, so the cashier sees at a glance it is the right card.
 */
export function CardFace({
  design,
  filled,
  total,
  title,
  animateLast = false,
  children,
}: {
  design: StampResultDesign
  filled: number
  total: number
  title: string
  animateLast?: boolean
  children?: ReactNode
}) {
  const onAccent = readableOn(design.accentColor, [design.backgroundColor, design.foregroundColor])
  return (
    <div
      className="overflow-hidden rounded-[16px] shadow-sm"
      style={{ background: design.backgroundColor, color: design.foregroundColor }}
    >
      <div className="flex items-center gap-3 p-4">
        {design.logoUrl ? (
          <img
            src={design.logoUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full bg-white object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[15px] font-semibold"
            style={{ background: design.accentColor, color: onAccent }}
          >
            {design.businessName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] opacity-70">
            {design.cardName}
          </p>
          <p className="truncate text-[17px] font-semibold leading-tight">{title}</p>
        </div>
        <span className="tabular shrink-0 text-[15px] font-semibold">
          {filled}/{total}
        </span>
      </div>
      <div className="px-4 pb-4">
        <StampGrid
          dense
          filled={filled}
          total={total}
          rewardPositions={design.rewardPositions}
          backgroundColor={design.backgroundColor}
          accentColor={design.accentColor}
          emptyColor={design.emptyStampColor}
          foregroundColor={design.foregroundColor}
          stampStyle={design.stampStyle}
          stampIcon={design.stampIcon}
          animateLast={animateLast}
        />
        {children}
      </div>
    </div>
  )
}
