'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export interface Benefit {
  label: string
  title: string
  body: string
  photo: string
  alt: string
  href: string
  cta: string
  facts: Array<{ value: string; label: string }>
}

const DWELL_MS = 7000

/**
 * Four outcomes behind one set of tabs. The active tab fills its hairline as a timer and
 * then hands over to the next, so a reader who does nothing still sees the whole story;
 * hovering, focusing or choosing a tab stops the rotation for good.
 */
export function BenefitTabs({ benefits }: { benefits: Benefit[] }) {
  const [active, setActive] = useState(0)
  const [auto, setAuto] = useState(true)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `active` restarts the dwell timer whenever the tab changes, including by click
  useEffect(() => {
    if (!auto || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setTimeout(() => setActive((i) => (i + 1) % benefits.length), DWELL_MS)
    return () => window.clearTimeout(timer)
  }, [active, auto, benefits.length])

  const current = benefits[active]
  if (!current) return null

  return (
    <div onMouseEnter={() => setAuto(false)} onFocusCapture={() => setAuto(false)}>
      <div role="tablist" className="grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-4">
        {benefits.map((benefit, index) => (
          <button
            key={benefit.label}
            type="button"
            role="tab"
            id={`benefit-tab-${index}`}
            aria-selected={index === active}
            aria-controls="benefit-panel"
            onClick={() => {
              setActive(index)
              setAuto(false)
            }}
            className={[
              't-body-sm pb-3 text-left transition-colors',
              index === active ? 'text-[var(--color-ink)]' : 'text-[var(--color-slate)]',
            ].join(' ')}
          >
            {benefit.label}
            <span className="relative mt-3 block h-[2px] overflow-hidden bg-[var(--color-line)]">
              {index === active ? (
                <span
                  key={`${active}-${auto}`}
                  className={`absolute inset-0 bg-[var(--color-ink)] ${auto ? 'tab-progress' : ''}`}
                  style={{ '--tab-duration': `${DWELL_MS}ms` } as React.CSSProperties}
                />
              ) : null}
            </span>
          </button>
        ))}
      </div>

      <div
        id="benefit-panel"
        role="tabpanel"
        aria-labelledby={`benefit-tab-${active}`}
        className="relative mt-6 overflow-hidden rounded-[16px] bg-black text-white"
      >
        <Image
          key={current.photo}
          src={current.photo}
          alt={current.alt}
          width={1600}
          height={900}
          className="fade-in absolute inset-0 h-full w-full object-cover"
          sizes="(max-width: 1200px) 100vw, 1136px"
        />
        {/* Violet wash from the left keeps white type legible over any photograph. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(46,16,101,0.92)_0%,rgba(124,58,237,0.55)_45%,rgba(0,0,0,0)_80%)]"
        />
        <div className="relative flex min-h-[520px] flex-col justify-between gap-10 p-6 sm:p-10 lg:min-h-[600px] lg:p-14">
          <div className="max-w-[30ch]">
            <h3 className="t-heading-lg">{current.title}</h3>
            <p className="t-subheading mt-5 text-white/75">{current.body}</p>
            <Link href={current.href} className="btn-inverse btn-sm mt-8">
              {current.cta} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <dl className="flex flex-wrap gap-x-10 gap-y-4">
            {current.facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-[40px] leading-none tracking-[-0.05em]">{fact.value}</dt>
                <dd className="t-body-sm mt-2 text-white/70">{fact.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
