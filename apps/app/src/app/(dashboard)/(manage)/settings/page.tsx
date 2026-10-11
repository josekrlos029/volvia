import { BusinessSettings } from '@/components/BusinessSettings'
import { DangerZone } from '@/components/DangerZone'
import { LegalSettings } from '@/components/LegalSettings'
import { LocationsSettings } from '@/components/LocationsSettings'
import { PublicPageSettings } from '@/components/PublicPageSettings'
import { apiFetch } from '@/lib/session'
import type { OrgSettings } from '@volvia/shared'
import Link from 'next/link'

interface Org {
  id: string
  name: string
  slug: string
  category: string
  tagline: string
  about: string
  contactEmail: string | null
  contactPhone: string | null
  googlePlaceId: string | null
  timezone: string
  brandColor: string
  socialLinks: Array<{ platform: string; url: string; label?: string }>
  publicUrl: string
  settings: OrgSettings
}

export default async function SettingsPage() {
  const [org, locations] = await Promise.all([
    apiFetch<Org>('/v1/org'),
    apiFetch<
      Array<{
        id: string
        name: string
        address: string | null
        city: string | null
        latitude: number | null
        longitude: number | null
      }>
    >('/v1/org/locations'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Ajustes</h1>
          <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
            Los datos de tu negocio y tu página pública.
          </p>
        </div>
        <Link
          href="/settings/billing"
          className="text-[14px] font-medium text-[var(--color-primary)] underline underline-offset-2"
        >
          Plan y facturación
        </Link>
      </header>

      <BusinessSettings org={org} />

      <PublicPageSettings
        links={org.socialLinks}
        brandColor={org.brandColor}
        ctaLabel={org.settings.pageCtaLabel}
        publicUrl={org.publicUrl}
      />

      <LocationsSettings locations={locations} />

      <LegalSettings settings={org.settings} slug={org.slug} />

      <DangerZone businessName={org.name} />
    </div>
  )
}
