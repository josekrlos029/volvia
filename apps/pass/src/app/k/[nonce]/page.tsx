import { KioskStamp } from '@/components/KioskStamp'
import { Shell } from '@/components/Shell'

/**
 * Where the kiosk QR lands.
 *
 * The customer's phone arrives holding a single-use nonce but no idea which card is
 * theirs, so this page asks for their card and then completes the stamp. The nonce is
 * consumed server-side on that call, which is why nothing is done here on load.
 */
export default async function KioskLandingPage({ params }: { params: Promise<{ nonce: string }> }) {
  const { nonce } = await params
  return (
    <Shell>
      <KioskStamp nonce={nonce} />
    </Shell>
  )
}
