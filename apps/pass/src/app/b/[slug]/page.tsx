import { type PageModule, PageModules } from '@/components/PageModules'
import { PageViewBeacon } from '@/components/PageViewBeacon'
import { Shell } from '@/components/Shell'
import { WifiCard } from '@/components/WifiCard'
import { api } from '@/lib/api'
import { t } from '@/lib/i18n'
import { readableOn } from '@volvia/shared'
import {
  LOYALTY_CARD_LABELS_EN,
  LOYALTY_CARD_LABELS_ES,
  LoyaltyCard,
  type LoyaltyCardDesign,
} from '@volvia/ui/components/LoyaltyCard'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'

interface BusinessPage {
  business: {
    name: string
    slug: string
    tagline: string
    about: string
    category: string
    locale: string
    currency: string
    logoUrl: string | null
    coverUrl: string | null
    brandColor: string
    accentColor: string
    socialLinks: Array<{ platform: string; url: string; label?: string }>
    ctaLabel: string
    legal: { name: string; taxId: string; address: string; email: string }
    contactPhone: string | null
    googleReviewUrl: string | null
    wifi: { ssid: string; password: string } | null
    reservationsUrl: string | null
    showReviews: boolean
  }
  modules: PageModule[]
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
    design: Record<string, unknown>
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
  telegram: 'Telegram',
  x: 'X',
  youtube: 'YouTube',
  website: 'Sitio web',
  menu: 'Menú',
  booking: 'Reservar',
}

/** The digits of a WhatsApp link or a phone, as `wa.me` wants them. */
function digitsOf(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/[^0-9]/g, '')
  return digits.length >= 7 ? digits : null
}

