'use client'

import { api } from '@/lib/api-client'
import { useCallback, useEffect, useRef, useState } from 'react'

interface KioskProps {
  cardId: string
  locationId: string
  businessName: string
  cardName: string
  passUrl: string
}

/**
 * The kiosk screen.
 *
 * The QR it shows carries a nonce that expires in 30 seconds and dies on first use, so
 * photographing the screen buys nothing. The countdown ring exists to tell a customer
 * standing in front of it that the code is live, not stale.
 */
export function Kiosk({ cardId, locationId, businessName, cardName, passUrl }: KioskProps) {
  const [session, setSession] = useState<{ sessionId: string; secret: string } | null>(null)
  const [nonce, setNonce] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(30)
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef(session)
  sessionRef.current = session

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
    } catch {
      setError('Se perdió la sesión del kiosko. Vuelve a abrir esta pantalla.')
    }
  }, [])

  useEffect(() => {
    if (!session) return
    void rotate()
    const interval = setInterval(() => void rotate(), 30_000)
    return () => clearInterval(interval)
  }, [rotate, session])

  useEffect(() => {
    const tick = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1_000)
    return () => clearInterval(tick)
  }, [])

  if (error) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#0B0D0B] px-8 text-center">
        <p className="max-w-[40ch] text-[18px] leading-relaxed text-white/80">{error}</p>
      </main>
    )
  }

  const scanUrl = nonce ? `${passUrl}/k/${nonce}` : null
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-[#0B0D0B] px-8 text-center text-white">
      <header>
        <p className="text-[15px] uppercase tracking-[0.18em] text-white/50">{businessName}</p>
        <h1 className="mt-3 text-[clamp(28px,5vw,44px)] font-semibold leading-tight tracking-[-0.02em]">
          Escanea para sumar tu sello
        </h1>
        <p className="mt-3 text-[18px] text-white/60">{cardName}</p>
      </header>

      <div className="relative">
        <div className="rounded-[24px] bg-white p-6">
          {scanUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${apiUrl}/p/qr?data=${encodeURIComponent(scanUrl)}&size=520`}
              alt="Código para sumar tu sello"
              className="h-[280px] w-[280px] sm:h-[340px] sm:w-[340px]"
            />
          ) : (
            <div className="h-[280px] w-[280px] animate-pulse rounded-[12px] bg-[#E6E9E6] sm:h-[340px] sm:w-[340px]" />
          )}
        </div>
      </div>

      <p className="tabular text-[16px] text-white/50" aria-live="off">
        El código cambia en {secondsLeft} s
      </p>
    </main>
  )
}
