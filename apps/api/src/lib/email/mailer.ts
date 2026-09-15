import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../../env'

/** Structural logger: Fastify's logger and a bare pino instance both satisfy it. */
export interface MailLogger {
  debug(obj: object, msg?: string): void
  info(obj: object, msg?: string): void
}
import type { EmailTemplate } from './templates'

export interface SendInput {
  to: string
  template: EmailTemplate
  /** Set for customer-facing mail so unsubscribes are honoured by mail clients. */
  listUnsubscribeUrl?: string
}

export interface Mailer {
  send(input: SendInput): Promise<void>
  verify(): Promise<boolean>
}

class SmtpMailer implements Mailer {
  private readonly transport: Transporter

  constructor(private readonly logger: MailLogger) {
    this.transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } : undefined,
    })
  }

  async send(input: SendInput): Promise<void> {
    await this.transport.sendMail({
      from: env.MAIL_FROM,
      to: input.to,
      subject: input.template.subject,
      text: input.template.text,
      html: input.template.html,
      headers: input.listUnsubscribeUrl
        ? {
            'List-Unsubscribe': `<${input.listUnsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        : undefined,
    })
    // Recipient is intentionally not logged: no PII in application logs.
    this.logger.debug({ subject: input.template.subject }, 'email sent')
  }

  async verify(): Promise<boolean> {
    try {
      await this.transport.verify()
      return true
    } catch {
      return false
    }
  }
}

/** Used in tests and when SMTP is deliberately switched off. */
class LogMailer implements Mailer {
  readonly sent: SendInput[] = []

  constructor(private readonly logger: MailLogger) {}

  async send(input: SendInput): Promise<void> {
    this.sent.push(input)
    this.logger.info({ subject: input.template.subject }, 'email captured (log transport)')
  }

  async verify(): Promise<boolean> {
    return true
  }
}

export function createMailer(logger: MailLogger): Mailer {
  return env.MAIL_TRANSPORT === 'smtp' ? new SmtpMailer(logger) : new LogMailer(logger)
}
