import { ArrowLeft, Minus, Plus } from '@phosphor-icons/react'
import type { RemoteLookupItem, StampResult } from '@volvia/shared'
import { MAX_STAMPS_PER_SCAN } from '@volvia/shared'
import { useState } from 'react'
import { api } from '../lib/api'
import { stampErrorMessage } from '../lib/messages'
import { CardFace } from './CardFace'
import { Button, Notice, Screen, field } from './ui'

/**
 * How many stamps, which order, then one button. One idempotency key per visit to
 * this screen: a double click, or a retry after the network dropped, can never stamp
 * twice.
 */
export function StampScreen({
  item,
  requireOrder,
  onBack,
  onStamped,
}: {
  item: RemoteLookupItem
  requireOrder: boolean
  onBack: () => void
  onStamped: (result: StampResult) => void
}) {
  const [count, setCount] = useState(1)
  const [order, setOrder] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [idempotencyKey] = useState(() => `ext-${crypto.randomUUID()}`)

  async function stamp() {
    setWorking(true)
    setError(null)
    try {
      const result = await api.post<StampResult>('/v1/stamp', {
        cardToken: item.cardToken,
        count,
        idempotencyKey,
        channel: 'remote',
        note: order.trim() ? `Pedido ${order.trim()}` : undefined,
      })
      onStamped(result)
    } catch (caught) {
      setError(stampErrorMessage(caught))
      setWorking(false)
    }
  }

  return (
    <Screen
      header={
        <>
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--color-surface-muted)]"
          >
            <ArrowLeft size={18} />
          </button>
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">
            {item.customer.firstName}
          </p>
        </>
      }
    >
      <CardFace
        design={item.design}
        filled={item.stampsCount}
        total={item.stampsRequired}
        title={`${item.stampsCount} de ${item.stampsRequired} sellos`}
      />

      {item.missingDocument ? <SaveDocument customerId={item.customer.id} /> : null}

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void stamp()
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[14px] font-medium">Sellos</span>
          <div className="flex items-center gap-1 rounded-[10px] border border-[var(--color-line)] bg-white p-1">
            <button
              type="button"
              aria-label="Uno menos"
              disabled={count <= 1}
              onClick={() => setCount(count - 1)}
              className="grid h-8 w-8 place-items-center rounded-[8px] hover:bg-[var(--color-surface-muted)] disabled:opacity-30"
            >
              <Minus size={16} />
            </button>
            <span className="tabular w-8 text-center text-[16px] font-semibold">{count}</span>
            <button
              type="button"
              aria-label="Uno más"
              disabled={count >= MAX_STAMPS_PER_SCAN}
              onClick={() => setCount(count + 1)}
              className="grid h-8 w-8 place-items-center rounded-[8px] hover:bg-[var(--color-surface-muted)] disabled:opacity-30"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          {requireOrder ? 'Número de pedido' : 'Número de pedido (opcional)'}
          <input
            value={order}
            onChange={(event) => setOrder(event.target.value)}
            placeholder="#4512"
            maxLength={60}
            required={requireOrder}
            className={field}
          />
        </label>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button type="submit" disabled={working || (requireOrder && !order.trim())}>
          {working ? 'Sellando' : count === 1 ? 'Añadir sello' : `Añadir ${count} sellos`}
        </Button>
      </form>
    </Screen>
  )
}

/** The card asks for a cédula and this customer has none: fill it in now, once. */
function SaveDocument({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  if (state === 'saved') {
    return <Notice>Cédula guardada. La próxima vez lo encuentras por ella.</Notice>
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-[13px] font-medium text-[var(--color-primary)]"
      >
        + Guardar cédula
      </button>
    )
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={async (event) => {
        event.preventDefault()
        setState('saving')
        try {
          await api.put(`/v1/remote/customers/${customerId}/document`, { documentNumber: value })
          setState('saved')
        } catch {
          setState('error')
        }
      }}
    >
      <input
        // biome-ignore lint/a11y/noAutofocus: opened by the click that asked for this field
        autoFocus
        inputMode="numeric"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Cédula del cliente"
        aria-invalid={state === 'error'}
        className={`${field} ${state === 'error' ? 'border-[var(--color-danger)]' : ''}`}
      />
      <Button type="submit" variant="secondary" disabled={state === 'saving' || value.length < 5}>
        Guardar
      </Button>
    </form>
  )
}
