import { requireRole } from '@/lib/session'

/**
 * Everything under this group is for the people who run the business: campaigns,
 * messages, surveys, reviews, automations, the team and settings. A counter account
 * that lands here is sent back to the overview instead of hitting an API error.
 */
export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  await requireRole('admin')
  return children
}
