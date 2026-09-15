/** Shared page frame: a phone-width column with consistent breathing room. */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-12 pt-6 sm:px-5 sm:pt-10">{children}</main>
  )
}

export function VolviaMark() {
  return <p className="mt-8 text-center text-[12px] text-[var(--color-ink-muted)]">Volvia</p>
}
