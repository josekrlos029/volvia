import { MagnifyingGlass, SignOut } from '@phosphor-icons/react'
import type {
  RemoteLookupItem,
  RemoteLookupResult,
  RemoteStatus,
  StampResult,
} from '@volvia/shared'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { masked, stampErrorMessage } from '../lib/messages'
import { takePendingQuery } from '../lib/pending-query'
import { type Recent, loadRecents, rememberRecent } from '../lib/recents'
import type { StoredSession } from '../lib/session'
import { Outcome } from './Outcome'
import { StampScreen } from './StampScreen'
import { Button, Notice, Screen, field } from './ui'

const DEBOUNCE_MS = 300

type View =
  | { kind: 'search' }
  | { kind: 'stamp'; item: RemoteLookupItem }
  | { kind: 'outcome'; item: RemoteLookupItem; result: StampResult }

export function Home({
  session,
  onSwitchOrg,
  onSignOut,
}: {
  session: StoredSession
  onSwitchOrg: () => void
  onSignOut: () => void
}) {
  const orgId = session.orgId!
  const membership = session.user.memberships.find((item) => item.orgId === orgId)
  const [status, setStatus] = useState<RemoteStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'search' })
  const [query, setQuery] = useState('')

  useEffect(() => {
    api
      .get<RemoteStatus>('/v1/remote/status')
      .then(setStatus)
      .catch((caught) => setStatusError(stampErrorMessage(caught)))
    void takePendingQuery().then((pending) => pending && setQuery(pending))
  }, [])

  const header = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">
          {status?.businessName ?? membership?.orgName ?? 'Volvia Biz'}
        </p>
        {session.user.memberships.length > 1 ? (
          <button
            type="button"
            onClick={onSwitchOrg}
            className="text-[12px] font-medium text-[var(--color-primary)]"
          >
            Cambiar de negocio
          </button>
        ) : (
          <p className="truncate text-[12px] text-[var(--color-ink-muted)]">{session.user.name}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onSignOut}
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
        className="grid h-9 w-9 place-items-center rounded-full text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]"
      >
        <SignOut size={18} />
      </button>
    </>
  )

  if (statusError) {
    return (
      <Screen header={header}>
        <Notice tone="danger">{statusError}</Notice>
      </Screen>
    )
  }
  if (!status) return <Screen header={header}>{null}</Screen>
  if (!status.enabled) {
    return (
      <Screen header={header}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-2 text-center">
          <p className="text-[16px] font-semibold">Sellos a distancia apagados</p>
          <p className="text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
            Tu negocio aún no permite sellos a distancia. Pídele al dueño que lo active en el panel,
            en Equipo → Sellos a distancia.
          </p>
        </div>
      </Screen>
    )
  }

  if (view.kind === 'stamp') {
    return (
      <StampScreen
        item={view.item}
        requireOrder={status.requireOrder}
        onBack={() => setView({ kind: 'search' })}
        onStamped={async (result) => {
          await rememberRecent(orgId, view.item, result.stampsCount)
          setView({ kind: 'outcome', item: view.item, result })
        }}
      />
    )
  }
  if (view.kind === 'outcome') {
    return (
      <Outcome
        item={view.item}
        result={view.result}
        onNext={() => {
          setQuery('')
          setView({ kind: 'search' })
        }}
      />
    )
  }

  return (
    <Screen header={header}>
      <Search
        orgId={orgId}
        query={query}
        onQuery={setQuery}
        onPick={(item) => setView({ kind: 'stamp', item })}
      />
    </Screen>
  )
}

