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
import { buildPassJson, hexToRgbString, stampsRemaining } from '../src/apple/pass-json'
import { passTypeIdentifierFromCertificate } from '../src/apple/signer'
import { buildAppleImages } from '../src/images'
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
  rewardPositions: [4, 8],
  nextRewardAt: 8,
  cycleIndex: 0,
  lastStampAt: new Date('2026-09-01T18:30:00Z'),
  headline: 'Club Burger Train',
  terms: 'Una tarjeta por persona.',
  logoUrl: null,
  bannerUrl: null,
  backgroundColor: '#14161B',
  foregroundColor: '#FFFFFF',
  labelColor: '#F5B841',
  emptyStampColor: '#31363A',
  stampIcon: { kind: 'preset', value: 'burger' },
  stampStyle: 'circle',
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
    images: { 'icon.png': buildAppleImages(content)['icon.png'] },
    signing,
  })
  return { buffer, zip: await JSZip.loadAsync(buffer) }
}

/** The shape of the parts of pass.json these tests assert on. */
interface StoreCardPass {
  formatVersion: number
  passTypeIdentifier: string
  serialNumber: string
  logoText?: string
  storeCard: {
    headerFields: Array<{ key: string; label: string; value: string; changeMessage?: string }>
    primaryFields: Array<{ key: string; label: string; value: string; changeMessage?: string }>
    secondaryFields: Array<{ key: string; label: string; value: string; dateStyle?: string }>
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

  it('describes the card as a store card: business and progress in the header, reward up front', () => {
    const json = buildPassJson(content, options) as unknown as StoreCardPass
    expect(json.formatVersion).toBe(1)
    expect(json.passTypeIdentifier).toBe(options.passTypeIdentifier)
    expect(json.serialNumber).toBe(content.serial)
    // The header is all that shows while passes are stacked: the lockup image on the
    // left names both brands, so the text on the right is the business and the count.
    expect(json.logoText).toBeUndefined()
    expect(json.storeCard.headerFields[0]).toMatchObject({ label: 'Burger Train', value: '4/8' })
    expect(json.storeCard.primaryFields[0]).toMatchObject({
      label: 'Próxima recompensa',
      value: 'Hamburguesa gratis',
    })
    expect(json.storeCard.secondaryFields[0]).toMatchObject({
      label: 'Te faltan',
      value: '4 sellos',
    })
    expect(json.barcodes[0]!.format).toBe('PKBarcodeFormatQR')
    expect(json.barcodes[0]!.message).toBe(content.cardUrl)
    expect(json.locations).toHaveLength(1)
  })

  it('counts the stamps left to the next reward, not to the end of the card', () => {
    // Burger Train rewards at 4 and 8: with 2 stamps the next prize is 2 away.
    expect(stampsRemaining({ ...content, stampsCount: 2, nextRewardAt: 4 })).toBe(2)
    expect(stampsRemaining({ ...content, stampsCount: 5, nextRewardAt: 8 })).toBe(3)
    expect(stampsRemaining({ ...content, stampsCount: 5, nextRewardAt: null })).toBe(3)
  })

  it('announces each stamp with how far the reward is, from the rebuilt pass', () => {
    const json = buildPassJson(content, options) as unknown as StoreCardPass
    expect(json.storeCard.headerFields[0]!.changeMessage).toBe(
      '¡Sello sumado! Llevas %@. Te faltan 4 para Hamburguesa gratis.',
    )
    expect(json.storeCard.primaryFields[0]!.changeMessage).toBeUndefined()
  })

  it('announces a claimable reward, which a reset count alone cannot express', () => {
    // A completed card resets to 0/8, so the pending count is what distinguishes
    // "you just earned a burger" from "you have not started yet".
    const completed = buildPassJson(
      { ...content, stampsCount: 0, pendingRewardCount: 1 },
      options,
    ) as unknown as StoreCardPass
    expect(completed.storeCard.primaryFields[0]).toMatchObject({
      label: 'Recompensa lista',
      value: '¡Listo para reclamar!',
      changeMessage: 'Burger Train: %@',
    })
    expect(completed.storeCard.secondaryFields[0]).toMatchObject({
      label: 'Tu recompensa',
      value: 'Hamburguesa gratis',
    })
    // One banner per event: the count dropping to zero must not fire a second one.
    expect(completed.storeCard.headerFields[0]!.changeMessage).toBeUndefined()

    const fresh = buildPassJson(
      { ...content, stampsCount: 0, pendingRewardCount: 0 },
      options,
    ) as unknown as StoreCardPass
    expect(fresh.storeCard.primaryFields[0]!.value).toBe('Hamburguesa gratis')
  })

  it('shows the lap from the second one on, and the last visit before that', () => {
    const first = buildPassJson(content, options) as unknown as StoreCardPass
    expect(first.storeCard.secondaryFields[1]).toMatchObject({
      key: 'lastVisit',
      dateStyle: 'PKDateStyleMedium',
    })

    const second = buildPassJson({ ...content, cycleIndex: 1 }, options) as unknown as StoreCardPass
    expect(second.storeCard.secondaryFields[1]).toMatchObject({ label: 'Vuelta', value: '2' })
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
  it('emits valid PNGs', () => {
    const png = buildAppleImages(content)['icon.png']
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  })

  it('renders every density PassKit asks for, at the sizes it lays the card out with', () => {
    const images = buildAppleImages(content)
    const size = (png: Buffer) => [png.readUInt32BE(16), png.readUInt32BE(20)]
    expect(size(images['icon.png']!)).toEqual([29, 29])
    expect(size(images['icon@3x.png']!)).toEqual([87, 87])
    expect(size(images['strip.png']!)).toEqual([375, 123])
    expect(size(images['strip@2x.png']!)).toEqual([750, 246])
    const [logoW, logoH] = size(images['logo.png']!)
    // Apple caps the logo at 160×50 pt; the lockup is a good deal narrower than that.
    expect(logoH).toBe(50)
    expect(logoW).toBeLessThanOrEqual(160)
    expect(size(images['logo@2x.png']!)).toEqual([(logoW ?? 0) * 2, 100])
  })

  it('keeps the whole set small enough for a wallet download', () => {
    const total = Object.values(buildAppleImages(content)).reduce((sum, png) => sum + png.length, 0)
    expect(total).toBeLessThan(150_000)
  })
})
