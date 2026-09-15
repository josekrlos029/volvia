import { brandCopy } from './copy'

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export type Locale = 'es' | 'en'

interface Layout {
  locale: Locale
  title: string
  intro: string
  cta?: { label: string; url: string }
  outro?: string
  footnote?: string
}

const COLORS = { ink: '#0E0F12', muted: '#5A5F6B', primary: '#5B4BD6', line: '#E4E6EC' }

/**
 * Plain, table-based HTML: every mail client renders it, and there is nothing to break
 * when the design changes. Text alternative is always sent alongside.
 */
function render(layout: Layout): { html: string; text: string } {
  const button = layout.cta
    ? `<tr><td style="padding:24px 0;">
         <a href="${layout.cta.url}"
            style="background:${COLORS.primary};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">
           ${layout.cta.label}
         </a>
       </td></tr>`
    : ''

  const html = `<!doctype html>
<html lang="${layout.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#F7F8FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${COLORS.ink}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid ${COLORS.line};border-radius:16px;padding:32px">
        <tr><td style="font-size:20px;font-weight:700;padding-bottom:8px">Volvia</td></tr>
        <tr><td style="font-size:18px;font-weight:600;padding-bottom:12px">${layout.title}</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;color:${COLORS.muted}">${layout.intro}</td></tr>
        ${button}
        ${layout.outro ? `<tr><td style="font-size:14px;line-height:1.6;color:${COLORS.muted}">${layout.outro}</td></tr>` : ''}
        ${layout.footnote ? `<tr><td style="font-size:12px;line-height:1.5;color:${COLORS.muted};padding-top:24px;border-top:1px solid ${COLORS.line}">${layout.footnote}</td></tr>` : ''}
      </table>
    </td></tr>
  </table>
</body></html>`

  const text = [
    layout.title,
    '',
    stripTags(layout.intro),
    layout.cta ? `\n${layout.cta.label}: ${layout.cta.url}` : '',
    layout.outro ? `\n${stripTags(layout.outro)}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return { html, text }
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, '')
}

export function verifyEmailTemplate(locale: Locale, url: string): EmailTemplate {
  const copy = brandCopy[locale].verifyEmail
  return {
    subject: copy.subject,
    ...render({
      locale,
      title: copy.title,
      intro: copy.intro,
      cta: { label: copy.cta, url },
      footnote: copy.footnote,
    }),
  }
}

export function magicLinkTemplate(locale: Locale, url: string): EmailTemplate {
  const copy = brandCopy[locale].magicLink
  return {
    subject: copy.subject,
    ...render({
      locale,
      title: copy.title,
      intro: copy.intro,
      cta: { label: copy.cta, url },
      footnote: copy.footnote,
    }),
  }
}

export function passwordResetTemplate(locale: Locale, url: string): EmailTemplate {
  const copy = brandCopy[locale].passwordReset
  return {
    subject: copy.subject,
    ...render({
      locale,
      title: copy.title,
      intro: copy.intro,
      cta: { label: copy.cta, url },
      footnote: copy.footnote,
    }),
  }
}

export function inviteTemplate(locale: Locale, url: string, orgName: string): EmailTemplate {
  const copy = brandCopy[locale].invite
  return {
    subject: copy.subject(orgName),
    ...render({
      locale,
      title: copy.title(orgName),
      intro: copy.intro,
      cta: { label: copy.cta, url },
      footnote: copy.footnote,
    }),
  }
}

export function welcomeCustomerTemplate(
  locale: Locale,
  input: { orgName: string; cardUrl: string; rewardTitle: string },
): EmailTemplate {
  const copy = brandCopy[locale].customerWelcome
  return {
    subject: copy.subject(input.orgName),
    ...render({
      locale,
      title: copy.title(input.orgName),
      intro: copy.intro(input.rewardTitle),
      cta: { label: copy.cta, url: input.cardUrl },
      footnote: copy.footnote,
    }),
  }
}

export function birthdayTemplate(
  locale: Locale,
  input: { orgName: string; cardUrl: string; offer: string },
): EmailTemplate {
  const copy = brandCopy[locale].birthday
  return {
    subject: copy.subject(input.orgName),
    ...render({
      locale,
      title: copy.title,
      intro: copy.intro(input.orgName, input.offer),
      cta: { label: copy.cta, url: input.cardUrl },
      footnote: copy.footnote,
    }),
  }
}

export function rewardReadyTemplate(
  locale: Locale,
  input: { orgName: string; cardUrl: string; rewardTitle: string },
): EmailTemplate {
  const copy = brandCopy[locale].rewardReady
  return {
    subject: copy.subject,
    ...render({
      locale,
      title: copy.title,
      intro: copy.intro(input.rewardTitle, input.orgName),
      cta: { label: copy.cta, url: input.cardUrl },
      footnote: copy.footnote,
    }),
  }
}
