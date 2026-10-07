import type { ReactNode } from 'react'

/** Shared frame for privacy and terms: narrow measure, clear headings, nothing else. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <article className="mx-auto max-w-[1200px] px-5 py-14 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-[68ch]">
        <h1 className="text-[clamp(28px,4vw,40px)] leading-tight tracking-[-0.025em]">{title}</h1>
        <p className="mt-3 text-[14px] text-[var(--color-ink-muted)]">{updated}</p>
        <div className="mt-10 flex flex-col gap-6 border-t border-[var(--color-line)] pt-8">
          {children}
        </div>
      </div>
    </article>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[20px] leading-tight">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[16px] leading-[1.7] text-[var(--color-ink)]">
        {children}
      </div>
    </section>
  )
}
