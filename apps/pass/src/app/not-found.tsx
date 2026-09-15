import { t } from '@/lib/i18n'

export default function NotFound() {
  const copy = t('es')
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-5 py-16 text-center">
      <h1 className="text-[22px] font-semibold">{copy.common.notFoundTitle}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
        {copy.common.notFoundBody}
      </p>
    </main>
  )
}
