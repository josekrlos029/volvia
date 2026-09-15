'use client'

import { t } from '@/lib/i18n'
import { useEffect, useState } from 'react'

interface WalletButtonsProps {
  appleUrl: string | null
  googleUrl: string | null
  locale: string
}

/**
 * Wallet buttons, ordered by platform.
 *
 * An iPhone user should not have to read past a Google button to find theirs, so the
 * matching platform is shown first and the other stays available but secondary.
 */
export function WalletButtons({ appleUrl, googleUrl, locale }: WalletButtonsProps) {
  const copy = t(locale)
  const [platform, setPlatform] = useState<'apple' | 'google' | 'unknown'>('unknown')

  useEffect(() => {
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod|Macintosh/.test(ua)) setPlatform('apple')
    else if (/Android/.test(ua)) setPlatform('google')
  }, [])

  if (!appleUrl && !googleUrl) return null

  const apple = appleUrl ? (
    <a
      key="apple"
      href={appleUrl}
      className="flex items-center justify-center gap-2 rounded-[10px] bg-[#14171A] px-4 py-3.5 text-[15px] font-medium text-white transition-transform duration-150 active:scale-[0.985]"
    >
      <AppleGlyph />
      {copy.card.addApple}
    </a>
  ) : null

  const google = googleUrl ? (
    <a
      key="google"
      href={googleUrl}
      className="flex items-center justify-center gap-2 rounded-[10px] border border-[var(--color-line)] bg-white px-4 py-3.5 text-[15px] font-medium text-[var(--color-ink)] transition-transform duration-150 active:scale-[0.985]"
    >
      <GoogleGlyph />
      {copy.card.addGoogle}
    </a>
  ) : null

  const ordered = platform === 'google' ? [google, apple] : [apple, google]

  return <div className="flex flex-col gap-2.5">{ordered.filter(Boolean)}</div>
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.9-3-.8c-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.9 2.2 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.1c.9-1.2 1.2-2.4 1.2-2.4s-2.4-.9-2.4-3.8zM14.2 5.9c.6-.8 1-1.9.9-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-.9 2.9 1 0 2.1-.5 2.7-1.3z" />
    </svg>
  )
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14z"
      />
      <path
        fill="#EA4335"
        d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1z"
      />
    </svg>
  )
}
