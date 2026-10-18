export const CONTACT_EMAIL = 'hola@somosvolvia.com'

/** A mail glyph plus the contact address, opening the mail client. */
export function EmailLink({ className = '' }: { className?: string }) {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-10 6L2 7" />
      </svg>
      <span>{CONTACT_EMAIL}</span>
    </a>
  )
}
