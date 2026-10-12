'use client'

import { api } from '@/lib/api-client'
import { readableOn } from '@volvia/shared'
import { LoyaltyCard, type LoyaltyCardDesign } from '@volvia/ui/components/LoyaltyCard'
import { useCallback, useEffect, useRef, useState } from 'react'

interface KioskProps {
  cardId: string
  locationId: string
  businessName: string
  cardName: string
  design: LoyaltyCardDesign
  stampsRequired: number
  rewards: Array<{ atStamp: number; title: string }>
  passUrl: string
}

interface LastStamp {
  at: number
  rewardUnlocked: boolean
}

/** How often the screen asks whether someone just stamped through it. */
const STATUS_POLL_MS = 3_000
const FLASH_MS = 2_400

/**
 * The kiosk screen.
 *
 * The QR it shows carries a nonce that expires in 30 seconds and dies on first use, so
 * photographing the screen buys nothing. The countdown ring tells a customer standing in
 * front of it that the code is live, not stale; when someone stamps, the screen flashes
 * in the card's accent and swaps the spent code for a fresh one at once.
 */
export function Kiosk({
  cardId,
  locationId,
  businessName,
  cardName,
  design,
  stampsRequired,
  rewards,
  passUrl,
}: KioskProps) {
  const [session, setSession] = useState<{ sessionId: string; secret: string } | null>(null)
  const [nonce, setNonce] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(30)
  const [ttl, setTtl] = useState(30)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<LastStamp | null>(null)
  const sessionRef = useRef(session)
  sessionRef.current = session
  const seenStampAt = useRef<number | null>(null)

  useEffect(() => {
    async function open() {
      try {
        const created = await api.post<{ sessionId: string; secret: string }>('/v1/kiosk/session', {
          cardId,
          locationId,
        })
        setSession(created)
      } catch {
        setError('No pudimos abrir el modo kiosko. Revisa que esté activado en la tarjeta.')
      }
    }
    void open()
  }, [cardId, locationId])

  const rotate = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    try {
      const issued = await api.post<{ nonce: string; expiresInSeconds: number }>(
        '/v1/kiosk/nonce',
        {
          sessionId: current.sessionId,
          secret: current.secret,
        },
      )
      setNonce(issued.nonce)
      setSecondsLeft(issued.expiresInSeconds)
      setTtl(issued.expiresInSeconds)
    } catch {
      setError('Se perdió la sesión del kiosko. Vuelve a abrir esta pantalla.')
    }
  }, [])

  // A fresh code every time the countdown runs out (or a stamp spends the current one).
  useEffect(() => {
    if (!session) return
    if (nonce === null || secondsLeft <= 0) void rotate()
  }, [rotate, session, nonce, secondsLeft])

  useEffect(() => {
    const tick = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1_000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    if (!session) return
    const poll = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const status = await api.post<{ lastStamp: LastStamp | null }>('/v1/kiosk/status', {
          sessionId: session.sessionId,
          secret: session.secret,
        })
        const last = status.lastStamp
        // The first answer only sets the baseline: a stamp from before the screen opened
        // is not news. No stamp yet counts as a baseline of zero.
        if (seenStampAt.current === null) {
          seenStampAt.current = last?.at ?? 0
          return
        }
        if (last && last.at > seenStampAt.current) {
          seenStampAt.current = last.at
          setFlash(last)
          setSecondsLeft(0)
        }
      } catch {
        // A missed poll is harmless; the next one catches up.
      }
    }, STATUS_POLL_MS)
    return () => clearInterval(poll)
  }, [session])

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), FLASH_MS)
    return () => clearTimeout(timer)
  }, [flash])

  if (error) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#0B1022] px-8 text-center">
        <p className="max-w-[40ch] text-[18px] leading-relaxed text-white/80">{error}</p>
      </main>
    )
  }

  const scanUrl = nonce ? `${passUrl}/k/${nonce}` : null
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
  const onAccent = readableOn(design.accentColor, ['#0F172A', '#FFFFFF'])

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-10 bg-[#0B1022] px-8 py-10 text-center text-white">
      <header>
        <p className="text-[15px] uppercase tracking-[0.18em] text-white/50">{businessName}</p>
        <h1 className="mt-3 text-[clamp(28px,5vw,44px)] font-semibold leading-tight tracking-[-0.02em]">
          Escanea para sumar tu sello
        </h1>
      </header>

      <div className="flex w-full max-w-[980px] flex-col items-center justify-center gap-10 md:flex-row md:items-center">
        <div className="w-full max-w-[380px] text-left">
          <LoyaltyCard
            businessName={businessName}
            cardName={cardName}
            design={design}
            filled={0}
            total={stampsRequired}
            rewardPositions={rewards.map((reward) => reward.atStamp)}
            nextReward={rewards[0] ?? null}
          />
        </div>

        <div className="flex flex-col items-center gap-5">
          <div className="rounded-[24px] bg-white p-6">
            {scanUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${apiUrl}/p/qr?data=${encodeURIComponent(scanUrl)}&size=520`}
                alt="Código para sumar tu sello"
                className="h-[280px] w-[280px] sm:h-[320px] sm:w-[320px]"
              />
            ) : (
              <div className="h-[280px] w-[280px] animate-pulse rounded-[12px] bg-[#E2E8F0] sm:h-[320px] sm:w-[320px]" />
            )}
          </div>

          <div className="flex items-center gap-3 text-white/60" aria-live="off">
            <CountdownRing secondsLeft={secondsLeft} total={ttl} color={design.accentColor} />
            <p className="tabular text-[16px]">El código cambia en {secondsLeft} s</p>
          </div>
        </div>
      </div>

      {flash ? (
        <output
          className="kiosk-flash absolute inset-0 flex flex-col items-center justify-center gap-4"
          style={{ background: design.accentColor, color: onAccent }}
        >
          <svg viewBox="0 0 24 24" className="h-24 w-24" aria-hidden="true">
            <path
              d="M20 6 9 17l-5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[clamp(36px,7vw,64px)] font-semibold tracking-[-0.02em]">
            {flash.rewardUnlocked ? '¡Recompensa desbloqueada!' : '¡Sello sumado!'}
          </span>
        </output>
      ) : null}
    </main>
  )
}

/** The time left on the current code, drawn as a ring that empties. */
function CountdownRing({
  secondsLeft,
  total,
  color,
}: {
  secondsLeft: number
  total: number
  color: string
}) {
  const radius = 15
  const circumference = 2 * Math.PI * radius
  const fraction = total > 0 ? Math.min(1, secondsLeft / total) : 0

  return (
    <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90" aria-hidden="true">
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="3"
      />
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  )
}
