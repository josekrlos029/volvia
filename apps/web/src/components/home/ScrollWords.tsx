'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A heading whose words darken one by one as it scrolls up the screen, so the reader's
 * own scrolling is what "writes" the line. Without JavaScript, or with reduced motion,
 * the heading simply renders fully inked.
 */
export function ScrollWords({
  text,
  as: Tag = 'h2',
  className = '',
  tone = 'light',
}: {
  text: string
  as?: 'h2' | 'h3' | 'p'
  className?: string
  /** `dark` for headings sitting on the black band. */
  tone?: 'light' | 'dark'
}) {
  const words = text.split(' ')
  const ref = useRef<HTMLHeadingElement>(null)
  const [lit, setLit] = useState(words.length)

  useEffect(() => {
    const element = ref.current
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    const update = () => {
      frame = 0
      const { top } = element.getBoundingClientRect()
      const viewport = window.innerHeight
      // Starts lighting as the line enters the lower fifth, done by the middle of the screen.
      const progress = (viewport * 0.85 - top) / (viewport * 0.4)
      setLit(Math.round(Math.min(1, Math.max(0, progress)) * words.length))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [words.length])

  const dim = tone === 'dark' ? 'text-white/25' : 'text-[var(--color-fog)]'

  return (
    <Tag ref={ref} className={className}>
      {words.map((word, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: words repeat; position is the identity
          key={index}
          className={`transition-colors duration-300 ${index < lit ? '' : dim}`}
        >
          {word}
          {index < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  )
}
