import { allPosts, postBySlug, postsForLocale } from '@/lib/blog'
import { isLocale } from '@/lib/i18n'
import type { Metadata } from 'next'
import { MDXRemote } from 'next-mdx-remote/rsc'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

export function generateStaticParams() {
  return allPosts().map((post) => ({ locale: post.locale, slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const post = postBySlug(slug)
  if (!post) return {}

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/${locale}/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
    },
  }
}

/** Prose styles live here rather than in a plugin, so the article matches the site. */
const proseComponents = {
  h2: (props: React.ComponentProps<'h2'>) => (
    <h2 className="mt-10 text-[24px] font-semibold leading-tight tracking-[-0.015em]" {...props} />
  ),
  h3: (props: React.ComponentProps<'h3'>) => (
    <h3 className="mt-8 text-[19px] font-semibold leading-tight" {...props} />
  ),
  p: (props: React.ComponentProps<'p'>) => (
    <p className="mt-4 text-[17px] leading-[1.7] text-[var(--color-ink)]" {...props} />
  ),
  ul: (props: React.ComponentProps<'ul'>) => (
    <ul className="mt-4 flex flex-col gap-2 pl-5 [&>li]:list-disc" {...props} />
  ),
  li: (props: React.ComponentProps<'li'>) => (
    <li className="text-[17px] leading-[1.7] text-[var(--color-ink)]" {...props} />
  ),
  strong: (props: React.ComponentProps<'strong'>) => (
    <strong className="font-semibold text-[var(--color-ink)]" {...props} />
  ),
  a: (props: React.ComponentProps<'a'>) => (
    <a className="text-[var(--color-primary)] underline underline-offset-4" {...props} />
  ),
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  const post = postBySlug(slug)
  if (!post) notFound()

  const isSpanish = locale === 'es'
  const more = postsForLocale(locale)
    .filter((item) => item.slug !== slug)
    .slice(0, 2)

  return (
    <article className="mx-auto max-w-[1180px] px-5 py-14 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-[68ch]">
        <Link
          href={`/${locale}/blog`}
          className="text-[14px] text-[var(--color-ink-muted)] underline underline-offset-4"
        >
          Blog
        </Link>

        <h1 className="mt-4 text-[clamp(30px,4.4vw,44px)] font-semibold leading-[1.08] tracking-[-0.025em]">
          {post.title}
        </h1>
        <p className="mt-4 text-[18px] leading-relaxed text-[var(--color-ink-muted)]">
          {post.description}
        </p>
        <p className="mt-4 text-[13px] tabular-nums text-[var(--color-ink-muted)]">
          {new Intl.DateTimeFormat(isSpanish ? 'es-CO' : 'en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(new Date(post.date))}
          {' · '}
          {post.readingMinutes} {isSpanish ? 'minutos' : 'minutes'}
        </p>

        <div className="mt-10 border-t border-[var(--color-line)] pt-2">
          <MDXRemote
            source={post.content}
            components={proseComponents}
            options={{ mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] } }}
          />
        </div>

        {more.length > 0 ? (
          <aside className="mt-14 border-t border-[var(--color-line)] pt-8">
            <h2 className="text-[14px] font-semibold">
              {isSpanish ? 'Seguir leyendo' : 'Keep reading'}
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {more.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/${locale}/blog/${item.slug}`}
                    className="text-[17px] font-medium leading-snug hover:text-[var(--color-primary)]"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </article>
  )
}