export default async function BusinessPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await loadBusiness(slug)
  if (!page) notFound()

  // The business decides the language of its own page.
  const locale = page.business.locale === 'en' ? 'en' : 'es'
  const copy = t(locale)
  const primaryCard = page.cards[0]
  const cardDesign = primaryCard?.design as unknown as LoyaltyCardDesign | undefined
  const accent = page.business.accentColor || page.business.brandColor

  const whatsappLink = page.business.socialLinks.find((link) => link.platform === 'whatsapp')
  const whatsapp = digitsOf(whatsappLink?.url) ?? digitsOf(page.business.contactPhone)
  const otherLinks = page.business.socialLinks.filter((link) => link.platform !== 'whatsapp')

  // The row of things a customer does right now: call, write, book, review.
  const actions: Array<{ href: string; label: string; external: boolean }> = []
  if (page.business.contactPhone) {
    actions.push({
      href: `tel:${page.business.contactPhone}`,
      label: copy.business.call,
      external: false,
    })
  }
  if (whatsapp) {
    actions.push({
      href: `https://wa.me/${whatsapp}`,
      label: copy.business.whatsapp,
      external: true,
    })
  }
  if (page.business.reservationsUrl) {
    actions.push({
      href: page.business.reservationsUrl,
      label: copy.business.reserve,
      external: true,
    })
  }
  if (page.business.googleReviewUrl && page.business.showReviews) {
    actions.push({
      href: page.business.googleReviewUrl,
      label: copy.business.review,
      external: true,
    })
  }

  return (
    <Shell>
      <PageViewBeacon slug={slug} />
      <div style={{ '--accent': accent } as CSSProperties}>
        <header className={`mb-7 ${page.business.coverUrl ? '' : 'text-center'}`}>
          {page.business.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={page.business.coverUrl}
              alt=""
              className="aspect-[16/9] w-full rounded-[16px] object-cover"
            />
          ) : null}
          <div
            className={
              page.business.coverUrl
                ? '-mt-10 flex items-end gap-4 px-2'
                : 'flex flex-col items-center'
            }
          >
            {page.business.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={page.business.logoUrl}
                alt=""
                className="h-20 w-20 shrink-0 rounded-full border-4 border-[var(--color-surface)] object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-4 border-[var(--color-surface)] text-[28px] font-semibold text-white"
                style={{ background: accent }}
              >
                {page.business.name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <h1 className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.01em]">
            {page.business.name}
          </h1>
          {page.business.tagline ? (
            <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
              {page.business.tagline}
            </p>
          ) : null}
        </header>

        {actions.length > 0 ? (
          <nav className="mb-6 grid grid-cols-2 gap-2.5">
            {actions.map((action) => (
              <a
                key={action.href}
                href={action.href}
                {...(action.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                className="rounded-[10px] px-4 py-3 text-center text-[15px] font-semibold text-white transition-transform duration-150 active:scale-[0.985]"
                style={{ background: accent }}
              >
                {action.label}
              </a>
            ))}
          </nav>
        ) : null}

        {primaryCard && cardDesign ? (
          <section className="mb-6 flex flex-col gap-4" aria-label={primaryCard.name}>
            {/* The real card, empty: what the customer gets the moment they join. */}
            <LoyaltyCard
              businessName={page.business.name}
              cardName={primaryCard.name}
              design={{ ...cardDesign, logoUrl: cardDesign.logoUrl ?? page.business.logoUrl }}
              filled={0}
              total={primaryCard.stampsRequired}
              rewardPositions={primaryCard.rewards.map((reward) => reward.atStamp)}
              nextReward={primaryCard.rewards[0] ?? null}
              labels={locale === 'en' ? LOYALTY_CARD_LABELS_EN : LOYALTY_CARD_LABELS_ES}
            />
            {primaryCard.rewards.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {primaryCard.rewards.map((reward) => (
                  <li key={reward.atStamp} className="flex items-baseline gap-3 text-[15px]">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums"
                      style={{
                        background: cardDesign.accentColor,
                        color: readableOn(cardDesign.accentColor, ['#0F172A', '#FFFFFF']),
                      }}
                    >
                      {reward.atStamp}
                    </span>
                    <span className="font-medium leading-snug">{reward.title}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <a
              href={primaryCard.joinUrl}
              className="block rounded-[10px] px-4 py-3.5 text-center text-[16px] font-semibold transition-transform duration-150 active:scale-[0.985]"
              style={{
                background: cardDesign.accentColor,
                color: readableOn(cardDesign.accentColor, ['#0F172A', '#FFFFFF']),
              }}
            >
              {page.business.ctaLabel || copy.business.cardCta}
            </a>
          </section>
        ) : null}

        {page.business.about ? (
          <p className="mb-6 text-[15px] leading-relaxed text-[var(--color-ink)]">
            {page.business.about}
          </p>
        ) : null}

        {page.business.wifi ? (
          <WifiCard
            ssid={page.business.wifi.ssid}
            password={page.business.wifi.password}
            labels={{
              title: copy.business.wifi,
              password: copy.business.wifiPassword,
              copy: copy.business.copy,
              copied: copy.business.copied,
            }}
          />
        ) : null}

        <PageModules
          modules={page.modules ?? []}
          locale={locale}
          currency={page.business.currency}
          whatsapp={whatsapp}
          sms={page.business.contactPhone}
          labels={copy.business.modules}
          accentColor={accent}
        />

        {otherLinks.length > 0 ? (
          <nav aria-label={copy.business.followUs} className="mb-6 grid grid-cols-2 gap-2.5">
            {otherLinks.map((link) => (
              <a
                key={link.platform}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-center text-[15px] font-medium transition-transform duration-150 active:scale-[0.985]"
              >
                {link.label ?? SOCIAL_LABELS[link.platform] ?? link.platform}
              </a>
            ))}
          </nav>
        ) : null}

        {page.locations.length > 0 ? (
          <section className="mb-6 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
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

        <footer className="mt-2 flex flex-col items-center gap-1.5 text-center text-[12px] text-[var(--color-ink-muted)]">
          <Link href={`/b/${slug}/privacidad`} className="underline underline-offset-2">
            {copy.business.privacy}
          </Link>
          <p>{copy.business.poweredBy}</p>
        </footer>
      </div>
    </Shell>
  )
}
