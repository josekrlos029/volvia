import { BusinessSettings } from '@/components/BusinessSettings'
import { Panel } from '@/components/ui'
import { apiFetch } from '@/lib/session'
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
  socialLinks: Array<{ platform: string; url: string }>
  publicUrl: string
}

export default async function SettingsPage() {
  const [org, locations] = await Promise.all([
    apiFetch<Org>('/v1/org'),
    apiFetch<Array<{ id: string; name: string; address: string | null; city: string | null }>>(
      '/v1/org/locations',
    ),
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

      <Panel title="Sedes">
        <ul className="flex flex-col divide-y divide-[var(--color-line)]">
          {locations.map((location) => (
            <li key={location.id} className="py-2.5 first:pt-0">
              <p className="text-[14px] font-medium">{location.name}</p>
              <p className="text-[13px] text-[var(--color-ink-muted)]">
                {[location.address, location.city].filter(Boolean).join(', ') || 'Sin dirección'}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
