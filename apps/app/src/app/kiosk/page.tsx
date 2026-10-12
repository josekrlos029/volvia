import { Kiosk } from '@/components/Kiosk'
import { apiFetch, requireRole } from '@/lib/session'
import type { LoyaltyCardDesign } from '@volvia/ui/components/LoyaltyCard'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Kiosko · Volvia' }

interface Card {
  id: string
  name: string
  status: string
  stampsRequired: number
  design: LoyaltyCardDesign
  rewards: Array<{ atStamp: number; title: string }>
  rules: { kioskEnabled: boolean }
}

export default async function KioskPage({
  searchParams,
}: {
  searchParams: Promise<{ cardId?: string; locationId?: string }>
}) {
  // Starting a kiosk session is an admin call on the API, so the screen is admin-only too.
  await requireRole('admin')

  const query = await searchParams
  const [cards, locations, org] = await Promise.all([
    apiFetch<Card[]>('/v1/cards'),
    apiFetch<Array<{ id: string; name: string }>>('/v1/org/locations'),
    apiFetch<{ name: string; logoUrl: string | null }>('/v1/org'),
  ])

  const eligible = cards.filter((card) => card.status === 'active' && card.rules.kioskEnabled)
  const card = eligible.find((item) => item.id === query.cardId) ?? eligible[0]
  const locationId = query.locationId ?? locations[0]?.id

  // Choosing the screen's card is a one-time setup step, so it happens here rather
  // than inside the kiosk view, which then never shows chrome again.
  if (!card || !locationId) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-5 text-center">
        <h1 className="text-[22px] font-semibold">Modo kiosko no disponible</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
          Activa el modo kiosko en una tarjeta publicada para usar esta pantalla.
        </p>
        <Link
          href="/cards"
          className="mx-auto mt-6 rounded-[9px] bg-[var(--color-primary)] px-5 py-2.5 text-[15px] font-semibold text-white"
        >
          Ir a mis tarjetas
        </Link>
      </main>
    )
  }

  return (
    <Kiosk
      cardId={card.id}
      locationId={locationId}
      businessName={org.name}
      cardName={card.name}
      design={{ ...card.design, logoUrl: card.design.logoUrl ?? org.logoUrl }}
      stampsRequired={card.stampsRequired}
      rewards={card.rewards}
      passUrl={process.env.NEXT_PUBLIC_PASS_URL ?? 'http://localhost:3002'}
    />
  )
}
