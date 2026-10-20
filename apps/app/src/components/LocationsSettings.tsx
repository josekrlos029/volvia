'use client'

import { api } from '@/lib/api-client'
import { mapsUrl, parseCoordinates, roundCoordinate } from '@/lib/geo'
import { VARIABLE_HELP } from '@/lib/segments'
import { WEEKDAY_SHORT, WEEK_ORDER } from '@volvia/shared'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Panel, buttonClass } from './ui'

interface Location {
  id: string
  name: string
  address: string | null
  city: string | null
  phone: string | null
  latitude: number | null
  longitude: number | null
  hours: Array<{ day: number; opens: string; closes: string }>
}

type Pin = { latitude: number; longitude: number }

/** One range per weekday. A split shift saved through the API shows as its first range. */
type Week = Record<number, { open: boolean; opens: string; closes: string }>

const WEEKDAY_FULL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function weekFrom(hours: Location['hours']): Week {
  const week: Week = {}
  for (const day of WEEK_ORDER) week[day] = { open: false, opens: '09:00', closes: '18:00' }
  for (const entry of hours) {
    const current = week[entry.day]
    if (current && !current.open) {
      week[entry.day] = { open: true, opens: entry.opens, closes: entry.closes }
    }
  }
  return week
}

const field =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] placeholder:text-[#8A908A] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

/**
 * Where each branch is, for the wallets to surface the card when the customer walks up.
 *
 * There is no map and no geocoder on purpose: the owner is usually standing in the shop,
 * so the browser's own position is the quickest pin, and a pasted Maps link covers the
 * rest without a paid API behind it.
 */
export function LocationsSettings({
  locations,
  nearbyMessage,
}: {
  locations: Location[]
  nearbyMessage: string
}) {
  return (
    <Panel title="Sedes">
      <p className="mb-4 text-[13px] leading-snug text-[var(--color-ink-muted)]">
        Con la ubicación de cada sede, la tarjeta aparece sola en la pantalla de bloqueo del iPhone
        cuando el cliente está cerca (sin sonido) y Google Wallet le envía un aviso en Android. Solo
        pasa si tiene la tarjeta guardada en su Wallet y permite el acceso a su ubicación. La
        dirección, el teléfono y el horario de la primera sede también se muestran en el reverso de
        la tarjeta en Apple Wallet y en los detalles en Google Wallet.
      </p>
      <NearbyMessage saved={nearbyMessage} />
      <ul className="flex flex-col divide-y divide-[var(--color-line)]">
        {locations.map((location) => (
          <LocationRow key={location.id} location={location} />
        ))}
      </ul>
    </Panel>
  )
}

/** Variables worth using near the shop; the hour would be frozen at the last pass update. */
const NEARBY_VARIABLES = ['name', 'business', 'stamps', 'remaining'] as const
const NEARBY_MAX = 100

/** The business's own lock-screen line, in place of the stamp count. */
function NearbyMessage({ saved }: { saved: string }) {
  const router = useRouter()
  const [value, setValue] = useState(saved)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setStatus('saving')
    setError(null)
    try {
      await api.patch('/v1/org', { settings: { nearbyMessage: value.trim() } })
      setStatus('saved')
      router.refresh()
      setTimeout(() => setStatus('idle'), 2_000)
    } catch (caught) {
      setStatus('idle')
      setError(caught instanceof ApiError ? caught.message : 'No pudimos guardar el mensaje.')
    }
  }

  return (
    <div className="mb-5 flex flex-col gap-2 rounded-[11px] border border-[var(--color-line)] p-4">
      <label htmlFor="nearby-message" className="text-[14px] font-medium">
        Mensaje cuando el cliente está cerca
      </label>
      <input
        id="nearby-message"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={NEARBY_MAX}
        placeholder="Estás cerca de {{business}}. Llevas {{stamps}} sellos."
        className="w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] placeholder:text-[#8A908A] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25"
      />
      <div className="flex flex-wrap gap-1.5">
        {NEARBY_VARIABLES.map((name) => (
          <button
            key={name}
            type="button"
            title={VARIABLE_HELP[name]}
            onClick={() => setValue((current) => `${current}{{${name}}}`.slice(0, NEARBY_MAX))}
            className="rounded-full border border-[var(--color-line)] px-2.5 py-0.5 text-[12px] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)]"
          >
            {`{{${name}}}`}
          </button>
        ))}
      </div>
      <p className="text-[13px] leading-snug text-[var(--color-ink-muted)]">
        Se ve en el iPhone; Google Wallet muestra su propio aviso. Si el cliente tiene una
        recompensa lista o hay una campaña activa, se muestra eso primero. Déjalo vacío para mostrar
        los sellos que lleva. {value.length}/{NEARBY_MAX}
      </p>
      {error ? (
        <p role="alert" className="text-[13px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={status === 'saving' || value.trim() === saved}
          className={buttonClass('primary', 'sm')}
        >
          {status === 'saving' ? 'Guardando' : 'Guardar'}
        </button>
        {status === 'saved' ? (
          <span className="text-[14px] text-[var(--color-success)]">Guardado</span>
        ) : null}
      </div>
    </div>
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
      <p className="text-[14px] font-medium">{location.name}</p>

      <LocationDetails location={location} />

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

/**
 * What the pass says about the branch: where it is, how to call, when it opens. Saved
 * apart from the pin so a typo in the street never touches the coordinates.
 */
function LocationDetails({ location }: { location: Location }) {
  const router = useRouter()
  const [details, setDetails] = useState({
    address: location.address ?? '',
    city: location.city ?? '',
    phone: location.phone ?? '',
  })
  const [week, setWeek] = useState<Week>(() => weekFrom(location.hours))
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  function setDay(day: number, patch: Partial<Week[number]>) {
    setWeek({ ...week, [day]: { ...week[day]!, ...patch } })
  }

  async function save() {
    setStatus('saving')
    setError(null)
    try {
      await api.patch(`/v1/org/locations/${location.id}`, {
        address: details.address.trim() || null,
        city: details.city.trim() || null,
        phone: details.phone.trim() || null,
        hours: WEEK_ORDER.filter((day) => week[day]!.open).map((day) => ({
          day,
          opens: week[day]!.opens,
          closes: week[day]!.closes,
        })),
      })
      setStatus('saved')
      router.refresh()
      setTimeout(() => setStatus('idle'), 2_000)
    } catch {
      setStatus('idle')
      setError('No pudimos guardar los datos de la sede.')
    }
  }

  const id = (name: string) => `location-${name}-${location.id}`

  return (
    <div className="flex flex-col gap-3 rounded-[10px] bg-[var(--color-surface-muted)] p-3">
      <p className="text-[13px] font-medium">Datos de la sede</p>

      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
        <div className="flex flex-col gap-1">
          <label htmlFor={id('address')} className="text-[13px] text-[var(--color-ink-muted)]">
            Dirección
          </label>
          <input
            id={id('address')}
            value={details.address}
            onChange={(event) => setDetails({ ...details, address: event.target.value })}
            maxLength={200}
            placeholder="Calle 12 #4-56"
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={id('city')} className="text-[13px] text-[var(--color-ink-muted)]">
            Ciudad
          </label>
          <input
            id={id('city')}
            value={details.city}
            onChange={(event) => setDetails({ ...details, city: event.target.value })}
            maxLength={80}
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={id('phone')} className="text-[13px] text-[var(--color-ink-muted)]">
            Teléfono
          </label>
          <input
            id={id('phone')}
            type="tel"
            value={details.phone}
            onChange={(event) => setDetails({ ...details, phone: event.target.value })}
            maxLength={30}
            placeholder="+57 300 123 4567"
            className={field}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-[var(--color-ink-muted)]">Horario</p>
        <ul className="flex flex-col gap-1.5">
          {WEEK_ORDER.map((day) => {
            const entry = week[day]!
            return (
              <li
                key={day}
                className="grid grid-cols-[64px_1fr_auto_1fr] items-center gap-2 text-[13px]"
              >
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={entry.open}
                    onChange={(event) => setDay(day, { open: event.target.checked })}
                  />
                  {WEEKDAY_SHORT.es[day]}
                </label>
                {entry.open ? (
                  <>
                    <input
                      type="time"
                      step={900}
                      value={entry.opens}
                      onChange={(event) => setDay(day, { opens: event.target.value })}
                      aria-label={`Abre ${WEEKDAY_FULL[day]}`}
                      className={field}
                    />
                    <span className="text-[var(--color-ink-muted)]">a</span>
                    <input
                      type="time"
                      step={900}
                      value={entry.closes}
                      onChange={(event) => setDay(day, { closes: event.target.value })}
                      aria-label={`Cierra ${WEEKDAY_FULL[day]}`}
                      className={field}
                    />
                  </>
                ) : (
                  <span className="col-span-3 text-[var(--color-ink-muted)]">Cerrado</span>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-[9px] bg-[#FBEBEA] px-3.5 py-2.5 text-[13px] text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status === 'saving'}
          className={buttonClass('secondary', 'sm')}
        >
          {status === 'saving' ? 'Guardando' : 'Guardar datos'}
        </button>
        {status === 'saved' ? (
          <span className="text-[13px] text-[var(--color-success)]">Datos guardados</span>
        ) : null}
      </div>
    </div>
  )
}
