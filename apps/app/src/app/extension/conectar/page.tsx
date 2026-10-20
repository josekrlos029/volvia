import { ConnectExtension } from '@/components/ConnectExtension'
import { getSession } from '@/lib/session'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Conectar la extensión · Volvia' }

/**
 * Where the browser extension sends someone who signs in with Google or Apple: they
 * confirm the code it shows, from the session they already have here.
 */
export default async function ConnectExtensionPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams
  const session = await getSession()
  if (!session) {
    const back = `/extension/conectar${code ? `?code=${encodeURIComponent(code)}` : ''}`
    redirect(`/login?next=${encodeURIComponent(back)}`)
  }
  return <ConnectExtension code={code ?? ''} name={session.user.name} />
}
