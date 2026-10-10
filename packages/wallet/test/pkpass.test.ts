import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
import forge from 'node-forge'
import { describe, expect, it } from 'vitest'
import { buildPkpass } from '../src/apple/builder'
import { buildPassJson, hexToRgbString } from '../src/apple/pass-json'
import { passTypeIdentifierFromCertificate } from '../src/apple/signer'
import { generateIcon } from '../src/png'
import type { PassContent } from '../src/types'

const certsDir = fileURLToPath(new URL('../../../infra/certs/', import.meta.url))
const certificatePem = readFileSync(`${certsDir}pass-cert.pem`, 'utf8')
const privateKeyPem = readFileSync(`${certsDir}pass-key.pem`, 'utf8')
const wwdrPem = readFileSync(`${certsDir}wwdr.pem`, 'utf8')

const content: PassContent = {
  serial: 'abc123def456ghi789',
  organizationName: 'Burger Train',
  cardName: 'Club BT',
  stampsCount: 4,
  stampsRequired: 8,
  rewardTitle: 'Hamburguesa gratis',
  rewardDescription: 'La que quieras del menú',
  pendingRewardCount: 0,
  terms: 'Una tarjeta por persona.',
  logoUrl: null,
  bannerUrl: null,
  backgroundColor: '#14161B',
  foregroundColor: '#FFFFFF',
  labelColor: '#F5B841',
  cardUrl: 'http://localhost:3002/c/abc123def456ghi789',
  places: [{ latitude: 10.46, longitude: -73.25 }],
  offerMessage: null,
  latestMessage: null,
  locale: 'es',
  updatedAt: new Date('2026-09-02T15:00:00Z'),
}

const options = {
  passTypeIdentifier: 'pass.co.volvia.loyalty',
  teamIdentifier: 'DEV0000000',
  webServiceURL: 'http://localhost:8080/wallet/apple',
  authenticationToken: 'a'.repeat(32),
  organizationName: 'Volvia',
}

const signing = { certificatePem, privateKeyPem, wwdrPem }

async function buildAndOpen() {
  const buffer = await buildPkpass({
    content,
    options,
    images: { 'icon.png': generateIcon(29, content.backgroundColor, content.labelColor) },
    signing,
  })
  return { buffer, zip: await JSZip.loadAsync(buffer) }
}

/** The shape of the parts of pass.json these tests assert on. */
interface StoreCardPass {
  formatVersion: number
  passTypeIdentifier: string
  serialNumber: string
  storeCard: {
    headerFields: Array<{ value: string }>
    primaryFields: Array<{ value: number }>
    secondaryFields: Array<{ value: string }>
    auxiliaryFields: Array<{ key: string; value: string; changeMessage?: string }>
    backFields: Array<{ key: string; label: string; value: string; changeMessage?: string }>
  }
  barcodes: Array<{ format: string; message: string }>
  locations: Array<{ latitude: number; longitude: number; relevantText: string }>
  maxDistance?: number
}

