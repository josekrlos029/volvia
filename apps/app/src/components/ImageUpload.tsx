'use client'

import { api } from '@/lib/api-client'
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from '@volvia/shared'
import { ApiError } from '@volvia/shared/client'
import { useId, useRef, useState } from 'react'
import { buttonClass } from './ui'

type UploadKind = 'logo' | 'banner' | 'cover' | 'stamp' | 'page'

/**
 * A picture from the business's computer to object storage, straight from the
 * browser: the API only signs the destination. Renders as a thumbnail with a button,
 * and hands the public URL back once the bytes have landed.
 */
export function ImageUpload({
  kind,
  value,
  onChange,
  label = 'Subir imagen',
  help,
  aspect = 'wide',
  disabled,
}: {
  kind: UploadKind
  value: string | null
  onChange: (url: string | null) => void
  label?: string
  help?: string
  /** How the thumbnail is framed: `wide` for banners and covers, `square` for logos. */
  aspect?: 'wide' | 'square'
  disabled?: boolean
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setError(null)
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setError('Usa una imagen PNG, JPG o WebP.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `La imagen pesa demasiado. El máximo son ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
      )
      return
    }
    setBusy(true)
    try {
      const target = await api.post<{ uploadUrl: string; publicUrl: string }>('/v1/org/uploads', {
        kind,
        contentType: file.type,
        contentLength: file.size,
      })
      const put = await fetch(target.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'content-type': file.type },
      })
      if (!put.ok) throw new Error(`upload_failed:${put.status}`)
      onChange(target.publicUrl)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos subir la imagen.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div
          className={[
            'shrink-0 overflow-hidden rounded-[9px] border border-[var(--color-line)] bg-[var(--color-surface-muted)]',
            aspect === 'square' ? 'h-14 w-14' : 'h-14 w-24',
          ].join(' ')}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={inputId} className={`${buttonClass('secondary', 'sm')} cursor-pointer`}>
            {busy ? 'Subiendo' : value ? 'Cambiar' : label}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            disabled={disabled || busy}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void upload(file)
            }}
            className="sr-only"
          />
          {value ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled || busy}
              className="text-[13px] text-[var(--color-ink-muted)] underline underline-offset-2"
            >
              Quitar
            </button>
          ) : null}
        </div>
      </div>
      {help ? (
        <p className="text-[13px] leading-snug text-[var(--color-ink-muted)]">{help}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
