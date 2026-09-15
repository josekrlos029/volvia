'use client'

import { api } from '@/lib/api-client'
import {
  type QueuedScan,
  enqueueScan,
  flushQueue,
  newIdempotencyKey,
  pendingScans,
  removeScan,
} from '@/lib/scan-queue'
import { ApiError } from '@volvia/shared/client'
import { BrowserQRCodeReader } from '@zxing/browser'
import { useCallback, useEffect, useRef, useState } from 'react'

interface StampResult {
  stampsAdded: number
  stampsCount: number
  stampsRequired: number
  unlockedRewards: Array<{ grantId: string; title: string; code: string }>
  pendingRewards: Array<{ grantId: string; title: string; code: string }>
  customer: { firstName: string }
  replayed: boolean
}

type Status =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'success'; result: StampResult }
  | { kind: 'queued'; label: string }
  | { kind: 'error'; message: string }

export function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [online, setOnline] = useState(true)
  const [queued, setQueued] = useState<QueuedScan[]>([])
  const [cameraError, setCameraError] = useState<string | null>(null)
  // Guards against the reader firing the same code many times per second.
  const lastScanRef = useRef<{ token: string; at: number } | null>(null)

  const refreshQueue = useCallback(() => setQueued(pendingScans()), [])

  const sendScan = useCallback(async (scan: QueuedScan) => {
    await api.post<StampResult>('/v1/stamp', {
      cardToken: scan.cardToken,
      count: scan.count,
      idempotencyKey: scan.idempotencyKey,
      occurredAt: scan.occurredAt,
    })
  }, [])

  const flush = useCallback(async () => {
    const { sent } = await flushQueue(sendScan)
    if (sent > 0) refreshQueue()
  }, [refreshQueue, sendScan])

  useEffect(() => {
    refreshQueue()
    setOnline(navigator.onLine)

    const goOnline = () => {
      setOnline(true)
      void flush()
    }
    const goOffline = () => setOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [flush, refreshQueue])

  const handleToken = useCallback(
    async (cardToken: string) => {
      const now = Date.now()
      // The camera reports the same QR continuously while it is in frame.
      if (lastScanRef.current?.token === cardToken && now - lastScanRef.current.at < 4_000) return
      lastScanRef.current = { token: cardToken, at: now }

      const scan: QueuedScan = {
        idempotencyKey: newIdempotencyKey(),
        cardToken,
        count: 1,
        occurredAt: new Date().toISOString(),
        label: `${cardToken.slice(0, 6)}…`,
      }

      if (!navigator.onLine) {
        enqueueScan(scan)
        refreshQueue()
        setStatus({ kind: 'queued', label: scan.label })
        navigator.vibrate?.(60)
        return
      }

      try {
        const result = await api.post<StampResult>('/v1/stamp', {
          cardToken: scan.cardToken,
          count: 1,
          idempotencyKey: scan.idempotencyKey,
        })
        setStatus({ kind: 'success', result })
        // Two short pulses: staff feel the confirmation without looking at the screen.
        navigator.vibrate?.([40, 60, 40])
      } catch (caught) {
        if (caught instanceof ApiError) {
          if (caught.code === 'STAMP_COOLDOWN_ACTIVE') {
            setStatus({ kind: 'error', message: 'Este cliente ya recibió un sello hace poco.' })
          } else if (caught.code === 'STAMP_DAILY_CAP_REACHED') {
            setStatus({ kind: 'error', message: 'Llegó al máximo de sellos por hoy.' })
          } else if (caught.code === 'CUSTOMER_CARD_NOT_FOUND') {
            setStatus({ kind: 'error', message: 'Ese código no corresponde a una tarjeta activa.' })
          } else {
            setStatus({ kind: 'error', message: caught.message })
          }
          navigator.vibrate?.(200)
          return
        }

        // A network failure is the case the queue exists for.
        enqueueScan(scan)
        refreshQueue()
        setStatus({ kind: 'queued', label: scan.label })
      }
    },
    [refreshQueue],
  )

  useEffect(() => {
    const reader = new BrowserQRCodeReader()
    let cancelled = false

    async function start() {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result) => {
            if (!result || cancelled) return
            const text = result.getText()
            // The QR encodes the customer's card URL; the token is its last segment.
            const token = text.split('/').pop()?.split('?')[0]
            if (token && token.length >= 16) void handleToken(token)
          },
        )
        controlsRef.current = controls
        if (!cancelled) setStatus({ kind: 'scanning' })
      } catch {
        setCameraError(
          'No pudimos abrir la cámara. Revisa los permisos del navegador e intenta de nuevo.',
        )
      }
    }

    void start()
    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [handleToken])

  return (
    <div className="scanner-surface flex flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <a href="/" className="text-[14px] font-medium text-white/70">
          Salir
        </a>
        <div className="flex items-center gap-3 text-[13px]">
          {!online ? <span className="text-[#F0C36B]">Sin conexión</span> : null}
          {queued.length > 0 ? (
            <span className="text-white/70">{queued.length} por enviar</span>
          ) : null}
        </div>
      </header>

      <div className="relative mx-4 aspect-square overflow-hidden rounded-[16px] bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {/* A frame gives staff something to aim at rather than a bare video feed. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[14%] rounded-[12px] border-2 border-white/45"
        />
        {cameraError ? (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-[14px] leading-relaxed text-white/80">
            {cameraError}
          </p>
        ) : null}
      </div>

      <div className="flex-1 px-4 py-5" aria-live="polite">
        {status.kind === 'scanning' || status.kind === 'idle' ? (
          <p className="text-center text-[15px] text-white/60">
            Apunta al código de la tarjeta del cliente.
          </p>
        ) : null}

        {status.kind === 'success' ? <SuccessCard result={status.result} /> : null}

        {status.kind === 'queued' ? (
          <div className="rounded-[14px] bg-[#2A2416] p-4 text-[#F0C36B]">
            <p className="text-[16px] font-semibold">Sello guardado</p>
            <p className="mt-1 text-[14px] leading-snug opacity-85">
              Se enviará solo cuando vuelva la conexión. El cliente ya lo tiene contado.
            </p>
          </div>
        ) : null}

        {status.kind === 'error' ? (
          <div className="rounded-[14px] bg-[#3A1A18] p-4 text-[#F2B8B5]">
            <p className="text-[16px] font-semibold">No se pudo sellar</p>
            <p className="mt-1 text-[14px] leading-snug opacity-90">{status.message}</p>
          </div>
        ) : null}
      </div>

      {queued.length > 0 && online ? (
        <div className="border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={() => void flush()}
            className="w-full rounded-[10px] bg-white/10 px-4 py-3 text-[15px] font-medium text-white"
          >
            Enviar {queued.length} sello{queued.length === 1 ? '' : 's'} pendiente
            {queued.length === 1 ? '' : 's'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SuccessCard({ result }: { result: StampResult }) {
  const hasReward = result.unlockedRewards.length > 0

  return (
    <div
      className={[
        'rounded-[14px] p-4',
        hasReward ? 'bg-[#E9A23B] text-[#14171A]' : 'bg-[#173D2E] text-[#C8EBD8]',
      ].join(' ')}
    >
      <p className="text-[18px] font-semibold leading-tight">
        {hasReward ? '¡Recompensa completada!' : 'Sello añadido'}
      </p>
      <p className="tabular mt-1 text-[15px] opacity-90">
        {result.customer.firstName} · {result.stampsCount} de {result.stampsRequired}
      </p>

      {hasReward ? (
        <ul className="mt-3 flex flex-col gap-2">
          {result.unlockedRewards.map((reward) => (
            <li key={reward.grantId} className="rounded-[10px] bg-white/80 p-3">
              <p className="text-[15px] font-semibold">{reward.title}</p>
              <p className="font-[family-name:var(--font-geist-mono)] mt-1 text-[20px] font-semibold tracking-[0.16em]">
                {reward.code}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {!hasReward && result.pendingRewards.length > 0 ? (
        <p className="mt-2 text-[14px] opacity-85">
          Tiene {result.pendingRewards.length} recompensa
          {result.pendingRewards.length === 1 ? '' : 's'} sin reclamar.
        </p>
      ) : null}

      {result.replayed ? (
        <p className="mt-2 text-[13px] opacity-75">Este escaneo ya se había registrado.</p>
      ) : null}
    </div>
  )
}
