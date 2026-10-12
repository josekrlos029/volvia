'use client'

import { Children, type ReactNode, cloneElement, isValidElement, useState } from 'react'
import { PagePreview } from './PagePreview'

/**
 * The editors on the left, the phone on the right. Every editor gets an `onSaved`
 * that bumps the preview, so what was just saved shows up without a reload.
 */
export function PageWorkspace({ publicUrl, children }: { publicUrl: string; children: ReactNode }) {
  const [version, setVersion] = useState(() => String(Date.now()))
  const bump = () => setVersion(String(Date.now()))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="flex flex-col gap-6">
        {Children.map(children, (child) =>
          isValidElement<{ onSaved?: () => void }>(child)
            ? cloneElement(child, { onSaved: bump })
            : child,
        )}
      </div>
      <PagePreview publicUrl={publicUrl} version={version} />
    </div>
  )
}
