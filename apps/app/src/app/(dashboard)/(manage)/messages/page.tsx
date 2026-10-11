import { MessageRowActions } from '@/components/MessageRowActions'
import { Badge, EmptyState, Panel, buttonClass } from '@/components/ui'
import { formatDate, formatNumber } from '@/lib/format'
import { MESSAGE_STATUS } from '@/lib/segments'
import { apiFetch } from '@/lib/session'
import type { MessageStatus } from '@volvia/shared'
import Link from 'next/link'

interface Message {
  id: string
  headline: string
  body: string
  status: MessageStatus
  scheduledAt: string | null
  sentAt: string | null
  createdAt: string
  targetedCount: number
  deliveredCount: number
}

export default async function MessagesPage() {
  const org = await apiFetch<{ entitlements: { features: Record<string, boolean> } }>('/v1/org')

  if (!org.entitlements.features.customer_messages) {
    return (
      <Panel>
        <EmptyState
          title="Los mensajes llegan con el plan Negocio"
          body="Un aviso corto que aparece en el teléfono de quienes llevan tu tarjeta en la wallet: para contar una novedad, traer de vuelta a los fríos o agradecer a los de siempre."
        />
      </Panel>
    )
  }

  const list = await apiFetch<{
    messages: Message[]
    thisMonth: { used: number; limit: number | null }
  }>('/v1/messages')
  const { used, limit } = list.thisMonth

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Mensajes</h1>
          <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
            Un aviso en el teléfono de quien lleva tu tarjeta en la wallet. Sin app, sin correo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {limit !== null ? (
            <p
              className={`tabular rounded-full px-3 py-1.5 text-[13px] font-medium ${
                used >= limit
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-warning)]'
                  : 'bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]'
              }`}
            >
              {used} de {limit} este mes
            </p>
          ) : null}
          <Link href="/messages/new" className={buttonClass('primary', 'sm')}>
            Nuevo mensaje
          </Link>
        </div>
      </header>

      {list.messages.length === 0 ? (
        <Panel>
          <EmptyState
            title="Todavía sin mensajes"
            body="Empieza por uno: a los fríos, a quienes les falta un sello, o a todos con una novedad."
            action={
              <Link href="/messages/new" className={buttonClass('secondary')}>
                Escribir el primero
              </Link>
            }
          />
        </Panel>
      ) : (
        <Panel title="Historial">
          <ul className="flex flex-col divide-y divide-[var(--color-line)]">
            {list.messages.map((message) => (
              <li key={message.id} className="py-3 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{message.headline}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-[var(--color-ink-muted)]">
                      {message.body}
                    </p>
                  </div>
                  <Badge tone={MESSAGE_STATUS[message.status].tone}>
                    {MESSAGE_STATUS[message.status].label}
                  </Badge>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="tabular text-[13px] text-[var(--color-ink-muted)]">
                    {formatDate(message.sentAt ?? message.scheduledAt ?? message.createdAt)}
                    {message.status === 'sent' || message.status === 'sending'
                      ? ` · ${formatNumber(message.targetedCount)} clientes · ${formatNumber(message.deliveredCount)} entregados`
                      : ''}
                  </p>
                  {message.status === 'scheduled' ? (
                    <MessageRowActions messageId={message.id} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
