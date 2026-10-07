'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A figure that counts up from zero the first time it scrolls into view. The server
 * renders the final value, so crawlers, no-JS readers and reduced-motion users all get
 * the real number straight away.
 */
export function CountUp({ value, className = '' }: { value: string; className?: string }) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(value)

  useEffect(() => {
    const element = ref.current
    const match = value.match(/^([\d.]+)(.*)$/)
    const target = match ? Number.parseFloat(match[1] ?? '0') : 0
    if (!element || !match || target === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const decimals = match[1]?.split('.')[1]?.length ?? 0
    const suffix = match[2] ?? ''
    const format = (n: number) => `${n.toFixed(decimals)}${suffix}`

    let frame = 0
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        observer.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / 1400)
          setShown(format(target * (1 - (1 - t) ** 3)))
          if (t < 1) frame = requestAnimationFrame(tick)
        }
        setShown(format(0))
        frame = requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value])

  return (
    <dt ref={ref} className={className}>
      {shown}
    </dt>
  )
}
