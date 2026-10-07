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
  // White is the gallery wall; tonal breaks go straight to black, never to a mid-grey.
  const tones = {
    plain: 'bg-[var(--color-surface)]',
    muted: 'bg-[var(--color-surface)] border-t border-[var(--color-line)]',
    ink: 'bg-[var(--color-inverse-surface)] text-white',
  }

  return (
    <section className={`${tones[tone]} ${className}`}>
      <div className="rise mx-auto max-w-[1200px] px-5 py-16 sm:py-20 lg:px-8 lg:py-[120px]">
        {children}
      </div>
    </section>
  )
}

export function SectionTitle({
  title,
  body,
  eyebrow,
  align = 'left',
  as = 'h2',
}: {
  title: string
  body?: string
  /** A short uppercase marker above the title, drawn as a hairline violet pill. */
  eyebrow?: string
  align?: 'left' | 'center'
  /**
   * The page's own title passes `h1`. Every indexable page needs exactly one, and
   * leaving that to each page meant four of them shipped without any.
   */
  as?: 'h1' | 'h2'
}) {
  const Heading = as

  return (
    <header className={align === 'center' ? 'text-center' : ''}>
      {eyebrow ? <p className="badge mb-6">{eyebrow}</p> : null}
      <Heading className={`t-heading-lg max-w-[22ch] ${align === 'center' ? 'mx-auto' : ''}`}>
        {title}
      </Heading>
      {body ? (
        <p
          className={`t-subheading mt-5 max-w-[52ch] text-[var(--color-ink-muted)] ${align === 'center' ? 'mx-auto' : ''}`}
        >
          {body}
        </p>
      ) : null}
    </header>
  )
}
