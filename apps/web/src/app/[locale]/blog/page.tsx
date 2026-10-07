import { Section, SectionTitle } from '@/components/Section'
import { postsForLocale } from '@/lib/blog'
import { isLocale } from '@/lib/i18n'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const isSpanish = locale === 'es'
  return {
    title: 'Blog',
    description: isSpanish
      ? 'Cómo montar y sostener un programa de fidelización en un negocio pequeño, sin teoría de manual.'
      : 'How to run a loyalty programme in a small business, without textbook theory.',
    alternates: { canonical: `/${locale}/blog` },
  }
}

export default async function BlogIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const posts = postsForLocale(locale)
  const isSpanish = locale === 'es'

  return (
    <Section>
      <SectionTitle
        as="h1"
        title={isSpanish ? 'Cómo hacer que vuelvan' : 'How to make them come back'}
        body={
          isSpanish
            ? 'Lo que hemos aprendido mirando cómo usan Volvia cafeterías, barberías y restaurantes de verdad.'
            : 'What we have learned watching real coffee shops, barbershops and restaurants use Volvia.'
        }
      />

      <ul className="mt-10 flex flex-col divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/${locale}/blog/${post.slug}`} className="group flex flex-col gap-2 py-6">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 className="text-[21px] leading-tight tracking-[-0.01em] group-hover:text-[var(--color-primary)]">
                  {post.title}
                </h2>
                <span className="text-[13px] tabular-nums text-[var(--color-ink-muted)]">
                  {new Intl.DateTimeFormat(isSpanish ? 'es-CO' : 'en-US', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(post.date))}
                </span>
              </div>
              <p className="max-w-[62ch] text-[16px] leading-relaxed text-[var(--color-ink-muted)]">
                {post.description}
              </p>
              <span className="text-[13px] text-[var(--color-ink-muted)]">
                {post.readingMinutes} {isSpanish ? 'minutos de lectura' : 'minute read'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}