describe('pass.json', () => {
  it('converts hex colours to the rgb() form PassKit requires', () => {
    expect(hexToRgbString('#14161B')).toBe('rgb(20, 22, 27)')
    expect(hexToRgbString('#FFF')).toBe('rgb(255, 255, 255)')
  })

  it('describes the card as a store card with the progress up front', () => {
    const json = buildPassJson(content, options) as unknown as StoreCardPass
    expect(json.formatVersion).toBe(1)
    expect(json.passTypeIdentifier).toBe(options.passTypeIdentifier)
    expect(json.serialNumber).toBe(content.serial)
    expect(json.storeCard.headerFields[0]!.value).toBe('4/8')
    expect(json.storeCard.primaryFields[0]!.value).toBe(4)
    expect(json.storeCard.secondaryFields[0]!.value).toBe('Hamburguesa gratis')
    expect(json.barcodes[0]!.format).toBe('PKBarcodeFormatQR')
    expect(json.barcodes[0]!.message).toBe(content.cardUrl)
    expect(json.locations).toHaveLength(1)
  })

  it('announces a claimable reward, which a reset count alone cannot express', () => {
    // A completed card resets to 0/8, so the pending count is what distinguishes
    // "you just earned a burger" from "you have not started yet".
    const completed = buildPassJson(
      { ...content, stampsCount: 0, pendingRewardCount: 1 },
      options,
    ) as unknown as StoreCardPass
    expect(completed.storeCard.secondaryFields[0]!.value).toBe('¡Listo para reclamar!')

    const fresh = buildPassJson(
      { ...content, stampsCount: 0, pendingRewardCount: 0 },
      options,
    ) as unknown as StoreCardPass
    expect(fresh.storeCard.secondaryFields[0]!.value).toBe('Hamburguesa gratis')
  })

  it('surfaces an active campaign offer, and announces it', () => {
    const json = buildPassJson(
      { ...content, offerMessage: 'Hoy sellos dobles' },
      options,
    ) as unknown as StoreCardPass
    expect(json.storeCard.auxiliaryFields[0]!.value).toBe('Hoy sellos dobles')
    expect(json.storeCard.auxiliaryFields[0]!.changeMessage).toContain('%@')
  })

  it('always carries a message field, so the first message can be a change', () => {
    const fresh = buildPassJson(content, options) as unknown as StoreCardPass
    const field = fresh.storeCard.backFields.find((entry) => entry.key === 'message')
    expect(field).toBeDefined()
    expect(field!.changeMessage).toContain('%@')

    const sent = buildPassJson(
      {
        ...content,
        latestMessage: {
          headline: 'Te extrañamos',
          body: 'Pásate esta semana',
          sentAt: new Date('2026-10-01T10:00:00Z'),
        },
      },
      options,
    ) as unknown as StoreCardPass
    const updated = sent.storeCard.backFields.find((entry) => entry.key === 'message')!
    expect(updated.label).toBe('Te extrañamos')
    expect(updated.value).toBe('Pásate esta semana')
  })

  describe('nearby relevance', () => {
    it('pins every branch and tells the customer, in their language, where they stand', () => {
      const json = buildPassJson(content, options) as unknown as StoreCardPass
      expect(json.locations).toEqual([
        {
          latitude: 10.46,
          longitude: -73.25,
          relevantText: 'Estás cerca de Burger Train. Llevas 4/8 sellos.',
        },
      ])

      const english = buildPassJson(
        { ...content, locale: 'en' },
        options,
      ) as unknown as StoreCardPass
      expect(english.locations[0]!.relevantText).toBe(
        'Burger Train is nearby. You have 4/8 stamps.',
      )
    })

    it('leads with the reward when one is waiting: that is the moment to walk in', () => {
      const json = buildPassJson(
        { ...content, stampsCount: 0, pendingRewardCount: 1 },
        options,
      ) as unknown as StoreCardPass
      expect(json.locations[0]!.relevantText).toBe(
        'Estás cerca de Burger Train. ¡Tienes una recompensa lista!',
      )
    })

    it('leaves the radius to iOS: maxDistance could only make it smaller', () => {
      const json = buildPassJson(content, options) as unknown as StoreCardPass
      expect(json.maxDistance).toBeUndefined()
    })

    it('emits no locations for a business that has not pinned any branch', () => {
      const json = buildPassJson({ ...content, places: [] }, options) as unknown as StoreCardPass
      expect(json.locations).toEqual([])
    })
  })
})

