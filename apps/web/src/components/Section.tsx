import type { ReactNode } from 'react'

/** Page section wrapper: one place that owns vertical rhythm and the reveal animation. */
export function Section({
  children,
  tone = 'plain',
  className = '',
}: {
  children: ReactNode
  tone?: 'plain' | 'muted' | 'ink'
  className?: string
}) {
  const tones = {
    plain: 'bg-[var(--color-surface)]',
    muted: 'bg-[var(--color-surface-muted)]',
    ink: 'bg-[var(--color-inverse-surface)] text-white',
  }

  return (
    <section className={`${tones[tone]} ${className}`}>
      <div className="rise mx-auto max-w-[1180px] px-5 py-16 sm:py-20 lg:px-8 lg:py-24">
        {children}
      </div>
    </section>
  )
}

export function SectionTitle({
  title,
  body,
  align = 'left',
  as = 'h2',
}: {
  title: string
  body?: string
  align?: 'left' | 'center'
  /**
   * The page's own title passes `h1`. Every indexable page needs exactly one, and
   * leaving that to each page meant four of them shipped without any.
   */
  as?: 'h1' | 'h2'
}) {
  const Heading = as

  return (
    <header className={align === 'center' ? 'mx-auto max-w-[46ch] text-center' : 'max-w-[30ch]'}>
      <Heading className="text-[clamp(24px,3.4vw,34px)] font-semibold leading-[1.12] tracking-[-0.02em]">
        {title}
      </Heading>
      {body ? (
        <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-[var(--color-ink-muted)]">
          {body}
        </p>
      ) : null}
    </header>
  )
}
