'use client'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

/**
 * Starts Sign in with Apple on the API, which owns the key and the state nonce.
 *
 * Black, white logo, full width: Apple reviews the dashboard's button against its
 * guidelines when the iOS app offers the same sign-in, so it stays close to the
 * reference rather than to the Google button beside it.
 */
export function AppleButton({ label, redirectTo }: { label: string; redirectTo?: string }) {
  const href = redirectTo
    ? `${apiUrl}/v1/auth/apple/start?redirectTo=${encodeURIComponent(redirectTo)}`
    : `${apiUrl}/v1/auth/apple/start`

  return (
    <a
      href={href}
      className="inline-flex w-full items-center justify-center gap-2 rounded-[9px] bg-black px-4 py-2.5 text-[14px] font-medium text-white transition-[background-color,transform] duration-150 hover:bg-[#1a1a1a] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
    >
      <svg aria-hidden="true" viewBox="0 0 17 20" className="size-[17px]" fill="currentColor">
        <path d="M14.07 10.62c.02 2.86 2.5 3.81 2.53 3.82-.02.07-.4 1.36-1.3 2.7-.79 1.15-1.6 2.3-2.89 2.32-1.26.02-1.67-.75-3.11-.75s-1.9.73-3.09.77c-1.24.05-2.19-1.25-2.98-2.4C1.6 14.73.36 10.44 2.03 7.52c.83-1.45 2.31-2.37 3.92-2.4 1.22-.02 2.37.82 3.11.82.75 0 2.15-1.02 3.62-.87.62.03 2.35.25 3.46 1.88-.09.06-2.07 1.21-2.07 3.67ZM11.7 3.52c.66-.8 1.1-1.9.98-3.02-.95.04-2.1.63-2.78 1.43-.61.7-1.14 1.83-1 2.9 1.06.09 2.14-.54 2.8-1.31Z" />
      </svg>
      {label}
    </a>
  )
}
