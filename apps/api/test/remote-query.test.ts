import { describe, expect, it } from 'vitest'
import { classifyQuery } from '../src/modules/remote/query'

describe('classifyQuery', () => {
  it('reads a cédula written with dots as a number', () => {
    expect(classifyQuery('1.065.123.456')).toEqual({ kind: 'number', value: '1065123456' })
  })

  it('reads a phone with country code and spaces as a number', () => {
    expect(classifyQuery('+57 300 123 4567')).toEqual({ kind: 'number', value: '573001234567' })
  })

  it('keeps a passport-style ID as a number, upper-cased', () => {
    expect(classifyQuery('ab123456')).toEqual({ kind: 'number', value: 'AB123456' })
  })

  it('pulls the token out of a pasted card link', () => {
    expect(classifyQuery('https://pass.volvia.co/c/AbCdEfGhIjKlMnOpQrSt_-12')).toEqual({
      kind: 'token',
      token: 'AbCdEfGhIjKlMnOpQrSt_-12',
    })
  })

  it('treats words as a name', () => {
    expect(classifyQuery('María González')).toEqual({ kind: 'name' })
    expect(classifyQuery('ana')).toEqual({ kind: 'name' })
  })
})
