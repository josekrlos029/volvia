'use client'

/**
 * The page as a customer will see it, in a phone. Remounted whenever `version`
 * changes, so a save shows up without asking the business to reload.
 */
export function PagePreview({ publicUrl, version }: { publicUrl: string; version: string }) {
  return (
    <div className="lg:sticky lg:top-8">
      <p className="mb-2 text-[13px] font-medium text-[var(--color-ink-muted)]">
        Así la ve tu cliente
      </p>
      <div className="mx-auto w-[300px] rounded-[32px] border-[6px] border-[#14171A] bg-[#14171A] p-0.5 shadow-[0_18px_40px_-16px_rgba(16,18,15,0.5)]">
        <iframe
          key={version}
          src={publicUrl}
          title="Vista previa de tu página"
          className="h-[600px] w-full rounded-[26px] bg-white"
        />
      </div>
    </div>
  )
}
