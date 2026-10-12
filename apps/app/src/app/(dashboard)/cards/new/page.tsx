import { CardEditor } from '@/components/CardEditor'
import type { ProfileQuestion } from '@/components/SignupFormEditor'
import { apiFetch, requireRole } from '@/lib/session'

interface Org {
  name: string
  logoUrl: string | null
  category: string
  entitlements: { features: Record<string, boolean> }
}

export default async function NewCardPage() {
  await requireRole('admin')
  const [org, profileQuestions] = await Promise.all([
    apiFetch<Org>('/v1/org'),
    apiFetch<ProfileQuestion[]>('/v1/org/profile-questions'),
  ])

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
        fallbackLogoUrl={org.logoUrl}
        category={org.category}
        canCustomiseBranding={org.entitlements.features.custom_branding ?? false}
        canUploadStampIcon={org.entitlements.features.custom_stamp_icons ?? false}
        canUseKiosk={org.entitlements.features.kiosk_mode ?? false}
        profileQuestions={profileQuestions}
        lengthLocked={false}
        initial={{
          name: '',
          stampsRequired: 8,
          design: {
            backgroundColor: '#1E3A8A',
            foregroundColor: '#FFFFFF',
            accentColor: '#FB923C',
            emptyStampColor: '#3A56A6',
            stampStyle: 'circle',
            stampIcon: { kind: 'preset', value: 'star' },
            logoUrl: null,
            banner: { kind: 'solid' },
            bannerPattern: 'none',
            bannerPatternOpacity: 12,
            headline: '',
            subheadline: '',
          },
          rewards: [{ atStamp: 8, title: '', description: '' }],
          signupQuestionIds: [],
          terms: '',
          collectBirthday: true,
          collectPhone: false,
          phoneRequired: false,
          initialStamps: 0,
          messages: { variants: [], perStamp: {} },
          rules: { cooldownMinutes: 30, dailyCap: 2, kioskEnabled: false },
        }}
      />
    </div>
  )
}
