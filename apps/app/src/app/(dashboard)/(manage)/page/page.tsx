import { GuestWifiSettings } from '@/components/GuestWifiSettings'
import { PageLinkCard } from '@/components/PageLinkCard'
import { PageModulesEditor, type PageSections } from '@/components/PageModulesEditor'
import { PageWorkspace } from '@/components/PageWorkspace'
import { PublicPageSettings } from '@/components/PublicPageSettings'
import { Panel } from '@/components/ui'
import { apiFetch } from '@/lib/session'
import { type Currency, type OrgSettings, googleReviewUrl } from '@volvia/shared'

interface Org {
  name: string
  slug: string
  currency: Currency
  publicUrl: string
  logoUrl: string | null
  coverUrl: string | null
  brandColor: string
  socialLinks: Array<{ platform: string; url: string; label?: string }>
  contactPhone: string | null
  googlePlaceId: string | null
  settings: OrgSettings
  entitlements: { features: Record<string, boolean> }
}

interface PageData {
  publicUrl: string
  sections: PageSections
  views30d: number
}

export default async function PagePage() {
  const [org, page] = await Promise.all([apiFetch<Org>('/v1/org'), apiFetch<PageData>('/v1/page')])
  const canCatalogue = org.entitlements.features.page_catalogue ?? false

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Tu página</h1>
        <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
          Un solo enlace con tu tarjeta, tus redes, tu carta y cómo llegar. Compártelo, imprímelo y
          ponlo donde termina la visita.
        </p>
      </header>

      <Panel title="Tu enlace">
        <PageLinkCard publicUrl={page.publicUrl} views30d={page.views30d} />
      </Panel>

      <PageWorkspace publicUrl={page.publicUrl}>
        <PublicPageSettings
          links={org.socialLinks}
          brandColor={org.brandColor}
          ctaLabel={org.settings.pageCtaLabel}
          publicUrl={org.publicUrl}
          logoUrl={org.logoUrl}
          coverUrl={org.coverUrl}
          accentColor={org.settings.pageAccentColor}
          reservationsUrl={org.settings.reservationsUrl}
          showReviews={org.settings.pageShowReviews}
          hasGoogleListing={googleReviewUrl(org.googlePlaceId) !== null}
          contactPhone={org.contactPhone}
        />
        <GuestWifiSettings wifi={org.settings.guestWifi} />
        <PageModulesEditor initial={page.sections} currency={org.currency} locked={!canCatalogue} />
      </PageWorkspace>
    </div>
  )
}
