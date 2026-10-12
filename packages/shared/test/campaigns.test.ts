import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_TEMPLATES,
  CAMPAIGN_VARIABLES,
  renderCampaignText,
} from '../src/schemas/engagement'

const context = { name: 'María', business: 'Café Luna', stamps: 3, remaining: 2, hour: 15 }

describe('campaign placeholders', () => {
  it('writes the customer their own numbers', () => {
    expect(renderCampaignText('Hola {{name}}, llevas {{stamps}}', context)).toBe(
      'Hola María, llevas 3',
    )
    expect(renderCampaignText('Te faltan {{remaining}}', context)).toBe('Te faltan 2')
  })

  it('writes the hour as an hour, not as a number', () => {
    expect(renderCampaignText('Desde las {{hour}}', context)).toBe('Desde las 15:00')
    expect(renderCampaignText('Desde las {{hour}}', { ...context, hour: 9 })).toBe(
      'Desde las 09:00',
    )
  })

  it('leaves nothing dangling when we never asked for the data', () => {
    // A message reading "Hola {{name}}" to someone with no name is worse than "Hola".
    expect(renderCampaignText('Hola {{name}}', { name: null })).toBe('Hola ')
    expect(renderCampaignText('Hola {{name}}', {})).toBe('Hola ')
  })

  it('ignores whitespace and case the way a person would type it', () => {
    expect(renderCampaignText('{{ NAME }} y {{name}}', context)).toBe('María y María')
  })

  it('leaves a placeholder we do not know exactly as it was written', () => {
    // Better a visible mistake the business can fix than a silently blanked sentence.
    expect(renderCampaignText('Hola {{apellido}}', context)).toBe('Hola {{apellido}}')
  })

  it('does not touch text without placeholders', () => {
    expect(renderCampaignText('Hoy tus sellos valen doble', context)).toBe(
      'Hoy tus sellos valen doble',
    )
  })

  it('offers a template for every situation the dashboard shows', () => {
    expect(CAMPAIGN_TEMPLATES).toContain('spend_and_get')
    expect(CAMPAIGN_TEMPLATES).toContain('vip_thanks')
    expect(CAMPAIGN_TEMPLATES).toContain('last_chance')
    expect(CAMPAIGN_TEMPLATES.length).toBe(10)
    expect(CAMPAIGN_VARIABLES.length).toBe(5)
  })
})

describe('pass override', () => {
  it('parses a campaign written before the pass could be overridden', async () => {
    const { campaignSchema } = await import('../src/schemas/engagement')
    const parsed = campaignSchema.parse({
      name: 'Martes lento',
      headline: 'Hoy sellos dobles',
      body: 'Ven esta tarde',
      offer: { kind: 'multiplier', factor: 2 },
      audience: {},
      startsAt: '2026-10-11T10:00:00Z',
      endsAt: '2026-10-11T20:00:00Z',
    })
    expect(parsed.passOverride).toEqual({
      header: null,
      text: null,
      banner: null,
      stampStyle: null,
      endsOnFirstStamp: false,
    })
  })

  it('accepts a banner, a header and hidden stamps', async () => {
    const { campaignPassOverrideSchema } = await import('../src/schemas/engagement')
    const parsed = campaignPassOverrideSchema.parse({
      header: 'SELLOS DOBLES',
      banner: { kind: 'preset', value: 'stars' },
      stampStyle: 'hidden',
      endsOnFirstStamp: true,
    })
    expect(parsed.stampStyle).toBe('hidden')
    expect(parsed.banner).toEqual({ kind: 'preset', value: 'stars' })
    expect(parsed.text).toBeNull()
  })

  it('rejects a header too long for the pass and an unknown banner', async () => {
    const { campaignPassOverrideSchema } = await import('../src/schemas/engagement')
    expect(() => campaignPassOverrideSchema.parse({ header: 'x'.repeat(31) })).toThrow()
    expect(() =>
      campaignPassOverrideSchema.parse({ banner: { kind: 'preset', value: 'unicorn' } }),
    ).toThrow()
  })
})
