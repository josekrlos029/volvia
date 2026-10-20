import type { DeviceStartResult, SessionUser } from '@volvia/shared'
import { browser } from 'wxt/browser'
import { API_URL } from './config'
import { saveSession } from './session'

/**
 * Connecting with a code approved in the dashboard. The popup closes the moment the
 * person switches to the dashboard tab, so the waiting happens in the background
 * script: it polls until the code is approved or expires, and saves the session the
 * popup finds the next time it opens.
 */
export interface PendingDevice {
  userCode: string
  pollToken: string
  expiresAt: number
  interval: number
}

const KEY = 'volvia.device'
export const POLL_DEVICE_MESSAGE = 'volvia.poll-device'

export async function savePendingDevice(started: DeviceStartResult): Promise<PendingDevice> {
  const pending: PendingDevice = {
    userCode: started.userCode,
    pollToken: started.pollToken,
    expiresAt: Date.now() + started.expiresIn * 1000,
    interval: started.interval,
  }
  await browser.storage.local.set({ [KEY]: pending })
  return pending
}

export async function loadPendingDevice(): Promise<PendingDevice | null> {
  const stored = await browser.storage.local.get(KEY)
  const pending = (stored[KEY] as PendingDevice | undefined) ?? null
  if (pending && pending.expiresAt < Date.now()) {
    await clearPendingDevice()
    return null
  }
  return pending
}

export async function clearPendingDevice(): Promise<void> {
  await browser.storage.local.remove(KEY)
}

let polling = false

/** Runs in the background script. Safe to call repeatedly: only one loop runs. */
export async function pollPendingDevice(): Promise<void> {
  if (polling) return
  polling = true
  try {
    for (;;) {
      const pending = await loadPendingDevice()
      if (!pending) return
      const response = await fetch(`${API_URL}/v1/auth/device/poll`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pollToken: pending.pollToken }),
        credentials: 'omit',
      }).catch(() => null)

      if (response?.status === 200) {
        const pair = (await response.json()) as {
          accessToken: string
          refreshToken: string
          user: SessionUser
        }
        await saveSession({ ...pair, orgId: null })
        await clearPendingDevice()
        return
      }
      if (response?.status === 401) {
        await clearPendingDevice()
        return
      }
      await new Promise((resolve) => setTimeout(resolve, pending.interval * 1000))
    }
  } finally {
    polling = false
  }
}
