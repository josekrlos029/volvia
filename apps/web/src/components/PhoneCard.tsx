/**
 * The hero's product visual: a real, correctly-composed loyalty card rendered as the
 * customer would see it, rather than a photo of a screen or a fake screenshot.
 */
export function PhoneCard({
  businessName,
  cardName,
  filled,
  total,
  reward,
}: {
  businessName: string
  cardName: string
  filled: number
  total: number
  reward: string
}) {
  const columns = total % 4 === 0 ? 4 : 5

  return (
    <div className="w-full max-w-[300px] rounded-[32px] bg-black p-2.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
      <div className="rounded-[24px] bg-[#111111] p-5">
        <p className="text-[10px] uppercase tracking-[0.08em] text-white/55">{businessName}</p>
        <p className="mt-1.5 text-[22px] leading-tight tracking-[-0.02em] text-white">{cardName}</p>

        <div
          className="mt-5 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          aria-hidden="true"
        >
          {Array.from({ length: total }, (_, index) => {
            const isFilled = index < filled
            return (
              <span
                key={`stamp-${index + 1}`}
                className="grid aspect-square place-items-center rounded-full border-2 text-[11px]"
                style={{
                  background: isFilled ? 'var(--color-accent)' : 'transparent',
                  borderColor: isFilled ? 'var(--color-accent)' : '#333333',
                  color: isFilled ? '#ffffff' : '#5c5c5c',
                }}
              >
                {isFilled ? '✓' : ''}
              </span>
            )
          })}
        </div>

        <div className="mt-5 flex items-baseline justify-between">
          <span className="text-[13px] tabular-nums text-white">
            {filled} / {total}
          </span>
          <span className="text-[12px] text-white/60">{reward}</span>
        </div>
      </div>
    </div>
  )
}
