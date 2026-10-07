import { allPosts } from '@/lib/blog'
import { comparisons } from '@/lib/comparisons'
import { features } from '@/lib/features'
import { LOCALES } from '@/lib/i18n'
import { industries } from '@/lib/industries'
import type { MetadataRoute } from 'next'

const base = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'

/** Every indexable URL, in both languages, with the alternates search engines expect. */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    '',
    '/funciones',
    '/precios',
    '/sectores',
    '/blog',
    '/calculadora',
    '/guia',
    '/plantillas',
    '/referencias',
    '/glosario',
    '/comparativas',
    '/preguntas',
    '/contacto',
    '/generador-qr-resenas',
    '/privacidad',
    '/terminos',
  ]

  const pages = LOCALES.flatMap((locale) =>
    staticPaths.map((path) => ({
      url: `${base}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency: (path === '' ? 'weekly' : 'monthly') as 'weekly' | 'monthly',
      priority: path === '' ? 1 : path === '/precios' ? 0.9 : 0.7,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((alt) => [alt, `${base}/${alt}${path}`])),
      },
    })),
  )

  const industryPages = LOCALES.flatMap((locale) =>
    industries.map((industry) => ({
      url: `${base}/${locale}/sectores/${industry.slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((alt) => [alt, `${base}/${alt}/sectores/${industry.slug}`]),
        ),
      },
    })),
  )

  const featurePages = LOCALES.flatMap((locale) =>
    features.map((feature) => ({
      url: `${base}/${locale}/funciones/${feature.slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((alt) => [alt, `${base}/${alt}/funciones/${feature.slug}`]),
        ),
      },
    })),
  )

  const comparisonPages = LOCALES.flatMap((locale) =>
    comparisons.map((comparison) => ({
      url: `${base}/${locale}/comparativas/${comparison.slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((alt) => [alt, `${base}/${alt}/comparativas/${comparison.slug}`]),
        ),
      },
    })),
  )

  const posts = allPosts().map((post) => ({
    url: `${base}/${post.locale}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'yearly' as const,
    priority: 0.6,
  }))

  return [...pages, ...featurePages, ...industryPages, ...comparisonPages, ...posts]
}
