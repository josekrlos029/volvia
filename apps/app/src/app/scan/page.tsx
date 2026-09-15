import { Scanner } from '@/components/Scanner'
import { getSession } from '@/lib/session'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Escanear · Volvia' }

/** The scanner runs outside the dashboard chrome: it is a full-screen tool for staff. */
export default async function ScanPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <Scanner />
}
