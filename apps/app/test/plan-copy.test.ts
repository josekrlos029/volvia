import { describe, expect, it } from 'vitest'
import { FEATURE_LABELS, trialLockSummary } from '../src/lib/plan-copy'

describe('trialLockSummary', () => {
  it('names the features a counter cares about first, then counts the rest', () => {
    const summary = trialLockSummary()
    expect(summary.startsWith('Wallet, colores propios, campañas, cumpleaños')).toBe(true)
    expect(summary).toMatch(/ y \d+ más$/)
  })

  it('counts nothing extra when everything fits', () => {
    expect(trialLockSummary(['campaigns', 'surveys'], 4)).toBe('campañas, encuestas')
    expect(trialLockSummary([], 4)).toBe('')
  })

  it('has a label for every feature it may name', () => {
    for (const feature of ['wallet_passes', 'campaigns', 'kiosk_mode', 'multi_location']) {
      expect(FEATURE_LABELS[feature]).toBeTruthy()
    }
  })
})
