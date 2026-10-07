import { Fragment, type ReactNode } from 'react'

/**
 * An endless horizontal strip. The children are rendered twice so the CSS loop has no
 * seam; the second copy is hidden from assistive tech and from the tab order, so a
 * screen reader or keyboard user meets each item once.
 */
export function Marquee({
  children,
  duration = 60,
  reverse = false,
  className = '',
  gap = 16,
  repeat = 1,
}: {
  children: ReactNode
  /** Seconds for one full loop. Longer strips need more time to read at the same pace. */
  duration?: number
  reverse?: boolean
  className?: string
  gap?: number
  /** Copies per half. Short lists need more than one to fill a wide screen without a gap. */
  repeat?: number
}) {
  const group = { display: 'flex', gap, paddingRight: gap } as const
  // Only the very first copy is real to assistive tech; every repeat is decoration.
  const content = Array.from({ length: repeat }, (_, index) =>
    index === 0 ? (
      <Fragment key="first">{children}</Fragment>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: identical copies, position is the identity
      <div key={index} style={{ display: 'contents' }} aria-hidden="true" inert>
        {children}
      </div>
    ),
  )

  return (
    <div
      className={`marquee ${reverse ? 'marquee-reverse' : ''} ${className}`}
      style={{ '--marquee-duration': `${duration}s` } as React.CSSProperties}
    >
      <div className="marquee-track">
        <div style={group}>{content}</div>
        <div style={group} aria-hidden="true" data-copy="" inert>
          {content}
        </div>
      </div>
    </div>
  )
}
