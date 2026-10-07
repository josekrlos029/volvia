'use client'

import Image from 'next/image'
import Link from 'next/link'
import { type ReactNode, useRef } from 'react'

export interface Story {
  href: string
  eyebrow: string
  quote: string
  photo: string
  cta: string
  facts: Array<{ value: string; label: string }>
}

/**
 * Wide cards one trade at a time, moved with arrow buttons or a swipe. The rail itself
 * scroll-snaps, so the buttons only nudge it by one card and touch users lose nothing.
 */
export function StoryCarousel({ stories, labels }: { stories: Story[]; labels: [string, string] }) {
  const rail = useRef<HTMLUListElement>(null)

  const move = (direction: 1 | -1) => {
    const element = rail.current
    const card = element?.firstElementChild as HTMLElement | null
    if (!element || !card) return
    element.scrollBy({ left: direction * (card.offsetWidth + 16), behavior: 'smooth' })
  }

  return (
    <div>
      <ul
        ref={rail}
        className="rail [grid-auto-columns:88%] sm:[grid-auto-columns:80%] lg:[grid-auto-columns:76%]"
      >
        {stories.map((story) => (
          <li
            key={story.href}
            className="grid overflow-hidden rounded-[16px] bg-[#0b0614] text-white lg:grid-cols-[1.1fr_1fr]"
          >
            <div className="flex flex-col justify-between gap-10 p-6 sm:p-10">
              <div>
                <p className="t-caption text-white/55">{story.eyebrow}</p>
                <p className="t-heading mt-5 max-w-[26ch]">{story.quote}</p>
                <Link
                  href={story.href}
                  className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/40 px-5 py-3 text-[15px] transition-colors hover:border-white"
                >
                  {story.cta} <span aria-hidden="true">→</span>
                </Link>
              </div>
              <dl className="flex gap-10">
                {story.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="max-w-[14ch] text-[28px] leading-none tracking-[-0.03em] text-[#c4b5fd]">
                      {fact.value}
                    </dt>
                    <dd className="t-body-sm mt-2 max-w-[18ch] text-white/60">{fact.label}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="p-3 pt-0 lg:p-3">
              <Image
                src={story.photo}
                alt=""
                width={900}
                height={900}
                className="aspect-[4/3] h-full w-full rounded-[12px] object-cover lg:aspect-auto"
                sizes="(max-width: 1024px) 85vw, 420px"
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex justify-end gap-2">
        <ArrowButton label={labels[0]} onClick={() => move(-1)}>
          ←
        </ArrowButton>
        <ArrowButton label={labels[1]} onClick={() => move(1)}>
          →
        </ArrowButton>
      </div>
    </div>
  )
}

function ArrowButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-14 w-14 place-items-center rounded-full border border-[var(--color-line)] text-[18px] transition-colors hover:border-[var(--color-ink)]"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  )
}
