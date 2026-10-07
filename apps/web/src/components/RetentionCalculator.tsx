'use client'

import type { Locale } from '@/lib/i18n'
import { useMemo, useState } from 'react'

/**
 * What one more visit a month is worth.
 *
 * The point is not precision, it is scale: a shop owner deciding whether loyalty is
 * worth their time needs to see the order of magnitude, and the assumptions have to be
 * visible so they can argue with them.
 */
export function RetentionCalculator({ locale }: { locale: Locale }) {
  const isSpanish = locale === 'es'
  const [customers, setCustomers] = useState(200)
  const [ticket, setTicket] = useState(isSpanish ? 25_000 : 12)
  const [extraVisits, setExtraVisits] = useState(1)
  const [rewardCost, setRewardCost] = useState(isSpanish ? 8_000 : 4)
  const [stampsPerReward, setStampsPerReward] = useState(8)

  const result = useMemo(() => {
    const extraVisitsPerYear = customers * extraVisits * 12
    const extraRevenue = extraVisitsPerYear * ticket
    // One reward is handed out for every full card, so reward cost scales with visits.
    const rewardsGiven = Math.floor(extraVisitsPerYear / stampsPerReward)
    const rewardSpend = rewardsGiven * rewardCost
    return {
      extraVisitsPerYear,
      extraRevenue,
      rewardsGiven,
      rewardSpend,
      net: extraRevenue - rewardSpend,
    }
  }, [customers, extraVisits, rewardCost, stampsPerReward, ticket])

  const money = (value: number) =>
    new Intl.NumberFormat(isSpanish ? 'es-CO' : 'en-US', {
      style: 'currency',
      currency: isSpanish ? 'COP' : 'USD',
      maximumFractionDigits: 0,
    }).format(value)

  const number = (value: number) =>
    new Intl.NumberFormat(isSpanish ? 'es-CO' : 'en-US').format(value)

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-12">
      <div className="flex flex-col gap-5">
        <Slider
          label={isSpanish ? 'Clientes en tu tarjeta' : 'Customers on your card'}
          value={customers}
          min={20}
          max={2000}
          step={20}
          onChange={setCustomers}
          format={number}
        />
        <Slider
          label={isSpanish ? 'Ticket promedio' : 'Average ticket'}
          value={ticket}
          min={isSpanish ? 5_000 : 3}
          max={isSpanish ? 120_000 : 60}
          step={isSpanish ? 1_000 : 1}
          onChange={setTicket}
          format={money}
        />
        <Slider
          label={
            isSpanish ? 'Visitas extra al mes por cliente' : 'Extra visits per customer per month'
          }
          value={extraVisits}
          min={0.25}
          max={4}
          step={0.25}
          onChange={setExtraVisits}
          format={(value) => value.toFixed(2).replace(/\.00$/, '')}
        />
        <Slider
          label={isSpanish ? 'Sellos por recompensa' : 'Stamps per reward'}
          value={stampsPerReward}
          min={4}
          max={12}
          step={1}
          onChange={setStampsPerReward}
          format={number}
        />
        <Slider
          label={isSpanish ? 'Costo de cada recompensa' : 'Cost of each reward'}
          value={rewardCost}
          min={isSpanish ? 1_000 : 1}
          max={isSpanish ? 60_000 : 30}
          step={isSpanish ? 500 : 1}
          onChange={setRewardCost}
          format={money}
        />
      </div>

      <div className="rounded-[16px] bg-[var(--color-inverse-surface)] p-6 text-white">
        <p className="text-[13px] uppercase tracking-[0.14em] text-white/50">
          {isSpanish ? 'En un año' : 'Over a year'}
        </p>

        <p className="mt-4 text-[clamp(30px,5vw,44px)] leading-none tracking-[-0.02em] tabular-nums">
          {money(result.net)}
        </p>
        <p className="mt-2 text-[15px] text-white/60">
          {isSpanish
            ? 'de ingreso extra, ya descontadas las recompensas'
            : 'in extra revenue, after the reward cost'}
        </p>

        <dl className="mt-8 flex flex-col gap-4 border-t border-white/12 pt-6 text-[15px]">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-white/60">{isSpanish ? 'Visitas extra' : 'Extra visits'}</dt>
            <dd className="tabular-nums">{number(result.extraVisitsPerYear)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-white/60">{isSpanish ? 'Ingreso bruto' : 'Gross revenue'}</dt>
            <dd className="tabular-nums">{money(result.extraRevenue)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-white/60">
              {isSpanish ? 'Recompensas entregadas' : 'Rewards handed out'}
            </dt>
            <dd className="tabular-nums">{number(result.rewardsGiven)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-white/60">{isSpanish ? 'Costo de recompensas' : 'Reward cost'}</dt>
            <dd className="tabular-nums">{money(result.rewardSpend)}</dd>
          </div>
        </dl>

        <p className="mt-6 text-[13px] leading-relaxed text-white/45">
          {isSpanish
            ? 'Supone que cada cliente en la tarjeta suma las visitas extra que indicas. No incluye el costo del plan ni el margen de tus productos.'
            : 'Assumes every customer on the card adds the extra visits you set. It excludes the plan cost and your product margin.'}
        </p>
      </div>
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format: (value: number) => string
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, '-')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[14px]">
          {label}
        </label>
        <output htmlFor={id} className="text-[15px] tabular-nums">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-line)] accent-[var(--color-primary)]"
      />
    </div>
  )
}
