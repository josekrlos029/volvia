import { CardEditor } from '@/components/CardEditor'
import { apiFetch } from '@/lib/session'

interface Org {
  name: string
  entitlements: { features: Record<string, boolean> }
}

export default async function NewCardPage() {
  const org = await apiFetch<Org>('/v1/org')

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Nueva tarjeta</h1>
        <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
          Decide cuántos sellos hacen falta y qué se lleva tu cliente al completarla.
        </p>
      </header>

      <CardEditor
        businessName={org.name}
        canCustomiseBranding={org.entitlements.features.custom_branding ?? false}
        canUseKiosk={org.entitlements.features.kiosk_mode ?? false}
        lengthLocked={false}
        initial={{
          name: '',
          stampsRequired: 8,
          design: {
            backgroundColor: '#14171A',
            foregroundColor: '#FFFFFF',
            accentColor: '#E9A23B',
            emptyStampColor: '#31363A',
            headline: '',
            subheadline: '',
          },
          rewards: [{ atStamp: 8, title: '', description: '' }],
          terms: '',
          collectBirthday: true,
          rules: { cooldownMinutes: 30, dailyCap: 2, kioskEnabled: false },
        }}
      />
    </div>
  )
}
