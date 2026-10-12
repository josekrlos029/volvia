import { Panel } from './ui'

/**
 * Everything a business may need for its own records, in one place: the notice its
 * customers see, and the agreements between the business and Volvia. All of them live
 * on the public sites; this is the index.
 */
export function LegalDocuments({ slug }: { slug: string }) {
  const passUrl = process.env.NEXT_PUBLIC_PASS_URL ?? 'http://localhost:3002'
  // The marketing site is where the agreements live; in production that is the brand domain.
  const webUrl =
    process.env.NEXT_PUBLIC_WEB_URL ??
    (process.env.NODE_ENV === 'production' ? 'https://somosvolvia.com' : 'http://localhost:3000')

  const forCustomers = [
    {
      title: 'Aviso de privacidad para tus clientes',
      body: 'El que ven desde su tarjeta. Te nombra como responsable de sus datos, con los datos legales de arriba.',
      href: `${passUrl}/b/${slug}/privacidad`,
    },
  ]
  const withVolvia = [
    {
      title: 'Términos del servicio',
      body: 'El acuerdo entre tu negocio y Volvia por usar el servicio.',
      href: `${webUrl}/es/terminos`,
    },
    {
      title: 'Política de privacidad',
      body: 'Cómo trata Volvia tus propios datos como cliente.',
      href: `${webUrl}/es/privacidad`,
    },
    {
      title: 'Acuerdo de tratamiento de datos',
      body: 'Cubre el tratamiento que Volvia hace de los datos de tus clientes por tu cuenta. Se acepta junto con los términos.',
      href: `${webUrl}/es/dpa`,
    },
    {
      title: 'Subencargados',
      body: 'Los proveedores en los que Volvia se apoya para prestar el servicio.',
      href: `${webUrl}/es/subencargados`,
    },
    {
      title: 'Política de uso aceptable',
      body: 'Lo que puedes y no puedes hacer con Volvia.',
      href: `${webUrl}/es/uso-aceptable`,
    },
  ]

  const Row = ({ title, body, href }: { title: string; body: string; href: string }) => (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="block rounded-[9px] border border-[var(--color-line)] px-3.5 py-3 transition-colors hover:bg-[var(--color-surface-muted)]"
      >
        <p className="text-[14px] font-medium">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-[var(--color-ink-muted)]">{body}</p>
      </a>
    </li>
  )

  return (
    <Panel title="Documentos legales">
      <p className="mb-4 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
        Todo lo que puedas necesitar para tus registros. Ábrelos para leerlos o imprimirlos.
      </p>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
        Para tus clientes
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {forCustomers.map((doc) => (
          <Row key={doc.href} {...doc} />
        ))}
      </ul>
      <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
        Tu acuerdo con Volvia
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {withVolvia.map((doc) => (
          <Row key={doc.href} {...doc} />
        ))}
      </ul>
    </Panel>
  )
}
