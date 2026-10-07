export function FormError({ children }: { children: string }) {
  return (
    <p
      role="alert"
      className="rounded-[9px] bg-[#FBEBEA] px-3.5 py-2.5 text-[14px] text-[var(--color-danger)]"
    >
      {children}
    </p>
  )
}
