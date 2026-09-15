import { Shell } from '@/components/Shell'
import { api } from '@/lib/api'
import { t } from '@/lib/i18n'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

interface BusinessPage {
  business: {
    name: string
    slug: string
    tagline: string
    about: string
    category: string
    logoUrl: string | null
    coverUrl: string | null
    brandColor: string
    socialLinks: Array<{ platform: string; url: string; label?: string }>
    contactPhone: string | null
    googleReviewUrl: string | null
  }
  locations: Array<{
    name: string
    address: string | null
    city: string | null
    phone: string | null
    hours: Array<{ day: number; opens: string; closes: string }>
    mapsUrl: string | null
  }>
  cards: Array<{
    name: string
    stampsRequired: number
    design: Record<string, string>
    joinUrl: string
    rewards: Array<{ atStamp: number; title: string }>
  }>
}

async function loadBusiness(slug: string): Promise<BusinessPage | null> {
  try {
    return await api.get<BusinessPage>(`/p/business/${slug}`)
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = await loadBusiness(slug)
  if (!page) return { title: 'Volvia' }

  return {
    title: `${page.business.name} · Volvia`,
    description: page.business.tagline || page.business.about,
    // Unlike a customer's card, a business page is meant to be shared and found.
    robots: { index: true, follow: true },
    openGraph: {
      title: page.business.name,
      description: page.business.tagline || page.business.about,
      type: 'website',
    },
  }
}

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  x: 'X',
  youtube: 'YouTube',
  website: 'Sitio web',
  menu: 'Menú',
  booking: 'Reservar',
}

export default async function BusinessPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await loadBusiness(slug)
  if (!page) notFound()

  const copy = t('es')
  const primaryCard = page.cards[0]
  const cardDesign = primaryCard?.design as unknown as
    | { backgroundColor: string; accentColor: string }
    | undefined

  return (
    <Shell>
      <header className="mb-7 text-center">
        {page.business.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.business.logoUrl}
            alt=""
            className="mx-auto h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="mx-auto grid h-20 w-20 place-items-center rounded-full text-[28px] font-semibold text-white"
            style={{ background: page.business.brandColor }}
          >
            {page.business.name.slice(0, 1).toUpperCase()}
          </div>
        )}

        <h1 className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.01em]">
          {page.business.name}
        </h1>
        {page.business.tagline ? (
          <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
            {page.business.tagline}
          </p>
        ) : null}
      </header>

      {primaryCard ? (
        <section
          className="mb-6 rounded-[16px] p-5 text-white"
          style={{ background: cardDesign?.backgroundColor ?? '#14171A' }}
        >
          <h2 className="text-[18px] font-semibold leading-tight">{primaryCard.name}</h2>
          <p className="mt-1.5 text-[14px] leading-snug opacity-80">
            {copy.business.stampsToReward(primaryCard.stampsRequired)}
          </p>
          <a
            href={primaryCard.joinUrl}
            className="mt-4 block rounded-[10px] px-4 py-3.5 text-center text-[16px] font-semibold text-[#14171A] transition-transform duration-150 active:scale-[0.985]"
            style={{ background: cardDesign?.accentColor ?? '#E9A23B' }}
          >
            {copy.business.cardCta}
          </a>
        </section>
      ) : null}

      {page.business.about ? (
        <p className="mb-6 text-[15px] leading-relaxed text-[var(--color-ink)]">
          {page.business.about}
        </p>
      ) : null}

      {page.business.socialLinks.length > 0 ? (
        <nav aria-label={copy.business.followUs} className="mb-6 grid grid-cols-2 gap-2.5">
          {page.business.socialLinks.map((link) => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-[10px] border border-[var(--color-line)] bg-white px-4 py-3 text-center text-[15px] font-medium transition-transform duration-150 active:scale-[0.985]"
            >
              {link.label ?? SOCIAL_LABELS[link.platform] ?? link.platform}
            </a>
          ))}
        </nav>
      ) : null}

      {page.locations.length > 0 ? (
        <section className="mb-6 rounded-[14px] border border-[var(--color-line)] bg-white p-4">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
            {copy.business.findUs}
          </h2>
          <ul className="mt-3 flex flex-col gap-5">
            {page.locations.map((location) => (
              <li key={location.name}>
                <p className="text-[15px] font-medium leading-snug">{location.name}</p>
                {location.address ? (
                  <p className="text-[14px] leading-snug text-[var(--color-ink-muted)]">
                    {location.address}
                    {location.city ? `, ${location.city}` : ''}
                  </p>
                ) : null}

                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {location.mapsUrl ? (
                    <a
                      href={location.mapsUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[14px] font-medium text-[var(--color-primary)] underline underline-offset-2"
                    >
                      Google Maps
                    </a>
                  ) : null}
                  {location.phone ? (
                    <a
                      href={`tel:${location.phone}`}
                      className="text-[14px] font-medium text-[var(--color-primary)] underline underline-offset-2"
                    >
                      {location.phone}
                    </a>
                  ) : null}
                </div>

                {location.hours.length > 0 ? (
                  <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[13px] text-[var(--color-ink-muted)]">
                    {location.hours.map((entry) => (
                      <div key={entry.day} className="contents">
                        <dt>{copy.weekdays[entry.day]}</dt>
                        <dd className="tabular-nums">
                          {entry.opens} a {entry.closes}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-2 text-center text-[12px] text-[var(--color-ink-muted)]">
        {copy.business.poweredBy}
      </p>
    </Shell>
  )
}
