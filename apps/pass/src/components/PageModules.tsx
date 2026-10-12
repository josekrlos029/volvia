/**
 * What the business put on its page: the menu, products, services, work, news and
 * events. Rendered on the server from the public payload; the only interaction is a
 * link out (WhatsApp, SMS, the business's own site).
 */
export interface PageItem {
  id: string
  title: string
  description: string
  priceAmount: number | null
  imageUrl: string | null
  durationMinutes: number | null
  startsAt: string | null
  endsAt: string | null
  publishedAt: string | null
  buttonLabel: string | null
  buttonUrl: string | null
  askVia: 'whatsapp' | 'sms' | null
}

export interface PageSection {
  id: string
  title: string
  description: string
  items: PageItem[]
}

export interface PageModule {
  kind: 'menu' | 'products' | 'services' | 'portfolio' | 'updates' | 'events'
  sections: PageSection[]
}

export interface ModuleLabels {
  menu: string
  products: string
  services: string
  portfolio: string
  updates: string
  events: string
  askWhatsApp: string
  askSms: string
  minutes: (n: number) => string
  askText: (item: string) => string
}

interface Props {
  modules: PageModule[]
  locale: string
  currency: string
  /** Digits only, for `wa.me`; null when the business has no WhatsApp on the page. */
  whatsapp: string | null
  /** The number SMS questions go to; null when none is published. */
  sms: string | null
  labels: ModuleLabels
  accentColor: string
}

const ORDER: PageModule['kind'][] = [
  'menu',
  'products',
  'services',
  'events',
  'updates',
  'portfolio',
]

function money(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-CO', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: currency === 'cop' ? 0 : 2,
  }).format(amount / 100)
}

function dateLine(iso: string, locale: string, withTime: boolean): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-CO', {
    day: 'numeric',
    month: 'long',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(iso))
}

function askHref(item: PageItem, props: Props): string | null {
  const text = encodeURIComponent(props.labels.askText(item.title))
  if (item.askVia === 'whatsapp' && props.whatsapp)
    return `https://wa.me/${props.whatsapp}?text=${text}`
  if (item.askVia === 'sms' && props.sms) return `sms:${props.sms}?&body=${text}`
  return null
}

function Item({ item, kind, props }: { item: PageItem; kind: PageModule['kind']; props: Props }) {
  const ask = askHref(item, props)
  const meta: string[] = []
  if (item.priceAmount !== null) meta.push(money(item.priceAmount, props.currency, props.locale))
  if (kind === 'services' && item.durationMinutes)
    meta.push(props.labels.minutes(item.durationMinutes))
  if (kind === 'events' && item.startsAt) meta.push(dateLine(item.startsAt, props.locale, true))
  if (kind === 'updates' && item.publishedAt)
    meta.push(dateLine(item.publishedAt, props.locale, false))

  const picture = item.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.imageUrl}
      alt=""
      className={
        kind === 'portfolio'
          ? 'aspect-square w-full rounded-[10px] object-cover'
          : 'h-16 w-16 shrink-0 rounded-[10px] object-cover'
      }
    />
  ) : null

  return (
    <li className={kind === 'portfolio' ? 'flex flex-col gap-2' : 'flex gap-3'}>
      {picture}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-medium leading-snug">{item.title}</p>
          {kind !== 'updates' && kind !== 'events' && item.priceAmount !== null ? (
            <p className="shrink-0 text-[14px] font-medium tabular-nums">{meta[0]}</p>
          ) : null}
        </div>
        {(kind === 'updates' || kind === 'events' || kind === 'services') && meta.length > 0 ? (
          <p className="mt-0.5 text-[13px] text-[var(--color-ink-muted)]">
            {(kind === 'services' ? meta.slice(1) : meta).join(' · ')}
          </p>
        ) : null}
        {item.description ? (
          <p className="mt-0.5 text-[14px] leading-snug text-[var(--color-ink-muted)]">
            {item.description}
          </p>
        ) : null}
        {ask || (item.buttonUrl && item.buttonLabel) ? (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {item.buttonUrl && item.buttonLabel ? (
              <a
                href={item.buttonUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[14px] font-medium underline underline-offset-2"
                style={{ color: props.accentColor }}
              >
                {item.buttonLabel}
              </a>
            ) : null}
            {ask ? (
              <a
                href={ask}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[14px] font-medium underline underline-offset-2"
                style={{ color: props.accentColor }}
              >
                {item.askVia === 'whatsapp' ? props.labels.askWhatsApp : props.labels.askSms}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  )
}

export function PageModules(props: Props) {
  const modules = [...props.modules].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
  if (modules.length === 0) return null

  return (
    <>
      {modules.map((module) => (
        <section
          key={module.kind}
          className="mb-6 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface)] p-4"
        >
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
            {props.labels[module.kind]}
          </h2>
          <div className="mt-3 flex flex-col gap-5">
            {module.sections.map((section) => (
              <div key={section.id}>
                {section.title ? (
                  <h3 className="text-[15px] font-semibold leading-snug">{section.title}</h3>
                ) : null}
                {section.description ? (
                  <p className="mt-0.5 text-[13px] text-[var(--color-ink-muted)]">
                    {section.description}
                  </p>
                ) : null}
                <ul
                  className={
                    module.kind === 'portfolio'
                      ? 'mt-2 grid grid-cols-2 gap-3'
                      : `mt-2 flex flex-col ${module.kind === 'menu' ? 'gap-2.5' : 'gap-4'}`
                  }
                >
                  {section.items.map((item) => (
                    <Item key={item.id} item={item} kind={module.kind} props={props} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