describe('pkpass archive', () => {
  it('contains every file Apple requires', async () => {
    const { zip } = await buildAndOpen()
    for (const name of ['pass.json', 'icon.png', 'manifest.json', 'signature']) {
      expect(zip.file(name), `${name} missing`).not.toBeNull()
    }
  })

  it('manifest hashes match the actual file contents', async () => {
    const { zip } = await buildAndOpen()
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')) as Record<
      string,
      string
    >

    expect(Object.keys(manifest).sort()).toEqual(['icon.png', 'pass.json'])

    for (const [name, expected] of Object.entries(manifest)) {
      const contents = await zip.file(name)!.async('nodebuffer')
      expect(createHash('sha1').update(contents).digest('hex'), `${name} hash`).toBe(expected)
    }
  })

  it('signature is detached and carries the full certificate chain', async () => {
    const { zip } = await buildAndOpen()
    const signature = await zip.file('signature')!.async('nodebuffer')

    // `rawCapture` is real but absent from node-forge's public typings.
    const p7 = forge.pkcs7.messageFromAsn1(
      forge.asn1.fromDer(forge.util.createBuffer(signature.toString('binary'))),
    ) as forge.pkcs7.PkcsSignedData & { rawCapture: { content?: unknown } }

    // Detached: the manifest is not carried inside the blob, as PassKit requires.
    expect(p7.rawCapture.content).toBeUndefined()
    // Both the signing certificate and the intermediate must travel with the pass,
    // otherwise the device cannot build a chain and rejects it without explanation.
    expect(p7.certificates).toHaveLength(2)
  })

  it('signature verifies against the manifest (OpenSSL, the same check Apple makes)', async () => {
    const { zip } = await buildAndOpen()
    const dir = mkdtempSync(join(tmpdir(), 'volvia-pass-'))
    try {
      writeFileSync(
        join(dir, 'manifest.json'),
        await zip.file('manifest.json')!.async('nodebuffer'),
      )
      writeFileSync(join(dir, 'signature'), await zip.file('signature')!.async('nodebuffer'))

      // node-forge cannot verify PKCS#7, so verify with OpenSSL. `-noverify` skips
      // trust-chain validation only: these are self-signed development certificates,
      // but the cryptographic signature over the manifest is checked for real.
      const result = spawnSync(
        'openssl',
        [
          'smime',
          '-verify',
          '-binary',
          '-inform',
          'DER',
          '-in',
          join(dir, 'signature'),
          '-content',
          join(dir, 'manifest.json'),
          '-noverify',
          '-out',
          '/dev/null',
        ],
        { encoding: 'utf8' },
      )
      expect(result.stderr.trim()).toContain('Verification successful')
      expect(result.status).toBe(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects a tampered manifest', async () => {
    const { zip } = await buildAndOpen()
    const dir = mkdtempSync(join(tmpdir(), 'volvia-pass-'))
    try {
      const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
      manifest['pass.json'] = 'f'.repeat(40)
      writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
      writeFileSync(join(dir, 'signature'), await zip.file('signature')!.async('nodebuffer'))

      const result = spawnSync(
        'openssl',
        [
          'smime',
          '-verify',
          '-binary',
          '-inform',
          'DER',
          '-in',
          join(dir, 'signature'),
          '-content',
          join(dir, 'manifest.json'),
          '-noverify',
          '-out',
          '/dev/null',
        ],
        { encoding: 'utf8' },
      )
      expect(result.status).not.toBe(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('signs with a certificate issued for this pass type identifier', () => {
    expect(passTypeIdentifierFromCertificate(certificatePem)).toBe(options.passTypeIdentifier)
  })

  it('produces an archive small enough for a wallet download', async () => {
    const { buffer } = await buildAndOpen()
    expect(buffer.length).toBeGreaterThan(1_000)
    expect(buffer.length).toBeLessThan(200_000)
  })
})

describe('generated images', () => {
  it('emits a valid PNG with the right dimensions', () => {
    const png = generateIcon(29, '#14161B', '#F5B841')
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
    expect(png.readUInt32BE(16)).toBe(29)
    expect(png.readUInt32BE(20)).toBe(29)
    // colour type 6 = RGBA, which the transparent rounded corners need.
    expect(png[25]).toBe(6)
  })
})
