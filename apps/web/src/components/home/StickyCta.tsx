'use client'

import { useEffect, useState } from 'react'

/**
 * A floating sign-up pill that appears once the hero's own buttons have scrolled away,
 * so the next step is always one tap off without a banner covering the content.
 */
export function StickyCta({ href, label }: { href: string; label: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const nearEnd =
        window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 600
      setVisible(window.scrollY > 700 && !nearEnd)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <a
      href={href}
      inert={!visible}
      className={[
        'btn-primary fixed bottom-5 right-5 z-40 shadow-[var(--shadow-nav)] transition-[opacity,transform] duration-300',
        'mb-[env(safe-area-inset-bottom)]',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
      ].join(' ')}
    >
      {label}
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
    </a>
  )
}
