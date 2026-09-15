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
    <div className="w-full max-w-[300px] rounded-[26px] bg-[#14171A] p-3 shadow-[0_28px_70px_-24px_rgba(16,18,15,0.55)]">
      <div className="rounded-[20px] bg-[#1C2024] p-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/55">
          {businessName}
        </p>
        <p className="mt-1.5 text-[19px] font-semibold leading-tight text-white">{cardName}</p>

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
                className="grid aspect-square place-items-center rounded-full border-2 text-[11px] font-semibold"
                style={{
                  background: isFilled ? 'var(--color-accent)' : 'transparent',
                  borderColor: isFilled ? 'var(--color-accent)' : '#343A3F',
                  color: isFilled ? '#14171A' : '#5A6169',
                }}
              >
                {isFilled ? '✓' : ''}
              </span>
            )
          })}
        </div>

        <div className="mt-5 flex items-baseline justify-between">
          <span className="text-[13px] font-medium tabular-nums text-white">
            {filled} / {total}
          </span>
          <span className="text-[12px] text-white/60">{reward}</span>
        </div>
      </div>
    </div>
  )
}
