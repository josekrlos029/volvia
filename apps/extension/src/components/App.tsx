import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { bindSession } from '../lib/api'
import { type StoredSession, loadSession, saveSession } from '../lib/session'
import { Home } from './Home'
import { Login } from './Login'
import { OrgPicker } from './OrgPicker'

/**
 * The popup: sign in once, pick the business once, then search and stamp. Everything
 * the person chose is remembered, so from the second day it opens straight on the
 * search box.
 */
export function App() {
  const [session, setSession] = useState<StoredSession | null | undefined>(undefined)

  const update = useCallback(async (next: StoredSession | null) => {
    // One business: nothing to choose.
    const resolved =
      next && !next.orgId && next.user.memberships.length === 1
        ? { ...next, orgId: next.user.memberships[0]!.orgId }
        : next
    bindSession(resolved, () => setSession(null))
    await saveSession(resolved)
    setSession(resolved)
  }, [])

  useEffect(() => {
    void browser.action.setBadgeText({ text: '' })
    void loadSession().then((stored) => {
      bindSession(stored, () => setSession(null))
      setSession(stored)
    })
  }, [])

  if (session === undefined) return null
  if (!session) return <Login onSignedIn={update} />
  if (!session.orgId) {
    return (
      <OrgPicker
        memberships={session.user.memberships}
        onPick={(orgId) => update({ ...session, orgId })}
        onSignOut={() => update(null)}
      />
    )
  }
  return (
    <Home
      session={session}
      onSwitchOrg={() => update({ ...session, orgId: null })}
      onSignOut={() => update(null)}
    />
  )
}
