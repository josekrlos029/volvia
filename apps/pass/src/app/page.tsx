import { redirect } from 'next/navigation'

/** Nothing lives at the root of this app; every URL is a card, a join link or a business. */
export default function Home() {
  redirect(process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000')
}
