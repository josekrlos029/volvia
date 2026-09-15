import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import type { Locale } from './i18n'

export interface Post {
  slug: string
  title: string
  description: string
  date: string
  locale: Locale
  tags: string[]
  readingMinutes: number
  content: string
}

const CONTENT_DIR = join(process.cwd(), 'src/content/blog')

/**
 * Posts are MDX files in the repository, read at build time. No CMS to run, no database
 * call on a page that never changes between deploys.
 */
export function allPosts(): Post[] {
  const files = readdirSync(CONTENT_DIR).filter((file) => file.endsWith('.mdx'))

  return files
    .map((file) => {
      const raw = readFileSync(join(CONTENT_DIR, file), 'utf8')
      const { data, content } = matter(raw)
      return {
        slug: file.replace(/\.mdx$/, ''),
        title: String(data.title),
        description: String(data.description),
        date: String(data.date),
        locale: (data.locale ?? 'es') as Locale,
        tags: (data.tags ?? []) as string[],
        readingMinutes: Number(data.readingMinutes ?? 4),
        content,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function postsForLocale(locale: Locale): Post[] {
  return allPosts().filter((post) => post.locale === locale)
}

export function postBySlug(slug: string): Post | null {
  return allPosts().find((post) => post.slug === slug) ?? null
}
