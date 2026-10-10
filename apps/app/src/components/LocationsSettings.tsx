'use client'

import { api } from '@/lib/api-client'
import { mapsUrl, parseCoordinates, roundCoordinate } from '@/lib/geo'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Panel, buttonClass } from './ui'

interface Location {
  id: string
  name: string
  address: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
}

type Pin = { latitude: number; longitude: number }

const field =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] placeholder:text-[#8A908A] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

/**
 * Where each branch is, for the wallets to surface the card when the customer walks up.
 *
 * There is no map and no geocoder on purpose: the owner is usually standing in the shop,
 * so the browser's own position is the quickest pin, and a pasted Maps link covers the
 * rest without a paid API behind it.
 */
export function LocationsSettings({ locations }: { locations: Location[] }) {
  return (
    <Panel title="Sedes">
      <p className="mb-4 text-[13px] leading-snug text-[var(--color-ink-muted)]">
        Con la ubicación de cada sede, la tarjeta aparece sola en la pantalla de bloqueo del iPhone
        cuando el cliente está cerca (sin sonido) y Google Wallet le envía un aviso en Android. Solo
        pasa si tiene la tarjeta guardada en su Wallet y permite el acceso a su ubicación.
      </p>
      <ul className="flex flex-col divide-y divide-[var(--color-line)]">
        {locations.map((location) => (
          <LocationRow key={location.id} location={location} />
        ))}
      </ul>
    </Panel>
  )
}

function LocationRow({ location }: { location: Location }) {
  const router = useRouter()
  const [pin, setPin] = useState<Pin | null>(
    location.latitude !== null && location.longitude !== null
      ? { latitude: location.latitude, longitude: location.longitude }
      : null,
  )
  const [pasted, setPasted] = useState('')
  const [status, setStatus] = useState<'idle' | 'locating' | 'saving' | 'saved'>('idle')
  const [notice, setNotice] = useState<{ tone: 'error' | 'warning'; text: string } | null>(null)

  const busy = status === 'locating' || status === 'saving'

  async function save(next: Pin | null): Promise<boolean> {
    setStatus('saving')
    setNotice(null)
    try {
      await api.patch(
        `/v1/org/locations/${location.id}`,
        next ?? { latitude: null, longitude: null },
      )
      setPin(next)
      setPasted('')
      setStatus('saved')
      router.refresh()
      setTimeout(() => setStatus('idle'), 2_000)
      return true
    } catch {
      setStatus('idle')
      setNotice({ tone: 'error', text: 'No pudimos guardar la ubicación.' })
      return false
    }
  }

  function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation || !window.isSecureContext) {
      setNotice({ tone: 'error', text: 'Tu navegador no permite usar la ubicación aquí.' })
      return
    }
    setStatus('locating')
    setNotice(null)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords
        const saved = await save({
          latitude: roundCoordinate(latitude),
          longitude: roundCoordinate(longitude),
        })
        // Indoors a phone can be off by a street. Say so instead of pinning silently.
        if (saved && accuracy > 100) {
          setNotice({
            tone: 'warning',
            text: `Precisión baja (±${Math.round(accuracy)} m): mejor desde la puerta del local, o pega el enlace de Google Maps.`,
          })
        }
      },
      (error) => {
        setStatus('idle')
        setNotice({
          tone: 'error',
          text:
            error.code === error.PERMISSION_DENIED
              ? 'Permite el acceso a la ubicación en el navegador.'
              : 'No pudimos obtener tu ubicación. Intenta de nuevo o pega un enlace.',
        })
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }

  function applyPasted() {
    const parsed = parseCoordinates(pasted)
    if (!parsed.ok) {
      setNotice({
        tone: 'error',
        text:
          parsed.reason === 'short_link'
            ? 'Ese es un enlace corto. Ábrelo en Google Maps, copia la dirección larga de la barra del navegador y pégala aquí.'
            : 'No encontramos coordenadas en ese texto.',
      })
      return
    }
    void save({ latitude: parsed.latitude, longitude: parsed.longitude })
  }

  const pasteId = `location-paste-${location.id}`

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div>
        <p className="text-[14px] font-medium">{location.name}</p>
        <p className="text-[13px] text-[var(--color-ink-muted)]">
          {[location.address, location.city].filter(Boolean).join(', ') || 'Sin dirección'}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-[10px] bg-[var(--color-surface-muted)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-medium">Ubicación para avisos de cercanía</p>
          {pin ? (
            <a
              href={mapsUrl(pin.latitude, pin.longitude)}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] font-medium text-[var(--color-primary)] underline underline-offset-2"
            >
              Ver en Google Maps
            </a>
          ) : null}
        </div>

        <p className="tabular text-[13px] text-[var(--color-ink-muted)]">
          {pin ? `${pin.latitude}, ${pin.longitude}` : 'Sin ubicación'}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={locate}
            disabled={busy}
            className={buttonClass('secondary', 'sm')}
          >
            {status === 'locating' ? 'Buscando tu ubicación' : 'Usar mi ubicación actual'}
          </button>
          {pin ? (
            <button
              type="button"
              onClick={() => void save(null)}
              disabled={busy}
              className={buttonClass('ghost', 'sm')}
            >
              Quitar ubicación
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={pasteId} className="text-[13px] text-[var(--color-ink-muted)]">
            O pega un enlace de Google Maps o las coordenadas
          </label>
          <div className="flex gap-2">
            <input
              id={pasteId}
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  applyPasted()
                }
              }}
              className={field}
              placeholder="https://www.google.com/maps/place/…"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={applyPasted}
              disabled={busy || pasted.trim() === ''}
              className={buttonClass('secondary', 'sm')}
            >
              Aplicar
            </button>
          </div>
        </div>

        {notice ? (
          <p
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={
              notice.tone === 'error'
                ? 'rounded-[9px] bg-[#FBEBEA] px-3.5 py-2.5 text-[13px] text-[var(--color-danger)]'
                : 'rounded-[9px] bg-[var(--color-accent-soft)] px-3.5 py-2.5 text-[13px] text-[var(--color-warning)]'
            }
          >
            {notice.text}
          </p>
        ) : null}
        {status === 'saved' ? (
          <p className="text-[13px] text-[var(--color-success)]">Ubicación guardada</p>
        ) : null}
      </div>
    </li>
  )
}
