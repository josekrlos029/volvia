import type { DeviceStartResult, SessionUser } from '@volvia/shared'
import { useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { api, signInWithPassword } from '../lib/api'
import { APP_URL } from '../lib/config'
import {
  POLL_DEVICE_MESSAGE,
  type PendingDevice,
  clearPendingDevice,
  loadPendingDevice,
  savePendingDevice,
} from '../lib/device'
import { signInErrorMessage } from '../lib/messages'
import type { StoredSession } from '../lib/session'
import { Button, Notice, Screen, field } from './ui'

interface TokenPair {
  accessToken: string
  refreshToken: string
  user: SessionUser
}

/**
 * Two ways in: the email and password of the Volvia account, or — for people who use
 * Google or Apple — a code they approve in the dashboard, where they are already in.
 */
export function Login({ onSignedIn }: { onSignedIn: (session: StoredSession) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [device, setDevice] = useState<PendingDevice | null>(null)

  // Reopened while a code is still waiting for approval: keep showing it.
  useEffect(() => {
    void loadPendingDevice().then(setDevice)
  }, [])

  const finish = (pair: TokenPair) => onSignedIn({ ...pair, orgId: null })

  async function submit() {
    setWorking(true)
    setError(null)
    try {
      finish(await signInWithPassword(email.trim(), password))
    } catch (caught) {
      setError(signInErrorMessage(caught))
      setWorking(false)
    }
  }

  async function connect() {
    setError(null)
    try {
      const started = await api.post<DeviceStartResult>('/v1/auth/device/start', undefined, {
        noRetry: true,
      })
      setDevice(await savePendingDevice(started))
      await browser.tabs.create({
        url: `${APP_URL}/extension/conectar?code=${encodeURIComponent(started.userCode)}`,
      })
    } catch (caught) {
      setError(signInErrorMessage(caught))
    }
  }

  if (device) {
    return (
      <DeviceWait
        device={device}
        onDone={onSignedIn}
        onCancel={(message) => {
          setDevice(null)
          setError(message)
        }}
      />
    )
  }

  return (
    <Screen>
      <div className="flex flex-col items-center gap-3 pt-6 text-center">
        <img src="/brand/logo-full.png" alt="Volvia" className="h-9 w-auto" />
        <p className="text-[15px] text-[var(--color-ink-muted)]">
          Sella a tus clientes de domicilio
        </p>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Correo
          <input
            type="email"
            autoComplete="email"
            // biome-ignore lint/a11y/noAutofocus: the popup opens on this one form
            autoFocus
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Clave
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={field}
          />
        </label>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button type="submit" disabled={working || !email || !password}>
          {working ? 'Entrando' : 'Entrar'}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-[12px] text-[var(--color-ink-muted)]">
        <span className="h-px flex-1 bg-[var(--color-line)]" />o
        <span className="h-px flex-1 bg-[var(--color-line)]" />
      </div>
      <Button variant="secondary" onClick={() => void connect()}>
        Conectar con mi cuenta
      </Button>
      <p className="text-center text-[12px] leading-snug text-[var(--color-ink-muted)]">
        Si entras al panel con Google o Apple, usa «Conectar con mi cuenta».
      </p>
    </Screen>
  )
}

/** Shows the code while the background script waits for the dashboard to approve it. */
function DeviceWait({
  device,
  onDone,
  onCancel,
}: {
  device: PendingDevice
  onDone: (session: StoredSession) => void
  onCancel: (message: string | null) => void
}) {
  useEffect(() => {
    void browser.runtime.sendMessage(POLL_DEVICE_MESSAGE)
    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      const session = changes['volvia.session']?.newValue as StoredSession | undefined
      if (session) onDone(session)
      else if (changes['volvia.device'] && !changes['volvia.device'].newValue) {
        onCancel('El código venció. Vuelve a intentarlo.')
      }
    }
    browser.storage.local.onChanged.addListener(listener)
    return () => browser.storage.local.onChanged.removeListener(listener)
  }, [onDone, onCancel])

  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-[15px] font-medium">Confirma este código en la pestaña del panel</p>
        <p className="rounded-[12px] bg-white px-5 py-3 font-mono text-[28px] font-semibold tracking-[0.18em] shadow-sm">
          {device.userCode}
        </p>
        <p className="text-[13px] leading-snug text-[var(--color-ink-muted)]">
          Cuando lo confirmes, vuelve a abrir Volvia Biz y ya estarás dentro.
        </p>
        <Button
          variant="ghost"
          onClick={() => {
            void clearPendingDevice()
            onCancel(null)
          }}
        >
          Cancelar
        </Button>
      </div>
    </Screen>
  )
}
