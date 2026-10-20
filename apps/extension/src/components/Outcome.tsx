import type { RemoteLookupItem, StampResult } from '@volvia/shared'
import { readableOn } from '@volvia/shared'
import { useState } from 'react'
import { api } from '../lib/api'
import { CardFace } from './CardFace'
import { Button, Notice, Screen } from './ui'

/**
 * The result, in the card's own colours. A reward unlocked by a delivery is handed
 * over with the order: "Entregar ahora" redeems it on the spot.
 */
export function Outcome({
  item,
  result,
  onNext,
}: {
  item: RemoteLookupItem
  result: StampResult
  onNext: () => void
}) {
  const design = result.design ?? item.design
  const hasReward = result.unlockedRewards.length > 0
  // Completing the card resets it to 0 on the server; show it full next to the reward.
  const shown = hasReward && result.stampsCount === 0 ? result.stampsRequired : result.stampsCount
  const onAccent = readableOn(design.accentColor, [design.backgroundColor, design.foregroundColor])
  const toHandOver = hasReward
    ? result.unlockedRewards.map((reward) => ({
        grantId: reward.grantId,
        title: reward.title,
        code: reward.code,
      }))
    : result.pendingRewards.slice(0, 1)

  return (
    <Screen>
      {result.replayed ? <Notice>Este sello ya se había registrado.</Notice> : null}
      <CardFace
        design={design}
        filled={shown}
        total={result.stampsRequired}
        title={`${hasReward ? '¡Recompensa completada!' : 'Sello añadido'} · ${result.customer.firstName}`}
        animateLast
      >
        {hasReward ? (
          <ul className="mt-3 flex flex-col gap-2">
            {result.unlockedRewards.map((reward) => (
              <li
                key={reward.grantId}
                className="rounded-[12px] p-3"
                style={{ background: design.accentColor, color: onAccent }}
              >
                <p className="text-[15px] font-semibold">¡Ganó {reward.title}!</p>
                <p className="mt-1 font-mono text-[20px] font-semibold tracking-[0.16em]">
                  {reward.code}
                </p>
              </li>
            ))}
          </ul>
        ) : design.nextReward ? (
          <p className="mt-3 text-[14px] opacity-85">
            Le faltan {design.nextReward.atStamp - shown} para {design.nextReward.title}
          </p>
        ) : null}
        {!hasReward && result.pendingRewards.length > 0 ? (
          <p className="mt-2 text-[14px] opacity-85">
            Tiene {result.pendingRewards[0]!.title} sin recoger
          </p>
        ) : null}
      </CardFace>

      {toHandOver.map((reward) => (
        <HandOver key={reward.grantId} grantId={reward.grantId} title={reward.title} />
      ))}

      <Button className="mt-auto" onClick={onNext} autoFocus>
        Siguiente cliente
      </Button>
    </Screen>
  )
}

function HandOver({ grantId, title }: { grantId: string; title: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [idempotencyKey] = useState(() => `ext-redeem-${crypto.randomUUID()}`)

  if (state === 'done') return <Notice>Entregado: {title} va con este pedido.</Notice>
  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-white p-3">
      <p className="text-[13px] text-[var(--color-ink-muted)]">
        ¿Lo mandas con este pedido? Si no, queda guardado para la próxima.
      </p>
      <Button
        variant="secondary"
        disabled={state === 'working'}
        onClick={async () => {
          setState('working')
          try {
            await api.post('/v1/redeem', { grantId, idempotencyKey })
            setState('done')
          } catch {
            setState('error')
          }
        }}
      >
        {state === 'working' ? 'Entregando' : `Entregar ahora · ${title}`}
      </Button>
      {state === 'error' ? <Notice tone="danger">No pudimos entregar la recompensa.</Notice> : null}
    </div>
  )
}