function Search({
  orgId,
  query,
  onQuery,
  onPick,
}: {
  orgId: string
  query: string
  onQuery: (query: string) => void
  onPick: (item: RemoteLookupItem) => void
}) {
  const [result, setResult] = useState<RemoteLookupResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recents, setRecents] = useState<Recent[]>([])
  const [copied, setCopied] = useState(false)
  const latest = useRef(0)

  useEffect(() => {
    void loadRecents(orgId).then(setRecents)
  }, [orgId])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResult(null)
      setError(null)
      return
    }
    const ticket = ++latest.current
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const found = await api.get<RemoteLookupResult>('/v1/remote/lookup', { query: { q } })
        // Only the answer to what is in the box now; slower earlier answers are dropped.
        if (ticket === latest.current) {
          setResult(found)
          setError(null)
        }
      } catch (caught) {
        if (ticket === latest.current) setError(stampErrorMessage(caught))
      } finally {
        if (ticket === latest.current) setSearching(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const q = query.trim()

  return (
    <>
      <label className="relative block">
        <span className="sr-only">Buscar cliente</span>
        <MagnifyingGlass
          size={18}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--color-ink-muted)]"
        />
        <input
          // biome-ignore lint/a11y/noAutofocus: the popup exists to type a search; focus belongs here
          autoFocus
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Cédula, teléfono o nombre"
          className={`${field} py-3 pl-10 text-[15px]`}
        />
      </label>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {q.length < 2 ? (
        recents.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
              Recientes
            </h2>
            <ul className="flex flex-col gap-1.5">
              {recents.map((recent) => (
                <li key={recent.query}>
                  <button
                    type="button"
                    onClick={async () => {
                      // Fresh numbers, straight to the stamp screen.
                      try {
                        const found = await api.get<RemoteLookupResult>('/v1/remote/lookup', {
                          query: { q: recent.query },
                        })
                        if (found.items[0]) onPick(found.items[0])
                        else setError('Esa tarjeta ya no está activa.')
                      } catch (caught) {
                        setError(stampErrorMessage(caught))
                      }
                    }}
                    className="flex w-full items-center gap-3 rounded-[10px] bg-white px-3.5 py-2.5 text-left hover:bg-[var(--color-primary-soft)]"
                  >
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                      {recent.firstName}
                    </span>
                    {recent.tail ? (
                      <span className="text-[12px] text-[var(--color-ink-muted)]">
                        {masked(recent.tail)}
                      </span>
                    ) : null}
                    <span className="tabular text-[12px] text-[var(--color-ink-muted)]">
                      {recent.stampsCount}/{recent.stampsRequired}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="px-1 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
            Escribe la cédula, el teléfono o el nombre del cliente del pedido. También puedes
            seleccionar un número en cualquier página y elegir «Buscar en Volvia» con el clic
            derecho.
          </p>
        )
      ) : result && result.items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {result.items.map((item) => (
            <li key={item.customerCardId}>
              <ResultRow item={item} onPick={() => onPick(item)} />
            </li>
          ))}
        </ul>
      ) : result && !searching ? (
        <div className="flex flex-col items-center gap-3 rounded-[12px] bg-white px-4 py-6 text-center">
          <p className="text-[14px]">
            No encontramos a nadie con «<span className="font-medium">{q}</span>».
          </p>
          {result.joinUrl ? (
            <>
              <p className="text-[13px] text-[var(--color-ink-muted)]">
                Mándale el enlace para que se inscriba y quede su tarjeta lista para el próximo
                pedido.
              </p>
              <Button
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(result.joinUrl!)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
              >
                {copied ? 'Enlace copiado' : 'Copiar enlace de inscripción'}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

function ResultRow({ item, onPick }: { item: RemoteLookupItem; onPick: () => void }) {
  const details = [
    item.customer.documentTail ? `CC ${masked(item.customer.documentTail)}` : null,
    item.customer.phoneTail ? `Tel ${masked(item.customer.phoneTail)}` : null,
  ].filter(Boolean)
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full flex-col gap-1.5 rounded-[12px] border border-transparent bg-white px-4 py-3 text-left shadow-sm hover:border-[var(--color-primary)]"
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[15px] font-semibold">{item.customer.firstName}</span>
        <span className="tabular shrink-0 text-[13px] font-medium">
          {item.stampsCount}/{item.stampsRequired}
        </span>
      </span>
      {details.length > 0 ? (
        <span className="text-[12px] text-[var(--color-ink-muted)]">{details.join(' · ')}</span>
      ) : null}
      <span className="flex items-center gap-2 text-[12px]">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: item.design.backgroundColor }}
        />
        <span className="truncate">{item.design.cardName}</span>
      </span>
      {item.pendingRewards > 0 ? (
        <span className="text-[12px] font-medium text-[var(--color-secondary)]">
          Tiene {item.pendingRewards} {item.pendingRewards === 1 ? 'premio' : 'premios'} sin recoger
        </span>
      ) : null}
    </button>
  )
}
