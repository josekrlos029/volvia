import { CardEditor } from '@/components/CardEditor'
import type { ProfileQuestion } from '@/components/SignupFormEditor'
import { apiFetch } from '@/lib/session'

interface Org {
  name: string
  entitlements: { features: Record<string, boolean> }
}

export default async function NewCardPage() {
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
        canCustomiseBranding={org.entitlements.features.custom_branding ?? false}
        canUseKiosk={org.entitlements.features.kiosk_mode ?? false}
        profileQuestions={profileQuestions}
        lengthLocked={false}
        initial={{
          name: '',
          stampsRequired: 8,
          design: {
            backgroundColor: '#14171A',
            foregroundColor: '#FFFFFF',
            accentColor: '#E9A23B',
            emptyStampColor: '#31363A',
            stampStyle: 'circle',
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
          initialStamps: 0,
          messages: { variants: [], perStamp: {} },
          rules: { cooldownMinutes: 30, dailyCap: 2, kioskEnabled: false },
        }}
      />
    </div>
  )
}
