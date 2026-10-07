'use client'

import { api } from '@/lib/api-client'
import type { OrgSettings } from '@volvia/shared'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Panel, buttonClass } from './ui'

const field =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] placeholder:text-[#8A908A] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

/**
 * Who answers for the customer's data.
 *
 * The customer gave their email to this shop, not to Volvia, so the privacy notice
 * their card links to has to carry the shop's own details. Filling this in is what
 * turns a generic page into one that actually names someone.
 */
export function LegalSettings({ settings, slug }: { settings: OrgSettings; slug: string }) {
  const router = useRouter()
  const [value, setValue] = useState(settings)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const passUrl = process.env.NEXT_PUBLIC_PASS_URL ?? 'http://localhost:3002'

  return (
    <Panel
      title="Datos legales"
      action={
        <a
          href={`${passUrl}/b/${slug}/privacidad`}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] font-medium text-[var(--color-primary)] underline underline-offset-2"
        >
          Ver tu aviso
        </a>
      }
    >
      <p className="mb-4 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
        Salen en el aviso de privacidad que ve tu cliente desde su tarjeta. Si lo dejas vacío, el
        aviso usa el nombre y el correo de contacto del negocio.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Razón social" htmlFor="legal-name">
          <input
            id="legal-name"
            value={value.legalName}
            onChange={(event) => setValue({ ...value, legalName: event.target.value })}
            maxLength={160}
            className={field}
            placeholder="Café Luna S.A.S."
          />
        </Field>

        <Field label="Identificación fiscal" htmlFor="legal-tax">
          <input
            id="legal-tax"
            value={value.taxId}
            onChange={(event) => setValue({ ...value, taxId: event.target.value })}
            maxLength={40}
            className={field}
            placeholder="NIT 900.123.456-7"
          />
        </Field>

        <Field label="Dirección fiscal" htmlFor="legal-address">
          <input
            id="legal-address"
            value={value.legalAddress}
            onChange={(event) => setValue({ ...value, legalAddress: event.target.value })}
            maxLength={200}
            className={field}
          />
        </Field>

        <Field
          label="Correo para datos personales"
          htmlFor="legal-email"
          help="Donde un cliente puede pedirte que borres sus datos."
        >
          <input
            id="legal-email"
            type="email"
            value={value.privacyEmail}
            onChange={(event) => setValue({ ...value, privacyEmail: event.target.value })}
            maxLength={160}
            className={field}
          />
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={status === 'saving'}
          onClick={async () => {
            setStatus('saving')
            try {
              await api.patch('/v1/org', {
                settings: {
                  legalName: value.legalName,
                  taxId: value.taxId,
                  legalAddress: value.legalAddress,
                  privacyEmail: value.privacyEmail,
                },
              })
              setStatus('saved')
              router.refresh()
              setTimeout(() => setStatus('idle'), 2_000)
            } catch {
              setStatus('idle')
            }
          }}
          className={buttonClass('primary')}
        >
          {status === 'saving' ? 'Guardando' : 'Guardar'}
        </button>
        {status === 'saved' ? (
          <span className="text-[14px] text-[var(--color-success)]">Cambios guardados</span>
        ) : null}
      </div>
    </Panel>
  )
}

function Field({
  label,
  htmlFor,
  help,
  children,
}: {
  label: string
  htmlFor: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[14px] font-medium">
        {label}
      </label>
      {children}
      {help ? (
        <p className="text-[13px] leading-snug text-[var(--color-ink-muted)]">{help}</p>
      ) : null}
    </div>
  )
}
